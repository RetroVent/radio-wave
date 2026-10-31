import { describe, expect, it } from 'vitest';
import { VintageRadioPipeline } from '../../src/dsp/pipeline';
import { PRESET_ORDER, PRESETS, sanitizeDspParams } from '../../src/shared/presets';
import type { PresetId } from '../../src/shared/types';
import {
  generateImpulse,
  generateLogSweep,
  generateMusicalComposite,
  generatePinkNoise,
  generateSilence,
  generateSine,
  generateWhiteNoise,
  hasAllFiniteSamples,
  measureMaxStepDelta,
  measurePeakLinear,
  measureRmsDb,
  measureToneMagnitudeLinear,
} from './signals';

function runPipelineBlocks(
  pipeline: VintageRadioPipeline,
  leftIn: Float32Array,
  rightIn: Float32Array,
  blockSize = 128,
  onBlock?: (blockIndex: number, sampleOffset: number) => void,
): [Float32Array, Float32Array] {
  const n = leftIn.length;
  const leftOut = new Float32Array(n);
  const rightOut = new Float32Array(n);

  let offset = 0;
  let blockIndex = 0;
  while (offset < n) {
    if (onBlock) onBlock(blockIndex, offset);
    const len = Math.min(blockSize, n - offset);
    const lSliceIn = leftIn.subarray(offset, offset + len);
    const rSliceIn = rightIn.subarray(offset, offset + len);
    const lSliceOut = leftOut.subarray(offset, offset + len);
    const rSliceOut = rightOut.subarray(offset, offset + len);
    pipeline.process(lSliceIn, rSliceIn, lSliceOut, rSliceOut);
    offset += len;
    blockIndex++;
  }
  return [leftOut, rightOut];
}

