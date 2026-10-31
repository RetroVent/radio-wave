/**
 * Sample-rate-independent one-pole exponential parameter smoother.
 * Eliminates zipper noise and step clicks during real-time parameter or preset transitions.
 */
export class OnePoleSmoother {
  private current: number;
  private target: number;
  private coeff = 0;

  constructor(initialValue: number, timeConstantMs: number, sampleRate: number) {
    this.current = initialValue;
    this.target = initialValue;
    this.setSampleRate(timeConstantMs, sampleRate);
  }

  setSampleRate(timeConstantMs: number, sampleRate: number): void {
    const tauSamples = Math.max(1, timeConstantMs * 0.001 * sampleRate);
    this.coeff = Math.exp(-1 / tauSamples);
  }

  setTarget(value: number): void {
    this.target = value;
  }

  snapTo(value: number): void {
    this.current = value;
    this.target = value;
  }

  getValue(): number {
    return this.current;
  }

  getTarget(): number {
    return this.target;
  }

  isSettled(epsilon = 1e-6): boolean {
    return Math.abs(this.target - this.current) <= epsilon;
  }

  next(): number {
    const diff = this.current - this.target;
    if (Math.abs(diff) <= 1e-7) {
      this.current = this.target;
      return this.current;
    }
    this.current = this.target + this.coeff * diff;
    return this.current;
  }
}
