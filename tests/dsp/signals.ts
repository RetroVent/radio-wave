/**
 * Deterministic synthetic test signals and acoustic measurement utilities
 * for automated verification of the Vintage Radio DSP engine.
 */

export function generateSine(
  freqHz: number,
  sampleRate: number,
  numSamples: number,
  amplitude = 0.25,
  phaseRad = 0,
): Float32Array {
  const out = new Float32Array(numSamples);
  const omega = (2 * Math.PI * freqHz) / sampleRate;
  for (let i = 0; i < numSamples; i++) {
    out[i] = amplitude * Math.sin(omega * i + phaseRad);
  }
  return out;
}

export function generateLogSweep(
  fStartHz: number,
  fEndHz: number,
  sampleRate: number,
  numSamples: number,
  amplitude = 0.25,
): Float32Array {
  const out = new Float32Array(numSamples);
  const durationSec = numSamples / sampleRate;
  const k = Math.log(fEndHz / fStartHz);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const phase =
      (2 * Math.PI * fStartHz * durationSec * (Math.exp((k * t) / durationSec) - 1)) / k;
    out[i] = amplitude * Math.sin(phase);
  }
  return out;
}

export function generateImpulse(numSamples: number, amplitude = 1.0, offset = 0): Float32Array {
  const out = new Float32Array(numSamples);
  if (offset >= 0 && offset < numSamples) {
    out[offset] = amplitude;
  }
  return out;
}

export function generateSilence(numSamples: number): Float32Array {
  return new Float32Array(numSamples);
}

export function generateWhiteNoise(
  numSamples: number,
  amplitude = 0.2,
  seed = 0x12345678,
): Float32Array {
  const out = new Float32Array(numSamples);
  let state = seed >>> 0;
  for (let i = 0; i < numSamples; i++) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    const uniform = ((state >>> 0) / 0xffffffff) * 2 - 1;
    out[i] = uniform * amplitude;
  }
  return out;
}

export function generatePinkNoise(
  numSamples: number,
  targetRmsLinear = 0.158, // ~ -16 dBFS
  seed = 0x87654321,
): Float32Array {
  const white = generateWhiteNoise(numSamples, 1.0, seed);
  const out = new Float32Array(numSamples);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let sumSq = 0;
  for (let i = 0; i < numSamples; i++) {
    const w = white[i];
    b0 = 0.99765 * b0 + w * 0.099046;
    b1 = 0.963 * b1 + w * 0.2965164;
    b2 = 0.57 * b2 + w * 1.0526913;
    const sample = b0 + b1 + b2 + w * 0.1848;
    out[i] = sample;
    sumSq += sample * sample;
  }
  const currentRms = Math.sqrt(sumSq / numSamples) || 1;
  const scale = targetRmsLinear / currentRms;
  for (let i = 0; i < numSamples; i++) {
    out[i] *= scale;
  }
  return out;
}

/**
 * Generates a realistic broadband musical test signal combining:
 * - 65 Hz sub-bass fundamental
 * - Warm A-major7 harmonic chord (220, 277.18, 329.63, 415.3, 659.25, 1318.5 Hz)
 * - Vocal presence harmonic tones (2100 Hz, 3400 Hz)
 * - Air band shimmer (7500 Hz) + gentle pink texture
 */
