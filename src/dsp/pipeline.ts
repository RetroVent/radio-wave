import {
  DEFAULT_PRESET_ID,
  NOMINAL_INTENSITY,
  PRESETS,
  sanitizeDspParams,
} from '../shared/presets';
import type {
  AudioTelemetry,
  DspRuntimeParams,
  FilterSlopeDb,
  SaturationMode,
} from '../shared/types';
import { BiquadFilter, ButterworthCascade } from './biquad';
import { applySafetyLimiter, ProgramCompressor } from './compressor';
import { RadioNoiseGenerator } from './noise';
import { applyPreSpeakerExcitation, SaturationStage } from './saturation';
import { OnePoleSmoother } from './smoother';
import { TuningAmbienceStage } from './tuning';

export interface ResolvedCurveTargets {
  highPassHz: number;
  highPassSlopeDb: FilterSlopeDb;
  lowPassHz: number;
  lowPassSlopeDb: FilterSlopeDb;
  cabinetHz: number;
  cabinetGainDb: number;
  cabinetQ: number;
  coneHz: number;
  coneGainDb: number;
  coneQ: number;
  preExcite: number;
  saturationMode: SaturationMode;
  saturationDrive: number;
  makeupGainDb: number;
}

/**
 * Computes scaled electroacoustic targets for a given preset and 0..1 macro Intensity.
 */
export function resolveTargetsForParams(params: DspRuntimeParams): ResolvedCurveTargets {
  const spec = PRESETS[params.presetId]?.dsp ?? PRESETS[DEFAULT_PRESET_ID].dsp;
  const intensity = params.intensity;

  if (intensity <= 0.0001) {
    return {
      highPassHz: 20,
      highPassSlopeDb: spec.highPassSlopeDb,
      lowPassHz: 20000,
      lowPassSlopeDb: spec.lowPassSlopeDb,
      cabinetHz: spec.cabinetResonanceHz,
      cabinetGainDb: 0,
      cabinetQ: spec.cabinetResonanceQ,
      coneHz: spec.conePresenceHz,
      coneGainDb: 0,
      coneQ: spec.conePresenceQ,
      preExcite: 0,
      saturationMode: spec.saturationMode,
      saturationDrive: 1.0,
      makeupGainDb: 0,
    };
  }

  if (intensity <= NOMINAL_INTENSITY) {
    const t = intensity / NOMINAL_INTENSITY;
    return {
      highPassHz: 20 * Math.pow(spec.highPassHz / 20, t),
      highPassSlopeDb: spec.highPassSlopeDb,
      lowPassHz: 20000 * Math.pow(spec.lowPassHz / 20000, t),
      lowPassSlopeDb: spec.lowPassSlopeDb,
      cabinetHz: spec.cabinetResonanceHz,
      cabinetGainDb: spec.cabinetResonanceGainDb * t,
      cabinetQ: spec.cabinetResonanceQ,
      coneHz: spec.conePresenceHz,
      coneGainDb: spec.conePresenceGainDb * t,
      coneQ: spec.conePresenceQ,
      preExcite: spec.preExciteAmount * t,
      saturationMode: spec.saturationMode,
      saturationDrive: 1 + (spec.saturationDrive - 1) * t,
      makeupGainDb: spec.makeupGainDb * t,
    };
  }

  // Pushing intensity above 75% up to 100% accentuates vintage character smoothly
  const extra = (intensity - NOMINAL_INTENSITY) / (1 - NOMINAL_INTENSITY);
  return {
    highPassHz: spec.highPassHz * (1 + 0.14 * extra),
    highPassSlopeDb: spec.highPassSlopeDb,
    lowPassHz: spec.lowPassHz * (1 - 0.12 * extra),
    lowPassSlopeDb: spec.lowPassSlopeDb,
    cabinetHz: spec.cabinetResonanceHz,
    cabinetGainDb: spec.cabinetResonanceGainDb * (1 + 0.22 * extra),
    cabinetQ: spec.cabinetResonanceQ * (1 + 0.1 * extra),
    coneHz: spec.conePresenceHz,
    coneGainDb: spec.conePresenceGainDb * (1 + 0.22 * extra),
    coneQ: spec.conePresenceQ * (1 + 0.1 * extra),
    preExcite: Math.min(0.5, spec.preExciteAmount * (1 + 0.25 * extra)),
    saturationMode: spec.saturationMode,
    saturationDrive: spec.saturationDrive * (1 + 0.28 * extra),
    makeupGainDb: spec.makeupGainDb * (1 + 0.08 * extra),
  };
}