describe('VintageRadioPipeline — Comprehensive Synthetic DSP Suite', () => {
  it('1. produces distinct, historically faithful frequency responses across all 5 presets on sweeps & sine waves', () => {
    const sampleRate = 48000;
    const durationSamples = sampleRate; // 1.0 s

    const subBass = generateSine(48, sampleRate, durationSamples, 0.25);
    const midVoice = generateSine(1500, sampleRate, durationSamples, 0.25);
    const highTreble = generateSine(9500, sampleRate, durationSamples, 0.25);

    const results: Record<PresetId, { subDb: number; midDb: number; highDb: number }> =
      {} as Record<PresetId, { subDb: number; midDb: number; highDb: number }>;

    for (const presetId of PRESET_ORDER) {
      const pipeline = new VintageRadioPipeline(sampleRate);
      pipeline.updateParams(
        sanitizeDspParams({
          presetId,
          bypass: false,
          intensity: 0.75,
          noiseLevel: 0,
          tuningDrift: 0,
        }),
        true,
      );

      const settle = Math.floor(sampleRate * 0.25);
      const [subOut] = runPipelineBlocks(pipeline, subBass, subBass);
      pipeline.reset();
      const [midOut] = runPipelineBlocks(pipeline, midVoice, midVoice);
      pipeline.reset();
      const [highOut] = runPipelineBlocks(pipeline, highTreble, highTreble);

      results[presetId] = {
        subDb: measureRmsDb(subOut, settle),
        midDb: measureRmsDb(midOut, settle),
        highDb: measureRmsDb(highOut, settle),
      };
    }

    // Transistor Pocket (360 Hz HPF) must cut 65 Hz far deeper than Warm Tabletop (85 Hz HPF) or Clean Vintage (55 Hz HPF)
    expect(results['transistor-radio'].subDb).toBeLessThan(results['warm-tabletop'].subDb - 10);
    expect(results['warm-tabletop'].subDb).toBeLessThan(results['clean-vintage'].subDb - 1.5);

    // Mid-Century AM (4.2 kHz LPF) & Transistor (3.3 kHz LPF) must roll off 9.5 kHz far deeper than Clean Vintage (9.2 kHz LPF)
    expect(results['transistor-radio'].highDb).toBeLessThan(results['clean-vintage'].highDb - 18);
    expect(results['mid-century-am'].highDb).toBeLessThan(results['clean-vintage'].highDb - 12);

    // Log sweep 20 Hz - 20 kHz stability check across all presets
    const sweep = generateLogSweep(20, 20000, sampleRate, sampleRate);
    for (const presetId of PRESET_ORDER) {
      const pipeline = new VintageRadioPipeline(sampleRate);
      pipeline.updateParams(sanitizeDspParams({ presetId, noiseLevel: 0.2 }), true);
      const [outL, outR] = runPipelineBlocks(pipeline, sweep, sweep);
      expect(hasAllFiniteSamples(outL)).toBe(true);
      expect(hasAllFiniteSamples(outR)).toBe(true);
      expect(measurePeakLinear(outL)).toBeLessThanOrEqual(1.0);
    }
  });

  it('2. preserves missing-fundamental upper harmonics (130 Hz / 195 Hz / 390 Hz) when fed pure sub-bass', () => {
    const sampleRate = 48000;
    const pipeline = new VintageRadioPipeline(sampleRate);
    pipeline.updateParams(
      sanitizeDspParams({
        presetId: 'transistor-radio',
        intensity: 0.85,
        noiseLevel: 0,
        tuningDrift: 0,
      }),
      true,
    );

    // Pure 130 Hz bass note (below 360 Hz speaker cutoff, with ZERO overtones in input!)
    const bassIn = generateSine(130, sampleRate, sampleRate, 0.35);
    const [outL] = runPipelineBlocks(pipeline, bassIn, bassIn);
    const settle = Math.floor(sampleRate * 0.3);

    const h3At390 = measureToneMagnitudeLinear(outL, 390, sampleRate, settle);
    // Input had 0 energy at 390 Hz; pre-speaker excitation generates audible upper harmonic!
    expect(h3At390).toBeGreaterThan(0.002);
  });

  it('3. guarantees true zero-noise output on digital silence when noiseLevel = 0 and ducks idle static when enabled', () => {
    const sampleRate = 48000;
    const silence = generateSilence(sampleRate * 2);

    // Case A: noiseLevel = 0 -> exact silence output
    const zeroNoisePipe = new VintageRadioPipeline(sampleRate);
    zeroNoisePipe.updateParams(
      sanitizeDspParams({ presetId: 'mid-century-am', noiseLevel: 0 }),
      true,
    );
    const [silentOutL, silentOutR] = runPipelineBlocks(zeroNoisePipe, silence, silence);
    expect(measurePeakLinear(silentOutL)).toBe(0);
    expect(measurePeakLinear(silentOutR)).toBe(0);

    // Case B: Battery-powered Transistor Radio has ZERO 60 Hz mains hum even with noise at 80%
    const transistorPipe = new VintageRadioPipeline(sampleRate);
    transistorPipe.updateParams(
      sanitizeDspParams({
        presetId: 'transistor-radio',
        noiseLevel: 0.8,
        idleNoiseDucking: false,
      }),
      true,
    );
    const [trNoiseL] = runPipelineBlocks(transistorPipe, silence, silence);
    const hum60Transistor = measureToneMagnitudeLinear(
      trNoiseL,
      60,
      sampleRate,
      Math.floor(sampleRate * 0.5),
    );

    const aa5Pipe = new VintageRadioPipeline(sampleRate);
    aa5Pipe.updateParams(
      sanitizeDspParams({
        presetId: 'mid-century-am',
        noiseLevel: 0.8,
        idleNoiseDucking: false,
      }),
      true,
    );
    const [aa5NoiseL] = runPipelineBlocks(aa5Pipe, silence, silence);
    const hum60Aa5 = measureToneMagnitudeLinear(
      aa5NoiseL,
      60,
      sampleRate,
      Math.floor(sampleRate * 0.5),
    );

    expect(hum60Aa5).toBeGreaterThan(hum60Transistor * 4);

    // Case C: Idle Noise Ducking attenuates static after audio stops for >600 ms
    const totalSamples = sampleRate * 2; // 2 seconds: first 0.5s tone, remaining 1.5s silence
    const signalThenPause = new Float32Array(totalSamples);
    const toneHalfSec = generateSine(440, sampleRate, Math.floor(sampleRate * 0.5), 0.2);
    signalThenPause.set(toneHalfSec, 0);

    const duckPipe = new VintageRadioPipeline(sampleRate);
    duckPipe.updateParams(
      sanitizeDspParams({
        presetId: 'late-night-radio',
        noiseLevel: 0.6,
        idleNoiseDucking: true,
      }),
      true,
    );
    const [duckedOut] = runPipelineBlocks(duckPipe, signalThenPause, signalThenPause);

    // Compare noise immediately after tone stops (0.55s–0.75s, within hold window) vs after ducking settles (1.6s–1.95s)
    const activeNoiseDb = measureRmsDb(
      duckedOut,
      Math.floor(sampleRate * 0.55),
      Math.floor(sampleRate * 0.75),
    );
    const idleDuckedNoiseDb = measureRmsDb(
      duckedOut,
      Math.floor(sampleRate * 1.6),
      Math.floor(sampleRate * 1.95),
    );
    expect(idleDuckedNoiseDb).toBeLessThan(activeNoiseDb - 10);
  });

  it('4. handles mono and stereo signals cleanly without unexpected channel imbalance', () => {
    const sampleRate = 48000;
    const leftTone = generateSine(500, sampleRate, sampleRate, 0.25, 0);
    const rightTone = generateSine(800, sampleRate, sampleRate, 0.25, 0.7);

    // True mono preset ('mid-century-am', stereoWidth = 0) -> L and R outputs must be identical
    const monoPipe = new VintageRadioPipeline(sampleRate);
    monoPipe.updateParams(
      sanitizeDspParams({
        presetId: 'mid-century-am',
        stereoWidth: 0,
        noiseLevel: 0,
        tuningDrift: 0,
      }),
      true,
    );
    const [monoL, monoR] = runPipelineBlocks(monoPipe, leftTone, rightTone);
    let maxDiff = 0;
    for (let i = 0; i < monoL.length; i++) {
      maxDiff = Math.max(maxDiff, Math.abs(monoL[i] - monoR[i]));
    }
    expect(maxDiff).toBeLessThan(1e-6);

    // Stereo preset ('clean-vintage', stereoWidth = 0.65) -> preserves distinct L and R channels with balanced loudness
    const stereoPipe = new VintageRadioPipeline(sampleRate);
    stereoPipe.updateParams(
      sanitizeDspParams({
        presetId: 'clean-vintage',
        stereoWidth: 0.65,
        noiseLevel: 0,
        tuningDrift: 0,
      }),
      true,
    );
    const [stL, stR] = runPipelineBlocks(stereoPipe, leftTone, rightTone);
    let stereoDiff = 0;
    for (let i = Math.floor(sampleRate * 0.2); i < stL.length; i++) {
      stereoDiff = Math.max(stereoDiff, Math.abs(stL[i] - stR[i]));
    }
    expect(stereoDiff).toBeGreaterThan(0.05);
    const settle = Math.floor(sampleRate * 0.25);
    expect(Math.abs(measureRmsDb(stL, settle) - measureRmsDb(stR, settle))).toBeLessThan(0.5);
  });

  it('5. achieves loudness-matched A/B bypass (within ±1.5 dB on broadband musical composite & pink noise)', () => {
    const sampleRate = 48000;
    const [musicL, musicR] = generateMusicalComposite(sampleRate, sampleRate * 2, 0.158);
    const settle = Math.floor(sampleRate * 0.3);
    const dryDb = measureRmsDb(musicL, settle);

    for (const presetId of PRESET_ORDER) {
      const pipeline = new VintageRadioPipeline(sampleRate);
      pipeline.updateParams(
        sanitizeDspParams({
          presetId,
          bypass: false,
          intensity: 0.75,
          noiseLevel: PRESETS[presetId].dsp.defaultNoiseLevel,
        }),
        true,
      );
      const [wetL] = runPipelineBlocks(pipeline, musicL, musicR);
      const wetDb = measureRmsDb(wetL, settle);

      // No unfair loudness boost (> +1.5 dB) or severe volume drop (< -1.5 dB) across any profile!
      expect(wetDb - dryDb, `${presetId} upper loudness bound`).toBeLessThan(1.5);
      expect(wetDb - dryDb, `${presetId} lower loudness bound`).toBeGreaterThan(-1.5);
    }

    // Also verify Pink Noise & White Noise processing stability
    const pink = generatePinkNoise(sampleRate, 0.158);
    const white = generateWhiteNoise(sampleRate, 0.158);
    const pipe = new VintageRadioPipeline(sampleRate);
    pipe.updateParams(sanitizeDspParams({ presetId: 'warm-tabletop' }), true);
    const [pinkOut] = runPipelineBlocks(pipe, pink, pink);
    expect(Math.abs(measureRmsDb(pinkOut, settle) - measureRmsDb(pink, settle))).toBeLessThan(1.5);

    pipe.reset();
    const [whiteOut] = runPipelineBlocks(pipe, white, white);
    expect(hasAllFiniteSamples(whiteOut)).toBe(true);
  });

  it('6. handles unit impulses, -60 dBFS quiet signals, and +6 dBFS hot signals without NaN or hard clipping', () => {
    const sampleRate = 48000;
    const pipe = new VintageRadioPipeline(sampleRate);
    pipe.updateParams(
      sanitizeDspParams({ presetId: 'warm-tabletop', intensity: 1.0, noiseLevel: 0 }),
      true,
    );

    // Impulse
    const imp = generateImpulse(4096, 0.9, 10);
    const [impOut] = runPipelineBlocks(pipe, imp, imp);
    expect(hasAllFiniteSamples(impOut)).toBe(true);
    expect(measurePeakLinear(impOut, 3000)).toBeLessThan(1e-4);

    // -60 dBFS low-amplitude sine
    pipe.reset();
    const quiet = generateSine(1000, sampleRate, 12000, 0.001);
    const [quietOut] = runPipelineBlocks(pipe, quiet, quiet);
    expect(measureRmsDb(quietOut, 4000)).toBeGreaterThan(-65);
    expect(measureRmsDb(quietOut, 4000)).toBeLessThan(-55);

    // +6 dBFS hot input across extreme settings
    pipe.reset();
    pipe.updateParams(
      sanitizeDspParams({
        presetId: 'transistor-radio',
        intensity: 1.0,
        noiseLevel: 1.0,
        tuningDrift: 1.0,
      }),
      true,
    );
    const hot = generateSine(800, sampleRate, 24000, 2.0);
    const [hotOutL, hotOutR] = runPipelineBlocks(pipe, hot, hot);
    expect(hasAllFiniteSamples(hotOutL)).toBe(true);
    expect(hasAllFiniteSamples(hotOutR)).toBe(true);
    expect(measurePeakLinear(hotOutL)).toBeLessThanOrEqual(1.0);
    expect(measurePeakLinear(hotOutR)).toBeLessThanOrEqual(1.0);
  });

  it('7. transitions smoothly without clicks during rapid preset switches, parameter sweeps, and bypass toggles', () => {
    const sampleRate = 48000;
    const totalSamples = sampleRate * 2;
    // Low-frequency smooth 220 Hz sine wave makes any step click discontinuity stand out sharply!
    const smoothSine = generateSine(220, sampleRate, totalSamples, 0.35);

    const pipe = new VintageRadioPipeline(sampleRate);
    pipe.updateParams(sanitizeDspParams({ presetId: 'warm-tabletop', noiseLevel: 0 }), true);

    const [outL] = runPipelineBlocks(pipe, smoothSine, smoothSine, 128, (blockIdx) => {
      if (blockIdx === 80) {
        pipe.updateParams(sanitizeDspParams({ presetId: 'transistor-radio', noiseLevel: 0 }));
      } else if (blockIdx === 160) {
        pipe.updateParams(
          sanitizeDspParams({ presetId: 'transistor-radio', bypass: true, noiseLevel: 0 }),
        );
      } else if (blockIdx === 240) {
        pipe.updateParams(
          sanitizeDspParams({
            presetId: 'mid-century-am',
            bypass: false,
            intensity: 1.0,
            noiseLevel: 0,
          }),
        );
      } else if (blockIdx === 320) {
        pipe.updateParams(sanitizeDspParams({ presetId: 'clean-vintage', noiseLevel: 0 }));
      }
    });

    // Maximum natural step of a 220 Hz sine (amp 0.35) at 48 kHz is ~ 0.35 * 2*pi*220/48000 ≈ 0.0101.
    // Even with harmonics & resonance boost, click-free transitions should stay well below 0.08!
    const maxStep = measureMaxStepDelta(outL, 256);
    expect(maxStep).toBeLessThan(0.08);
  });

  it('8. maintains sample-rate independence (44.1 kHz, 48 kHz, 96 kHz) and 60s real-time stability & speed', () => {
    const rmsByRate: number[] = [];
    for (const sr of [44100, 48000, 96000]) {
      const [musicL, musicR] = generateMusicalComposite(sr, sr, 0.158);
      const pipe = new VintageRadioPipeline(sr);
      pipe.updateParams(
        sanitizeDspParams({ presetId: 'warm-tabletop', intensity: 0.75, noiseLevel: 0.15 }),
        true,
      );
      const [outL] = runPipelineBlocks(pipe, musicL, musicR);
      rmsByRate.push(measureRmsDb(outL, Math.floor(sr * 0.25)));
    }
    expect(Math.abs(rmsByRate[0] - rmsByRate[1])).toBeLessThan(0.6);
    expect(Math.abs(rmsByRate[1] - rmsByRate[2])).toBeLessThan(0.8);

    // 60-second continuous stereo playback stability & CPU budget measurement
    const sr = 48000;
    const blockL = generateSine(440, sr, 128, 0.25);
    const blockR = generateSine(554.37, sr, 128, 0.25);
    const outBlockL = new Float32Array(128);
    const outBlockR = new Float32Array(128);

    const longPipe = new VintageRadioPipeline(sr);
    longPipe.updateParams(
      sanitizeDspParams({
        presetId: 'late-night-radio',
        intensity: 0.85,
        noiseLevel: 0.3,
        tuningDrift: 0.35,
      }),
      true,
    );

    const totalBlocks = Math.ceil((sr * 60) / 128); // 22,500 blocks = 60s of stereo audio
    const t0 = performance.now();
    for (let b = 0; b < totalBlocks; b++) {
      longPipe.process(blockL, blockR, outBlockL, outBlockR);
    }
    const elapsedMs = performance.now() - t0;

    expect(hasAllFiniteSamples(outBlockL)).toBe(true);
    expect(hasAllFiniteSamples(outBlockR)).toBe(true);
    expect(measurePeakLinear(outBlockL)).toBeLessThanOrEqual(1.0);
    // 60,000 ms of stereo audio must process in well under 1,500 ms (< 2.5% single-core CPU)
    expect(elapsedMs).toBeLessThan(1500);
  });
});