export function generateMusicalComposite(
  sampleRate: number,
  numSamples: number,
  targetRmsLinear = 0.158, // ~ -16 dBFS
): [Float32Array, Float32Array] {
  const left = new Float32Array(numSamples);
  const right = new Float32Array(numSamples);
  const pinkL = generatePinkNoise(numSamples, 0.03, 101);
  const pinkR = generatePinkNoise(numSamples, 0.03, 202);
  const tones = [
    { f: 65, a: 0.28, panPhase: 0 },
    { f: 130, a: 0.18, panPhase: 0.05 },
    { f: 220, a: 0.24, panPhase: 0.2 },
    { f: 329.63, a: 0.2, panPhase: -0.25 },
    { f: 440, a: 0.18, panPhase: 0.15 },
    { f: 880, a: 0.14, panPhase: -0.3 },
    { f: 1760, a: 0.1, panPhase: 0.4 },
    { f: 2600, a: 0.07, panPhase: -0.2 },
    { f: 6800, a: 0.05, panPhase: 0.5 },
  ];

  let sumSq = 0;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const env = 0.85 + 0.15 * Math.sin(2 * Math.PI * 2.2 * t);
    let l = pinkL[i];
    let r = pinkR[i];
    for (const tone of tones) {
      const w = 2 * Math.PI * tone.f * t;
      l += tone.a * env * Math.sin(w);
      r += tone.a * env * Math.sin(w + tone.panPhase);
    }
    left[i] = l;
    right[i] = r;
    sumSq += 0.5 * (l * l + r * r);
  }

  const rms = Math.sqrt(sumSq / numSamples) || 1;
  const gain = targetRmsLinear / rms;
  for (let i = 0; i < numSamples; i++) {
    left[i] *= gain;
    right[i] *= gain;
  }
  return [left, right];
}

export function measureRmsLinear(
  signal: Float32Array,
  startSample = 0,
  endSample?: number,
): number {
  const end = endSample ?? signal.length;
  const count = end - startSample;
  if (count <= 0) return 0;
  let sumSq = 0;
  for (let i = startSample; i < end; i++) {
    sumSq += signal[i] * signal[i];
  }
  return Math.sqrt(sumSq / count);
}

export function measureRmsDb(signal: Float32Array, startSample = 0, endSample?: number): number {
  const rms = measureRmsLinear(signal, startSample, endSample);
  if (rms <= 1e-12) return -120;
  return 20 * Math.log10(rms);
}

export function measurePeakLinear(
  signal: Float32Array,
  startSample = 0,
  endSample?: number,
): number {
  const end = endSample ?? signal.length;
  let peak = 0;
  for (let i = startSample; i < end; i++) {
    const abs = Math.abs(signal[i]);
    if (abs > peak) peak = abs;
  }
  return peak;
}

export function measureMeanDc(signal: Float32Array, startSample = 0, endSample?: number): number {
  const end = endSample ?? signal.length;
  const count = end - startSample;
  if (count <= 0) return 0;
  let sum = 0;
  for (let i = startSample; i < end; i++) {
    sum += signal[i];
  }
  return sum / count;
}

export function measureMaxStepDelta(
  signal: Float32Array,
  startSample = 1,
  endSample?: number,
): number {
  const end = endSample ?? signal.length;
  let maxDelta = 0;
  for (let i = Math.max(1, startSample); i < end; i++) {
    const delta = Math.abs(signal[i] - signal[i - 1]);
    if (delta > maxDelta) maxDelta = delta;
  }
  return maxDelta;
}

/**
 * Goertzel / single-bin Hann-windowed DFT magnitude measurement at an exact frequency.
 */
export function measureToneMagnitudeLinear(
  signal: Float32Array,
  freqHz: number,
  sampleRate: number,
  startSample = 0,
  endSample?: number,
): number {
  const end = endSample ?? signal.length;
  const N = end - startSample;
  if (N <= 0) return 0;
  let real = 0;
  let imag = 0;
  const omega = (2 * Math.PI * freqHz) / sampleRate;
  for (let n = 0; n < N; n++) {
    const window = 0.5 * (1 - Math.cos((2 * Math.PI * n) / (N - 1)));
    const x = signal[startSample + n] * window;
    real += x * Math.cos(omega * n);
    imag -= x * Math.sin(omega * n);
  }
  // Coherent gain of Hann window is 0.5 -> multiply by 4 / N for peak sine amplitude
  return (4 * Math.hypot(real, imag)) / N;
}

export function hasAllFiniteSamples(signal: Float32Array): boolean {
  for (let i = 0; i < signal.length; i++) {
    if (!Number.isFinite(signal[i])) return false;
  }
  return true;
}