/**
 * Computes analytical composite linear frequency response (in dB) across `frequenciesHz`
 * for plotting accurate passband curves in Popup and Signal Workbench.
 */
export function computeCompositeResponseDb(
  params: DspRuntimeParams,
  frequenciesHz: readonly number[],
  sampleRate = 48000,
): number[] {
  if (params.bypass || params.intensity <= 0.001) {
    return frequenciesHz.map(() => 0);
  }
  const targets = resolveTargetsForParams(params);
  const hpf = new ButterworthCascade('highpass', sampleRate);
  const lpf = new ButterworthCascade('lowpass', sampleRate);
  const cab = new BiquadFilter();
  const cone = new BiquadFilter();

  hpf.configure(targets.highPassHz, sampleRate, targets.highPassSlopeDb, true);
  lpf.configure(targets.lowPassHz, sampleRate, targets.lowPassSlopeDb, true);
  cab.configure('peaking', targets.cabinetHz, sampleRate, targets.cabinetQ, targets.cabinetGainDb);
  cone.configure('peaking', targets.coneHz, sampleRate, targets.coneQ, targets.coneGainDb);

  return frequenciesHz.map((f) => {
    const total =
      hpf.evaluateMagnitudeDb(f, sampleRate) +
      cab.evaluateMagnitudeDb(f, sampleRate) +
      cone.evaluateMagnitudeDb(f, sampleRate) +
      lpf.evaluateMagnitudeDb(f, sampleRate);
    return Math.max(-42, Math.min(12, total));
  });
}

/**
 * Complete stereo real-time Vintage Radio DSP pipeline.
 * Designed for zero heap allocations inside `process()` so it runs deterministically
 * inside an AudioWorkletProcessor as well as offline automated Vitest benchmarks.
 */
export class VintageRadioPipeline {
  private sampleRate: number;
  private params: DspRuntimeParams;
  private saturationMode: SaturationMode = 'asymmetric-tube';
  private highPassSlopeDb: FilterSlopeDb = 12;
  private lowPassSlopeDb: FilterSlopeDb = 12;
  private cabinetQ = 1.1;
  private coneQ = 0.9;

  // Per-channel filter cascades
  private readonly preDcHpfL = new BiquadFilter();
  private readonly preDcHpfR = new BiquadFilter();
  private readonly hpfL: ButterworthCascade;
  private readonly hpfR: ButterworthCascade;
  private readonly cabinetEqL = new BiquadFilter();
  private readonly cabinetEqR = new BiquadFilter();
  private readonly coneEqL = new BiquadFilter();
  private readonly coneEqR = new BiquadFilter();
  private readonly lpfL: ButterworthCascade;
  private readonly lpfR: ButterworthCascade;

  // Nonlinear, dynamics, noise, and tuning stages
  private readonly saturation: SaturationStage;
  private readonly compressor: ProgramCompressor;
  private readonly noiseGen: RadioNoiseGenerator;
  private readonly tuningStage: TuningAmbienceStage;

  // Smoothers for click-free live transitions
  private readonly wetEnableSmoother: OnePoleSmoother;
  private readonly stereoWidthSmoother: OnePoleSmoother;
  private readonly logHpSmoother: OnePoleSmoother;
  private readonly logLpSmoother: OnePoleSmoother;
  private readonly logCabHzSmoother: OnePoleSmoother;
  private readonly cabGainSmoother: OnePoleSmoother;
  private readonly logConeHzSmoother: OnePoleSmoother;
  private readonly coneGainSmoother: OnePoleSmoother;
  private readonly preExciteSmoother: OnePoleSmoother;
  private readonly driveSmoother: OnePoleSmoother;
  private readonly makeupLinearSmoother: OnePoleSmoother;

  private controlCounter = 0;

  // Telemetry accumulators (zero allocation)
  private lastInputRmsDb = -100;
  private lastOutputRmsDb = -100;
  private lastClipped = false;

