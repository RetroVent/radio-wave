import { describe, expect, it } from 'vitest';
import { SaturationStage } from '../../src/dsp/saturation';
import {
  generateSine,
  hasAllFiniteSamples,
  measureMeanDc,
  measurePeakLinear,
  measureToneMagnitudeLinear,
} from './signals';

describe('SaturationStage & DC Blocking', () => {
  it('generates measurable 2nd harmonic in asymmetric-tube mode while stripping DC offset', () => {
    const sampleRate = 48000;
    const numSamples = sampleRate;
    const sat = new SaturationStage(sampleRate);
    const input = generateSine(1000, sampleRate, numSamples, 0.45);
    const output = new Float32Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
      output[i] = sat.processSample(input[i], 0, 'asymmetric-tube', 2.2);
    }

    const settle = Math.floor(sampleRate * 0.35);
    const fundamental = measureToneMagnitudeLinear(output, 1000, sampleRate, settle);
    const secondHarmonic = measureToneMagnitudeLinear(output, 2000, sampleRate, settle);
    const thirdHarmonic = measureToneMagnitudeLinear(output, 3000, sampleRate, settle);
    const dcOffset = Math.abs(measureMeanDc(output, settle));

    expect(fundamental).toBeGreaterThan(0.3);
    // Asymmetric single-ended tube model must produce clear 2nd harmonic energy
    expect(secondHarmonic / fundamental).toBeGreaterThan(0.015);
    expect(secondHarmonic).toBeGreaterThan(thirdHarmonic * 0.5);
    // 15 Hz DC blocker must remove rectified DC offset
    expect(dcOffset).toBeLessThan(1e-3);
  });

  it('generates predominantly odd-order harmonics in symmetric germanium-transistor mode', () => {
    const sampleRate = 48000;
    const numSamples = sampleRate;
    const sat = new SaturationStage(sampleRate);
    const input = generateSine(1000, sampleRate, numSamples, 0.45);
    const output = new Float32Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
      output[i] = sat.processSample(input[i], 0, 'germanium-transistor', 2.2);
    }

    const settle = Math.floor(sampleRate * 0.35);
    const secondHarmonic = measureToneMagnitudeLinear(output, 2000, sampleRate, settle);
    const thirdHarmonic = measureToneMagnitudeLinear(output, 3000, sampleRate, settle);

    expect(thirdHarmonic).toBeGreaterThan(secondHarmonic * 4);
  });

  it('remains bounded (< 1.0) and finite even on +6 dBFS (amplitude 2.0) hot inputs', () => {
    const sampleRate = 48000;
    const sat = new SaturationStage(sampleRate);
    const hotInput = generateSine(440, sampleRate, 12000, 2.0);
    const output = new Float32Array(12000);

    for (const mode of [
      'asymmetric-tube',
      'soft-tanh',
      'germanium-transistor',
      'clean-warmth',
    ] as const) {
      sat.reset();
      for (let i = 0; i < hotInput.length; i++) {
        output[i] = sat.processSample(hotInput[i], 0, mode, 3.5);
      }
      expect(hasAllFiniteSamples(output)).toBe(true);
      expect(measurePeakLinear(output)).toBeLessThanOrEqual(1.0);
    }
  });
});
