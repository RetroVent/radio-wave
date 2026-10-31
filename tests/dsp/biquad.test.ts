import { describe, expect, it } from 'vitest';
import { BiquadFilter, ButterworthCascade } from '../../src/dsp/biquad';
import {
  generateImpulse,
  generateSine,
  hasAllFiniteSamples,
  measurePeakLinear,
  measureRmsDb,
} from './signals';

describe('BiquadFilter & ButterworthCascade', () => {
  it('achieves accurate -3 dB cutoff on 2nd-order Butterworth lowpass across sample rates', () => {
    for (const sampleRate of [44100, 48000, 96000]) {
      const filter = new BiquadFilter();
      filter.configure('lowpass', 3000, sampleRate, Math.SQRT1_2, 0);

      const passSine = generateSine(300, sampleRate, sampleRate, 0.5);
      const cutoffSine = generateSine(3000, sampleRate, sampleRate, 0.5);
      const stopSine = generateSine(12000, sampleRate, sampleRate, 0.5);

      const passOut = new Float32Array(sampleRate);
      const cutoffOut = new Float32Array(sampleRate);
      const stopOut = new Float32Array(sampleRate);

      for (let i = 0; i < sampleRate; i++) passOut[i] = filter.processSample(passSine[i]);
      filter.reset();
      for (let i = 0; i < sampleRate; i++) cutoffOut[i] = filter.processSample(cutoffSine[i]);
      filter.reset();
      for (let i = 0; i < sampleRate; i++) stopOut[i] = filter.processSample(stopSine[i]);

      const settle = Math.floor(sampleRate * 0.2);
      const inDb = measureRmsDb(passSine, settle);
      const passGainDb = measureRmsDb(passOut, settle) - inDb;
      const cutoffGainDb = measureRmsDb(cutoffOut, settle) - inDb;
      const stopGainDb = measureRmsDb(stopOut, settle) - inDb;

      expect(Math.abs(passGainDb)).toBeLessThan(0.15);
      expect(cutoffGainDb).toBeCloseTo(-3.01, 1);
      expect(stopGainDb).toBeLessThan(-20);
    }
  });

  it('delivers steeper 24 dB/oct attenuation on 4th-order ButterworthCascade than 12 dB/oct', () => {
    const sampleRate = 48000;
    const cascade12 = new ButterworthCascade('highpass');
    const cascade24 = new ButterworthCascade('highpass');
    cascade12.configure(360, sampleRate, 12);
    cascade24.configure(360, sampleRate, 24);

    // One octave below 360 Hz -> 180 Hz
    const subSine = generateSine(180, sampleRate, sampleRate, 0.5);
    const out12 = new Float32Array(sampleRate);
    const out24 = new Float32Array(sampleRate);

    for (let i = 0; i < sampleRate; i++) {
      out12[i] = cascade12.processSample(subSine[i]);
      out24[i] = cascade24.processSample(subSine[i]);
    }

    const settle = Math.floor(sampleRate * 0.25);
    const inDb = measureRmsDb(subSine, settle);
    const atten12 = measureRmsDb(out12, settle) - inDb;
    const atten24 = measureRmsDb(out24, settle) - inDb;

    expect(atten12).toBeCloseTo(-12.0, 0);
    expect(atten24).toBeCloseTo(-24.0, 0);
  });

  it('matches analytical evaluateMagnitudeDb against time-domain steady-state sine response', () => {
    const sampleRate = 48000;
    const eq = new BiquadFilter();
    eq.configure('peaking', 2200, sampleRate, 1.4, 4.5);

    for (const testHz of [200, 1000, 2200, 6000]) {
      eq.reset();
      const input = generateSine(testHz, sampleRate, sampleRate, 0.25);
      const output = new Float32Array(sampleRate);
      for (let i = 0; i < sampleRate; i++) output[i] = eq.processSample(input[i]);

      const settle = Math.floor(sampleRate * 0.2);
      const empiricalDb = measureRmsDb(output, settle) - measureRmsDb(input, settle);
      const analyticalDb = eq.evaluateMagnitudeDb(testHz, sampleRate);
      expect(empiricalDb).toBeCloseTo(analyticalDb, 1);
    }
  });

  it('decays cleanly to zero on unit impulse and safely clamps extreme cutoffs near Nyquist', () => {
    const filter = new BiquadFilter();
    filter.configure('lowpass', 99000, 44100, 2.0, 0);
    const impulse = generateImpulse(4096, 1.0, 0);
    const out = new Float32Array(4096);
    for (let i = 0; i < impulse.length; i++) out[i] = filter.processSample(impulse[i]);

    expect(hasAllFiniteSamples(out)).toBe(true);
    // Tail after 2048 samples should decay effectively to zero
    expect(measurePeakLinear(out, 2048)).toBeLessThan(1e-5);
  });
});