  constructor(sampleRate = 48000) {
    this.sampleRate = Math.max(8000, sampleRate);
    this.params = sanitizeDspParams({ presetId: DEFAULT_PRESET_ID });

    this.hpfL = new ButterworthCascade('highpass', this.sampleRate);
    this.hpfR = new ButterworthCascade('highpass', this.sampleRate);
    this.lpfL = new ButterworthCascade('lowpass', this.sampleRate);
    this.lpfR = new ButterworthCascade('lowpass', this.sampleRate);

    this.saturation = new SaturationStage(this.sampleRate);
    this.compressor = new ProgramCompressor(this.sampleRate);
    this.noiseGen = new RadioNoiseGenerator(this.sampleRate);
    this.tuningStage = new TuningAmbienceStage(this.sampleRate);

    this.wetEnableSmoother = new OnePoleSmoother(1, 25, this.sampleRate);
    this.stereoWidthSmoother = new OnePoleSmoother(0.15, 25, this.sampleRate);
    this.logHpSmoother = new OnePoleSmoother(Math.log(85), 25, this.sampleRate);
    this.logLpSmoother = new OnePoleSmoother(Math.log(5800), 25, this.sampleRate);
    this.logCabHzSmoother = new OnePoleSmoother(Math.log(225), 25, this.sampleRate);
    this.cabGainSmoother = new OnePoleSmoother(3.0, 25, this.sampleRate);
    this.logConeHzSmoother = new OnePoleSmoother(Math.log(2100), 25, this.sampleRate);
    this.coneGainSmoother = new OnePoleSmoother(1.4, 25, this.sampleRate);
    this.preExciteSmoother = new OnePoleSmoother(0.14, 25, this.sampleRate);
    this.driveSmoother = new OnePoleSmoother(1.55, 25, this.sampleRate);
    this.makeupLinearSmoother = new OnePoleSmoother(1.1, 25, this.sampleRate);

    this.preDcHpfL.configure('highpass', 24, this.sampleRate, Math.SQRT1_2, 0);
    this.preDcHpfR.configure('highpass', 24, this.sampleRate, Math.SQRT1_2, 0);

    this.updateParams(this.params, true);
  }

  getParams(): DspRuntimeParams {
    return this.params;
  }

  getSampleRate(): number {
    return this.sampleRate;
  }

  updateParams(rawParams: Partial<DspRuntimeParams>, snap = false): void {
    const sanitized = sanitizeDspParams({ ...this.params, ...rawParams });
    this.params = sanitized;

    const presetSpec = PRESETS[sanitized.presetId].dsp;
    const targets = resolveTargetsForParams(sanitized);

    this.saturationMode = targets.saturationMode;
    this.highPassSlopeDb = targets.highPassSlopeDb;
    this.lowPassSlopeDb = targets.lowPassSlopeDb;
    this.cabinetQ = targets.cabinetQ;
    this.coneQ = targets.coneQ;

    const wetTarget =
      sanitized.bypass || sanitized.intensity <= 0.0001
        ? 0
        : sanitized.intensity < 0.15
          ? sanitized.intensity / 0.15
          : 1;

    const makeupLinear = Math.pow(10, targets.makeupGainDb / 20);

    if (snap) {
      this.wetEnableSmoother.snapTo(wetTarget);
      this.stereoWidthSmoother.snapTo(sanitized.stereoWidth);
      this.logHpSmoother.snapTo(Math.log(targets.highPassHz));
      this.logLpSmoother.snapTo(Math.log(targets.lowPassHz));
      this.logCabHzSmoother.snapTo(Math.log(targets.cabinetHz));
      this.cabGainSmoother.snapTo(targets.cabinetGainDb);
      this.logConeHzSmoother.snapTo(Math.log(targets.coneHz));
      this.coneGainSmoother.snapTo(targets.coneGainDb);
      this.preExciteSmoother.snapTo(targets.preExcite);
      this.driveSmoother.snapTo(targets.saturationDrive);
      this.makeupLinearSmoother.snapTo(makeupLinear);
    } else {
      this.wetEnableSmoother.setTarget(wetTarget);
      this.stereoWidthSmoother.setTarget(sanitized.stereoWidth);
      this.logHpSmoother.setTarget(Math.log(targets.highPassHz));
      this.logLpSmoother.setTarget(Math.log(targets.lowPassHz));
      this.logCabHzSmoother.setTarget(Math.log(targets.cabinetHz));
      this.cabGainSmoother.setTarget(targets.cabinetGainDb);
      this.logConeHzSmoother.setTarget(Math.log(targets.coneHz));
      this.coneGainSmoother.setTarget(targets.coneGainDb);
      this.preExciteSmoother.setTarget(targets.preExcite);
      this.driveSmoother.setTarget(targets.saturationDrive);
      this.makeupLinearSmoother.setTarget(makeupLinear);
    }

    // Scale compressor ratio smoothly with intensity
    const compRatio =
      1 +
      (presetSpec.compressorRatio - 1) * Math.min(1.15, sanitized.intensity / NOMINAL_INTENSITY);
    this.compressor.configure(
      presetSpec.compressorThresholdDb,
      compRatio,
      presetSpec.compressorAttackMs,
      presetSpec.compressorReleaseMs,
      this.sampleRate,
    );

    this.noiseGen.configureProfile(presetSpec.noiseProfile);
    this.noiseGen.setTargetLevel(sanitized.bypass ? 0 : sanitized.noiseLevel, snap);

    this.tuningStage.setTargetAmount(sanitized.bypass ? 0 : sanitized.tuningDrift, snap);

    this.applyFilterCoefficients(snap);
  }

