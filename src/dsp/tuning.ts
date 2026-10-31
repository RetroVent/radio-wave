import { BiquadFilter } from './biquad';
import { OnePoleSmoother } from './smoother';

/**
 * Optional ionospheric skywave selective-fading and RF alignment drift stage.
 *
 * Unlike tape/vinyl wow & flutter (which warps musical pitch), real AM/shortwave tuning
 * and multipath skywave fading sweep a shallow phase-cancellation notch across the
 * midrange (680–2,350 Hz) at 0.09–0.18 Hz with subtle envelope breathing.
 */
export class TuningAmbienceStage {
  private sampleRate: number;
  private lfoPhase = 0;
  private heterodynePhase = 0;
  private samplesUntilFilterUpdate = 0;
  private readonly amountSmoother: OnePoleSmoother;
  private readonly notchL = new BiquadFilter();
  private readonly notchR = new BiquadFilter();

  constructor(sampleRate = 48000) {
    this.sampleRate = Math.max(8000, sampleRate);
    this.amountSmoother = new OnePoleSmoother(0, 30, this.sampleRate);
    this.notchL.configure('peaking', 1200, this.sampleRate, 1.8, 0);
    this.notchR.configure('peaking', 1200, this.sampleRate, 1.8, 0);
  }

  setSampleRate(sampleRate: number): void {
    this.sampleRate = Math.max(8000, sampleRate);
    this.amountSmoother.setSampleRate(30, this.sampleRate);
  }

  setTargetAmount(amount: number, snap = false): void {
    const clamped = Math.max(0, Math.min(1, amount));
    if (snap) {
      this.amountSmoother.snapTo(clamped);
    } else {
      this.amountSmoother.setTarget(clamped);
    }
  }

  reset(): void {
    this.lfoPhase = 0;
    this.heterodynePhase = 0;
    this.samplesUntilFilterUpdate = 0;
    this.notchL.reset();
    this.notchR.reset();
  }

  processStereo(left: number, right: number): [number, number] {
    if (this.amountSmoother.getTarget() === 0 && this.amountSmoother.isSettled(1e-6)) {
      this.amountSmoother.snapTo(0);
      return [left, right];
    }

    const amount = this.amountSmoother.next();

    // Slow 0.13 Hz ionospheric fading LFO
    const lfoInc = (2 * Math.PI * 0.13) / this.sampleRate;
    this.lfoPhase += lfoInc;
    if (this.lfoPhase > 2 * Math.PI) this.lfoPhase -= 2 * Math.PI;

    const lfoSin = Math.sin(this.lfoPhase);
    const lfoCos = Math.cos(this.lfoPhase * 0.71 + 0.9);

    if (this.samplesUntilFilterUpdate <= 0) {
      const centerHz = 1350 + 680 * lfoSin;
      const dipDb = -5.5 * amount;
      this.notchL.configure('peaking', centerHz, this.sampleRate, 1.7, dipDb);
      this.notchR.configure('peaking', centerHz * (1 + 0.04 * lfoCos), this.sampleRate, 1.7, dipDb);
      this.samplesUntilFilterUpdate = 64;
    }
    this.samplesUntilFilterUpdate--;

    // Gentle AGC fading breath (+/- 1.2 dB max)
    const fadeGain = 1 - 0.12 * amount * (0.5 + 0.5 * lfoCos);

    // Extremely faint adjacent-carrier heterodyne whisper only when user pushes drift > 45%
    let heterodyne = 0;
    if (amount > 0.45) {
      const hetFreq = 1680 + 90 * lfoSin;
      this.heterodynePhase += (2 * Math.PI * hetFreq) / this.sampleRate;
      if (this.heterodynePhase > 2 * Math.PI) this.heterodynePhase -= 2 * Math.PI;
      heterodyne = (amount - 0.45) * 0.0035 * Math.sin(this.heterodynePhase);
    }

    const outL = this.notchL.processSample(left) * fadeGain + heterodyne;
    const outR = this.notchR.processSample(right) * fadeGain + heterodyne;
    return [outL, outR];
  }
}
