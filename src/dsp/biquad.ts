import type { FilterSlopeDb } from '../shared/types';
import { OnePoleSmoother } from './smoother';

export type BiquadType = 'lowpass' | 'highpass' | 'peaking' | 'notch';

const DENORMAL_GUARD = 1e-24;
const Q_BUTTERWORTH_2ND = Math.SQRT1_2; // 0.7071067811865476
const Q_BUTTERWORTH_4TH_A = 0.541196100146197; // 1 / (2 * cos(pi/8))
const Q_BUTTERWORTH_4TH_B = 1.3065629648763766; // 1 / (2 * cos(3*pi/8))

/**
 * Direct Form II Transposed biquad filter using Robert Bristow-Johnson's
 * Audio EQ Cookbook bilinear transform equations.
 */
export class BiquadFilter {
  private b0 = 1;
  private b1 = 0;
  private b2 = 0;
  private a1 = 0;
  private a2 = 0;

  private z1 = 0;
  private z2 = 0;

  configure(
    type: BiquadType,
    freqHz: number,
    sampleRate: number,
    q = Q_BUTTERWORTH_2ND,
    gainDb = 0,
  ): void {
    const safeSr = Math.max(8000, sampleRate);
    const clampedFreq = Math.min(safeSr * 0.485, Math.max(12, freqHz));
    const clampedQ = Math.min(18, Math.max(0.12, q));

    const w0 = (2 * Math.PI * clampedFreq) / safeSr;
    const cosW0 = Math.cos(w0);
    const sinW0 = Math.sin(w0);
    const alpha = sinW0 / (2 * clampedQ);

    let b0 = 1;
    let b1 = 0;
    let b2 = 0;
    let a0 = 1;
    let a1 = 0;
    let a2 = 0;

    switch (type) {
      case 'lowpass': {
        const oneMinusCos = 1 - cosW0;
        b0 = oneMinusCos * 0.5;
        b1 = oneMinusCos;
        b2 = oneMinusCos * 0.5;
        a0 = 1 + alpha;
        a1 = -2 * cosW0;
        a2 = 1 - alpha;
        break;
      }
      case 'highpass': {
        const onePlusCos = 1 + cosW0;
        b0 = onePlusCos * 0.5;
        b1 = -onePlusCos;
        b2 = onePlusCos * 0.5;
        a0 = 1 + alpha;
        a1 = -2 * cosW0;
        a2 = 1 - alpha;
        break;
      }
      case 'peaking': {
        const amp = Math.pow(10, gainDb / 40);
        b0 = 1 + alpha * amp;
        b1 = -2 * cosW0;
        b2 = 1 - alpha * amp;
        a0 = 1 + alpha / amp;
        a1 = -2 * cosW0;
        a2 = 1 - alpha / amp;
        break;
      }
      case 'notch': {
        b0 = 1;
        b1 = -2 * cosW0;
        b2 = 1;
        a0 = 1 + alpha;
        a1 = -2 * cosW0;
        a2 = 1 - alpha;
        break;
      }
    }

    const invA0 = 1 / a0;
    this.b0 = b0 * invA0;
    this.b1 = b1 * invA0;
    this.b2 = b2 * invA0;
    this.a1 = a1 * invA0;
    this.a2 = a2 * invA0;
  }

  processSample(x: number): number {
    const y = this.b0 * x + this.z1;
    let nextZ1 = this.b1 * x - this.a1 * y + this.z2;
    let nextZ2 = this.b2 * x - this.a2 * y;

    if (Math.abs(nextZ1) < DENORMAL_GUARD) nextZ1 = 0;
    if (Math.abs(nextZ2) < DENORMAL_GUARD) nextZ2 = 0;

    this.z1 = nextZ1;
    this.z2 = nextZ2;
    return y;
  }

  reset(): void {
    this.z1 = 0;
    this.z2 = 0;
  }

  /**
   * Exact analytical complex transfer magnitude |H(e^{jw})| in dB.
   * Used both for automated unit verification and UI frequency-response curves.
   */
  evaluateMagnitudeDb(freqHz: number, sampleRate: number): number {
    const w = (2 * Math.PI * Math.max(1, Math.min(sampleRate * 0.499, freqHz))) / sampleRate;
    const cos1 = Math.cos(w);
    const sin1 = Math.sin(w);
    const cos2 = Math.cos(2 * w);
    const sin2 = Math.sin(2 * w);

    const numRe = this.b0 + this.b1 * cos1 + this.b2 * cos2;
    const numIm = -this.b1 * sin1 - this.b2 * sin2;
    const denRe = 1 + this.a1 * cos1 + this.a2 * cos2;
    const denIm = -this.a1 * sin1 - this.a2 * sin2;

    const numMagSq = numRe * numRe + numIm * numIm;
    const denMagSq = Math.max(1e-24, denRe * denRe + denIm * denIm);
    return 10 * Math.log10(Math.max(1e-12, numMagSq / denMagSq));
  }
}

/**
 * True maximally flat 2nd-order (12 dB/oct) or 4th-order (24 dB/oct) Butterworth filter cascade
 * with click-free continuous crossfading when transitioning between 12 and 24 dB/oct presets.
 */
export class ButterworthCascade {
  private readonly mode: 'lowpass' | 'highpass';
  private readonly stage1 = new BiquadFilter();
  private readonly stage2 = new BiquadFilter();
  private readonly stage2MixSmoother: OnePoleSmoother;
  private currentFreqHz = 1000;
  private currentSampleRate = 48000;
  private currentSlope: FilterSlopeDb = 12;
  private initialized = false;

  constructor(mode: 'lowpass' | 'highpass', sampleRate = 48000) {
    this.mode = mode;
    this.currentSampleRate = sampleRate;
    this.stage2MixSmoother = new OnePoleSmoother(0, 22, sampleRate);
  }

  configure(freqHz: number, sampleRate: number, slopeDb: FilterSlopeDb, snap = false): void {
    const shouldSnap = snap || !this.initialized;
    this.initialized = true;
    this.currentFreqHz = freqHz;
    this.currentSampleRate = sampleRate;
    this.currentSlope = slopeDb;

    const targetMix = slopeDb === 24 ? 1 : 0;
    if (shouldSnap) {
      this.stage2MixSmoother.setSampleRate(22, sampleRate);
      this.stage2MixSmoother.snapTo(targetMix);
    } else {
      this.stage2MixSmoother.setTarget(targetMix);
    }

    const mix = this.stage2MixSmoother.getValue();
    const q1 = Q_BUTTERWORTH_2ND + mix * (Q_BUTTERWORTH_4TH_A - Q_BUTTERWORTH_2ND);
    this.stage1.configure(this.mode, freqHz, sampleRate, q1, 0);
    this.stage2.configure(this.mode, freqHz, sampleRate, Q_BUTTERWORTH_4TH_B, 0);
  }

  processSample(x: number): number {
    const mix = this.stage2MixSmoother.next();
    const y1 = this.stage1.processSample(x);
    const y2 = this.stage2.processSample(y1);
    return y1 + mix * (y2 - y1);
  }

  evaluateMagnitudeDb(freqHz: number, sampleRate = this.currentSampleRate): number {
    const d1 = this.stage1.evaluateMagnitudeDb(freqHz, sampleRate);
    if (this.currentSlope === 12) return d1;
    return d1 + this.stage2.evaluateMagnitudeDb(freqHz, sampleRate);
  }

  getCutoffHz(): number {
    return this.currentFreqHz;
  }

  reset(): void {
    this.stage1.reset();
    this.stage2.reset();
  }
}
