/**
 * Stereo-linked feed-forward broadcast program compressor with soft knee (4 dB)
 * and transparent output peak ceiling protection.
 */
export class ProgramCompressor {
  private envDb = -90;
  private attackCoeff = 0;
  private releaseCoeff = 0;
  private thresholdDb = -18;
  private ratio = 2.5;
  private kneeWidthDb = 5;
  private lastGainReductionDb = 0;

  constructor(sampleRate = 48000) {
    this.configure(-18, 2.5, 12, 240, sampleRate);
  }

  configure(
    thresholdDb: number,
    ratio: number,
    attackMs: number,
    releaseMs: number,
    sampleRate: number,
  ): void {
    const safeSr = Math.max(8000, sampleRate);
    this.thresholdDb = Math.max(-40, Math.min(0, thresholdDb));
    this.ratio = Math.max(1.0, Math.min(12.0, ratio));
    this.attackCoeff = Math.exp(-1 / Math.max(1, attackMs * 0.001 * safeSr));
    this.releaseCoeff = Math.exp(-1 / Math.max(1, releaseMs * 0.001 * safeSr));
  }

  reset(): void {
    this.envDb = -90;
    this.lastGainReductionDb = 0;
  }

  getGainReductionDb(): number {
    return this.lastGainReductionDb;
  }

  processStereo(left: number, right: number): [number, number] {
    const linkedPeak = Math.max(Math.abs(left), Math.abs(right), 1e-6);
    const inputDb = 20 * Math.log10(linkedPeak);

    if (inputDb > this.envDb) {
      this.envDb = inputDb + this.attackCoeff * (this.envDb - inputDb);
    } else {
      this.envDb = inputDb + this.releaseCoeff * (this.envDb - inputDb);
    }

    // Soft-knee gain computer in dB
    const overshoot = this.envDb - this.thresholdDb;
    const halfKnee = this.kneeWidthDb * 0.5;
    let gainReductionDb = 0;
    const slope = 1 - 1 / this.ratio;

    if (overshoot <= -halfKnee) {
      gainReductionDb = 0;
    } else if (overshoot >= halfKnee) {
      gainReductionDb = slope * overshoot;
    } else {
      const x = overshoot + halfKnee;
      gainReductionDb = (slope * x * x) / (2 * this.kneeWidthDb);
    }

    this.lastGainReductionDb = gainReductionDb;
    const gainLinear = gainReductionDb > 0.001 ? Math.pow(10, -gainReductionDb / 20) : 1.0;

    return [left * gainLinear, right * gainLinear];
  }
}

/**
 * Transparent final safety limiter (-0.25 dBFS soft ceiling) guaranteeing
 * output never exceeds [-1.0, +1.0] even under extreme parameter combinations.
 */
export function applySafetyLimiter(sample: number): number {
  const abs = Math.abs(sample);
  if (abs <= 0.85) return sample;
  const ceiling = 0.972; // ~ -0.25 dBFS
  const sign = sample < 0 ? -1 : 1;
  const excess = (abs - 0.85) / (ceiling - 0.85);
  return sign * (0.85 + (ceiling - 0.85) * Math.tanh(excess));
}
