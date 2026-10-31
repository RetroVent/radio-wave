import type { NoiseProfileSpec } from '../shared/types';
import { BiquadFilter } from './biquad';
import { OnePoleSmoother } from './smoother';

/**
 * Spectrally accurate radio static, atmospheric sferics, and AC mains hum generator.
 *
 * Key engineering guarantees:
 * 1. True zero-CPU fast path when target noise level is 0 and smoother has settled.
 * 2. Battery-powered profiles (mainsHumLevel = 0) never emit 60/120 Hz hum.
 * 3. Optional Idle Noise Ducking attenuates hiss smoothly (-22 dB) when source audio
 *    remains below -55 dBFS past a 300 ms conversational hold window.
 */
export class RadioNoiseGenerator {
  private rngState = 0x6d2b79f5;
  private sampleRate: number;

  // Paul Kellet 3-pole pink noise states
  private pk0 = 0;
  private pk1 = 0;
  private pk2 = 0;

  // Brownian / atmospheric red noise integrator
  private brownState = 0;

  // Atmospheric sferic crackle state
  private crackleEnv = 0;

  // Phase accumulator for AC mains heater/ripple hum
  private mainsPhase = 0;

  // Speaker/IF bandpass filters shaping the RF hiss
  private readonly noiseHpf = new BiquadFilter();
  private readonly noiseLpf = new BiquadFilter();

  // Smoothers for click-free noise level & idle ducking gate
  private readonly levelSmoother: OnePoleSmoother;
  private readonly duckGateSmoother: OnePoleSmoother;

  private holdSamplesRemaining = 0;
  private holdDurationSamples = 14400; // 300 ms at 48 kHz
  private profile: NoiseProfileSpec = {
    pinkWeight: 0.75,
    brownWeight: 0.25,
    mainsHumLevel: 0.06,
    mainsFundamentalHz: 60,
    crackleDensity: 0.1,
    noiseHighPassHz: 100,
    noiseLowPassHz: 4500,
  };

  constructor(sampleRate = 48000, seed = 0x6d2b79f5) {
    this.sampleRate = Math.max(8000, sampleRate);
    this.rngState = seed >>> 0 || 0x6d2b79f5;
    this.levelSmoother = new OnePoleSmoother(0, 25, this.sampleRate);
    this.duckGateSmoother = new OnePoleSmoother(1, 180, this.sampleRate);
    this.updateTimings();
    this.configureProfile(this.profile);
  }

  private updateTimings(): void {
    this.holdDurationSamples = Math.floor(0.3 * this.sampleRate);
    this.levelSmoother.setSampleRate(25, this.sampleRate);
    this.duckGateSmoother.setSampleRate(180, this.sampleRate);
  }

  setSampleRate(sampleRate: number): void {
    this.sampleRate = Math.max(8000, sampleRate);
    this.updateTimings();
    this.configureProfile(this.profile);
  }

  configureProfile(profile: NoiseProfileSpec): void {
    this.profile = profile;
    this.noiseHpf.configure('highpass', profile.noiseHighPassHz, this.sampleRate, Math.SQRT1_2, 0);
    this.noiseLpf.configure('lowpass', profile.noiseLowPassHz, this.sampleRate, Math.SQRT1_2, 0);
  }

  setTargetLevel(normalizedLevel: number, snap = false): void {
    // Map UI 0..1 curve quadratically so 15–30% sits comfortably at -44 to -36 dBFS
    // and 100% caps at -23 dBFS (never drowning out music!).
    const clamped = Math.max(0, Math.min(1, normalizedLevel));
    const maxAmplitude = 0.068;
    const gain = clamped === 0 ? 0 : maxAmplitude * Math.pow(clamped, 1.45);
    if (snap) {
      this.levelSmoother.snapTo(gain);
    } else {
      this.levelSmoother.setTarget(gain);
    }
  }