  private applyFilterCoefficients(snap: boolean): void {
    const hpHz = Math.exp(this.logHpSmoother.getValue());
    const lpHz = Math.exp(this.logLpSmoother.getValue());
    const cabHz = Math.exp(this.logCabHzSmoother.getValue());
    const cabGain = this.cabGainSmoother.getValue();
    const coneHz = Math.exp(this.logConeHzSmoother.getValue());
    const coneGain = this.coneGainSmoother.getValue();

    this.hpfL.configure(hpHz, this.sampleRate, this.highPassSlopeDb, snap);
    this.hpfR.configure(hpHz, this.sampleRate, this.highPassSlopeDb, snap);
    this.lpfL.configure(lpHz, this.sampleRate, this.lowPassSlopeDb, snap);
    this.lpfR.configure(lpHz, this.sampleRate, this.lowPassSlopeDb, snap);

    this.cabinetEqL.configure('peaking', cabHz, this.sampleRate, this.cabinetQ, cabGain);
    this.cabinetEqR.configure('peaking', cabHz, this.sampleRate, this.cabinetQ, cabGain);
    this.coneEqL.configure('peaking', coneHz, this.sampleRate, this.coneQ, coneGain);
    this.coneEqR.configure('peaking', coneHz, this.sampleRate, this.coneQ, coneGain);
  }

  private areFilterSmoothersSettled(): boolean {
    return (
      this.logHpSmoother.isSettled(1e-5) &&
      this.logLpSmoother.isSettled(1e-5) &&
      this.logCabHzSmoother.isSettled(1e-5) &&
      this.cabGainSmoother.isSettled(1e-5) &&
      this.logConeHzSmoother.isSettled(1e-5) &&
      this.coneGainSmoother.isSettled(1e-5)
    );
  }

  reset(): void {
    this.preDcHpfL.reset();
    this.preDcHpfR.reset();
    this.hpfL.reset();
    this.hpfR.reset();
    this.cabinetEqL.reset();
    this.cabinetEqR.reset();
    this.coneEqL.reset();
    this.coneEqR.reset();
    this.lpfL.reset();
    this.lpfR.reset();
    this.saturation.reset();
    this.compressor.reset();
    this.noiseGen.reset();
    this.tuningStage.reset();
    this.controlCounter = 0;
  }

  getTelemetrySnapshot(timestamp = Date.now()): AudioTelemetry {
    return {
      inputRmsDb: this.lastInputRmsDb,
      outputRmsDb: this.lastOutputRmsDb,
      gainReductionDb: this.compressor.getGainReductionDb(),
      noiseGateGain: this.noiseGen.getDuckGateGain(),
      clipped: this.lastClipped,
      timestamp,
    };
  }

