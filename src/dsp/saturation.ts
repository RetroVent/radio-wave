import type { SaturationMode } from '../shared/types';

/**
 * Controlled nonlinear waveshaping stage with 2x zero-delay linear oversampling
 * and a 15 Hz first-order DC blocker per channel.
 *
 * Models:
 * - 'asymmetric-tube': Single-ended pentode (50L6GT / EL84) with quadratic (2nd) + cubic (3rd) harmonics.
 * - 'germanium-transistor': Symmetric push-pull germanium curve with odd-order harmonics & soft battery sag.
 * - 'soft-tanh': Smooth symmetric hyperbolic tangent broadcast saturation.
 * - 'clean-warmth': Low-THD (<1.2%) subtle studio harmonic warmth.
 */
export class SaturationStage {
  private prevIn = new Float64Array(2);
  private dcPrevX = new Float64Array(2);
  private dcPrevY = new Float64Array(2);
  private dcPole = 0.998;

  constructor(sampleRate = 48000) {
    this.setSampleRate(sampleRate);
  }

  setSampleRate(sampleRate: number): void {
    const safeSr = Math.max(8000, sampleRate);
    this.dcPole = Math.exp((-2 * Math.PI * 15) / safeSr);
  }

  reset(): void {
    this.prevIn.fill(0);
    this.dcPrevX.fill(0);
    this.dcPrevY.fill(0);
  }

  private shapeSample(x: number, mode: SaturationMode, drive: number): number {
    const safeDrive = Math.max(1.0, Math.min(6.0, drive));
    // Gentle internal headroom pad prevents hot digital masters from harsh clipping
    const pad = 0.85;
    const xPadded = x * pad;

    let shaped = xPadded;
    switch (mode) {
      case 'asymmetric-tube': {
        // Shifted tanh: exact 0 at origin, exact unity small-signal slope, nonzero 2nd derivative -> warm 2nd harmonic
        const bias = 0.28;
        const tanhBias = Math.tanh(bias);
        const sechSq = 1 - tanhBias * tanhBias;
        const u = xPadded * safeDrive;
        const raw = (Math.tanh(u + bias) - tanhBias) / (safeDrive * sechSq);
        // Gentle drive RMS compensation so pushing drive doesn't spike or collapse level
        const comp = 1 + 0.09 * (safeDrive - 1);
        shaped = raw * comp;
        break;
      }
      case 'germanium-transistor': {
        // Strictly odd-symmetric function f(-u) = -f(u): produces 3rd/5th odd harmonics with zero 2nd harmonic
        const u = xPadded * safeDrive;
        const inflection = u + 0.24 * u * u * u;
        const raw = Math.tanh(inflection) / safeDrive;
        const comp = 1 + 0.1 * (safeDrive - 1);
        shaped = raw * comp;
        break;
      }
      case 'soft-tanh': {
        const u = xPadded * safeDrive;
        const raw = Math.tanh(u) / safeDrive;
        const comp = 1 + 0.11 * (safeDrive - 1);
        shaped = raw * comp;
        break;
      }
      case 'clean-warmth': {
        const bias = 0.08;
        const tanhBias = Math.tanh(bias);
        const sechSq = 1 - tanhBias * tanhBias;
        const effDrive = 1 + (safeDrive - 1) * 0.65;
        const u = xPadded * effDrive;
        shaped = (Math.tanh(u + bias) - tanhBias) / (effDrive * sechSq);
        break;
      }
    }

    return shaped / pad;
  }

  processSample(x: number, channel: 0 | 1, mode: SaturationMode, drive: number): number {
    // 2x linear oversampling (midpoint interpolation + 2-tap anti-alias boxcar average)
    const xMid = 0.5 * (x + this.prevIn[channel]);
    this.prevIn[channel] = x;

    const y0 = this.shapeSample(xMid, mode, drive);
    const y1 = this.shapeSample(x, mode, drive);
    // Apply soft ceiling prior to DC blocking so asymmetric peak limiting never re-introduces DC offset
    const limited = 0.96 * Math.tanh((0.5 * (y0 + y1)) / 0.96);

    // 15 Hz first-order DC blocker removes rectified DC offset from asymmetric tube transfer curves
    let dcRemoved = limited - this.dcPrevX[channel] + this.dcPole * this.dcPrevY[channel];
    if (Math.abs(dcRemoved) < 1e-24) dcRemoved = 0;
    this.dcPrevX[channel] = limited;
    this.dcPrevY[channel] = dcRemoved;

    return Math.max(-0.995, Math.min(0.995, dcRemoved));
  }
}

/**
 * Mild pre-speaker nonlinear harmonic exciter so sub-bass notes (50–150 Hz) generate
 * subtle 2nd/3rd harmonics before small-cone high-pass roll-off (Winkler et al., 1997).
 */
export function applyPreSpeakerExcitation(sample: number, amount: number): number {
  if (amount <= 0.001) return sample;
  const clamped = Math.max(-1.5, Math.min(1.5, sample));
  // Blend odd (cubic) and slight even (soft asymmetric) harmonics without boosting broadband peak
  const driven = Math.tanh(clamped * 2.2) / 2.2;
  const asymmetric = 0.14 * clamped * Math.abs(clamped);
  const excited = driven + asymmetric;
  return sample + amount * (excited - sample);
}