  reset(): void {
    this.pk0 = 0;
    this.pk1 = 0;
    this.pk2 = 0;
    this.brownState = 0;
    this.crackleEnv = 0;
    this.mainsPhase = 0;
    this.holdSamplesRemaining = 0;
    this.noiseHpf.reset();
    this.noiseLpf.reset();
    this.duckGateSmoother.snapTo(1);
  }

  getDuckGateGain(): number {
    return this.duckGateSmoother.getValue();
  }

  private nextWhite(): number {
    let x = this.rngState;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.rngState = x >>> 0;
    return (this.rngState / 0xffffffff) * 2 - 1;
  }

  nextSample(inputSignalLevel: number, idleDuckingEnabled: boolean): number {
    // True zero-CPU fast path when noise is completely disabled
    if (this.levelSmoother.getTarget() === 0 && this.levelSmoother.isSettled(1e-7)) {
      this.levelSmoother.snapTo(0);
      return 0;
    }

    const level = this.levelSmoother.next();

    // Update Idle Noise Ducking envelope
    let duckGain = 1.0;
    if (idleDuckingEnabled) {
      // -55 dBFS threshold (~0.00178 linear)
      if (inputSignalLevel > 0.00178) {
        this.holdSamplesRemaining = this.holdDurationSamples;
        this.duckGateSmoother.setTarget(1.0);
      } else if (this.holdSamplesRemaining > 0) {
        this.holdSamplesRemaining--;
        this.duckGateSmoother.setTarget(1.0);
      } else {
        // Duck static smoothly by ~22 dB (0.08x) during prolonged pause
        this.duckGateSmoother.setTarget(0.08);
      }
      duckGain = this.duckGateSmoother.next();
    } else {
      this.duckGateSmoother.setTarget(1.0);
      duckGain = this.duckGateSmoother.next();
    }

    const white = this.nextWhite();

    // Paul Kellet 3-pole pink noise approximation (normalized ~0.25 RMS)
    this.pk0 = 0.99765 * this.pk0 + white * 0.099046;
    this.pk1 = 0.963 * this.pk1 + white * 0.2965164;
    this.pk2 = 0.57 * this.pk2 + white * 1.0526913;
    const pink = (this.pk0 + this.pk1 + this.pk2 + white * 0.1848) * 0.22;

    // Leaky integrated brownian noise for warm atmospheric rumble
    this.brownState = 0.985 * this.brownState + white * 0.045;
    const brown = this.brownState;

    // Subtle atmospheric lightning sferic ticks
    const crackleProb = (this.profile.crackleDensity * 14) / this.sampleRate;
    if (Math.abs(white) > 1 - crackleProb * 2) {
      this.crackleEnv = (0.35 + 0.65 * Math.abs(white)) * (white >= 0 ? 1 : -1);
    } else {
      this.crackleEnv *= 0.92;
      if (Math.abs(this.crackleEnv) < 1e-8) this.crackleEnv = 0;
    }

    const rfComposite =
      this.profile.pinkWeight * pink + this.profile.brownWeight * brown + this.crackleEnv * 0.55;

    const bandShapedHiss = this.noiseLpf.processSample(this.noiseHpf.processSample(rfComposite));

    // AC mains heater/B+ hum (strictly zero on battery-powered transistor presets)
    let mainsHum = 0;
    if (this.profile.mainsHumLevel > 0) {
      const phaseInc = (2 * Math.PI * this.profile.mainsFundamentalHz) / this.sampleRate;
      this.mainsPhase += phaseInc;
      if (this.mainsPhase > 2 * Math.PI) this.mainsPhase -= 2 * Math.PI;
      mainsHum =
        this.profile.mainsHumLevel *
        0.35 *
        (0.65 * Math.sin(this.mainsPhase) + 0.35 * Math.sin(2 * this.mainsPhase + 0.4));
    }

    return (bandShapedHiss + mainsHum) * level * duckGain;
  }
}
