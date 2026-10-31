import { describe, expect, it } from 'vitest';
import {
  createDefaultSettings,
  DEFAULT_PRESET_ID,
  getPresetDefaults,
  PRESET_ORDER,
  PRESETS,
  sanitizeDspParams,
} from '../../src/shared/presets';

describe('Preset Architecture & Validation', () => {
  it('defaults to Warm Tabletop per research recommendation and validates out-of-range inputs', () => {
    const defaults = createDefaultSettings();
    expect(defaults.presetId).toBe('warm-tabletop');
    expect(DEFAULT_PRESET_ID).toBe('warm-tabletop');
    expect(defaults.bypass).toBe(false);
    expect(defaults.idleNoiseDucking).toBe(true);

    const sanitized = sanitizeDspParams({
      // @ts-expect-error testing invalid runtime input
      presetId: 'non-existent-radio',
      intensity: 99,
      noiseLevel: -5,
      stereoWidth: Number.NaN,
      tuningDrift: 2.5,
    });

    expect(sanitized.presetId).toBe('warm-tabletop');
    expect(sanitized.intensity).toBe(1);
    expect(sanitized.noiseLevel).toBe(0);
    expect(sanitized.stereoWidth).toBe(0);
    expect(sanitized.tuningDrift).toBe(1);
  });

  it('defines complete, physically consistent parameters for all 5 presets', () => {
    expect(PRESET_ORDER).toHaveLength(5);
    for (const id of PRESET_ORDER) {
      const preset = PRESETS[id];
      expect(preset.dsp.highPassHz).toBeGreaterThanOrEqual(20);
      expect(preset.dsp.lowPassHz).toBeGreaterThan(preset.dsp.highPassHz * 4);
      expect(preset.description.length).toBeGreaterThan(40);
      expect(preset.epistemicNote.length).toBeGreaterThan(20);
      const presetDefaults = getPresetDefaults(id);
      expect(presetDefaults.noiseLevel).toBeGreaterThanOrEqual(0);
      expect(presetDefaults.noiseLevel).toBeLessThanOrEqual(1);
    }
    // Battery-powered transistor pocket must have zero AC mains hum
    expect(PRESETS['transistor-radio'].dsp.noiseProfile.mainsHumLevel).toBe(0);
    // Clean Vintage must have zero default noise
    expect(PRESETS['clean-vintage'].dsp.defaultNoiseLevel).toBe(0);
  });
});