  /**
   * Real-time zero-allocation block processor.
   */
  process(
    leftIn: Float32Array,
    rightIn: Float32Array,
    leftOut: Float32Array,
    rightOut: Float32Array,
  ): void {
    const frames = leftOut.length;
    if (frames === 0) return;

    let inSumSq = 0;
    let outSumSq = 0;
    let blockClipped = false;

    const filtersMoving = !this.areFilterSmoothersSettled();

    for (let i = 0; i < frames; i++) {
      const dryL = Number.isFinite(leftIn[i]) ? leftIn[i] : 0;
      const dryR = Number.isFinite(rightIn[i]) ? rightIn[i] : 0;
      inSumSq += 0.5 * (dryL * dryL + dryR * dryR);

      // Advance filter parameter smoothers and refresh biquad coefficients every 32 samples while moving
      if (filtersMoving) {
        this.logHpSmoother.next();
        this.logLpSmoother.next();
        this.logCabHzSmoother.next();
        this.cabGainSmoother.next();
        this.logConeHzSmoother.next();
        this.coneGainSmoother.next();
        if ((this.controlCounter & 31) === 0) {
          this.applyFilterCoefficients(false);
        }
        this.controlCounter++;
      }

      const wetMix = this.wetEnableSmoother.next();
      const width = this.stereoWidthSmoother.next();
      const preExcite = this.preExciteSmoother.next();
      const drive = this.driveSmoother.next();
      const makeupGain = this.makeupLinearSmoother.next();

      // 1. Mid/Side Stereo Width & Mono Summing with gentle uncorrelated power compensation
      const mid = 0.5 * (dryL + dryR);
      const side = 0.5 * (dryL - dryR);
      const monoPowerComp = 1 + 0.08 * (1 - width);
      let sigL = (mid + width * side) * monoPowerComp;
      let sigR = (mid - width * side) * monoPowerComp;

      // 2. Sub-DC guard + Pre-speaker low-frequency harmonic excitation (missing fundamental)
      sigL = applyPreSpeakerExcitation(this.preDcHpfL.processSample(sigL), preExcite);
      sigR = applyPreSpeakerExcitation(this.preDcHpfR.processSample(sigR), preExcite);

      // 3. Speaker open-back dipole / cone resonance High-Pass Cascade
      sigL = this.hpfL.processSample(sigL);
      sigR = this.hpfR.processSample(sigR);

      // 4. Enclosure cavity & paper-cone breakup Formant EQs
      sigL = this.coneEqL.processSample(this.cabinetEqL.processSample(sigL));
      sigR = this.coneEqR.processSample(this.cabinetEqR.processSample(sigR));

      // 5. Nonlinear tube / germanium saturation (2x oversampled + 15 Hz DC blocker)
      sigL = this.saturation.processSample(sigL, 0, this.saturationMode, drive);
      sigR = this.saturation.processSample(sigR, 1, this.saturationMode, drive);

      // 6. IF selectivity & speaker high-frequency damping Low-Pass Cascade
      sigL = this.lpfL.processSample(sigL);
      sigR = this.lpfR.processSample(sigR);

      // 7. Optional ionospheric selective-fading / tuning drift
      const [tunedL, tunedR] = this.tuningStage.processStereo(sigL, sigR);
      sigL = tunedL;
      sigR = tunedR;

      // 8. Broadcast program compressor
      const [compL, compR] = this.compressor.processStereo(sigL, sigR);
      sigL = compL * makeupGain;
      sigR = compR * makeupGain;

      // 9. Colored RF/atmospheric noise + Idle Noise Ducking
      const inputPeak = Math.max(Math.abs(dryL), Math.abs(dryR));
      const monoNoise = this.noiseGen.nextSample(inputPeak, this.params.idleNoiseDucking);
      sigL += monoNoise;
      sigR += monoNoise;

      // 10. Loudness-matched Bypass / Wet crossfade & safety ceiling limiter
      const mixedL = dryL + wetMix * (sigL - dryL);
      const mixedR = dryR + wetMix * (sigR - dryR);

      const finalL = applySafetyLimiter(mixedL);
      const finalR = applySafetyLimiter(mixedR);

      if (Math.abs(mixedL) > 0.99 || Math.abs(mixedR) > 0.99) {
        blockClipped = true;
      }

      leftOut[i] = finalL;
      rightOut[i] = finalR;
      outSumSq += 0.5 * (finalL * finalL + finalR * finalR);
    }

    const inRms = Math.sqrt(inSumSq / frames);
    const outRms = Math.sqrt(outSumSq / frames);
    this.lastInputRmsDb = inRms > 1e-6 ? 20 * Math.log10(inRms) : -100;
    this.lastOutputRmsDb = outRms > 1e-6 ? 20 * Math.log10(outRms) : -100;
    this.lastClipped = blockClipped;
  }
}
