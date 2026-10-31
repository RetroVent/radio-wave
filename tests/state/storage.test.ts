import { describe, expect, it } from 'vitest';
import { isCapturableTabUrl } from '../../src/shared/messages';
import { createDefaultSettings, getPresetDefaults } from '../../src/shared/presets';
import {
  applySettingsAction,
  isPresetModified,
  sanitizeStoredSettings,
} from '../../src/shared/storage';

describe('State Reducer, Preset Override Memory & URL Guards', () => {
  it('remembers customized sliders per preset when switching away and back, and resets cleanly', () => {
    let state = createDefaultSettings();
    expect(state.presetId).toBe('warm-tabletop');
    expect(isPresetModified(state)).toBe(false);

    // Customize Warm Tabletop intensity & noise
    state = applySettingsAction(state, {
      type: 'UPDATE_CONTROLS',
      patch: { intensity: 0.92, noiseLevel: 0.45 },
    });
    expect(isPresetModified(state)).toBe(true);
    expect(state.intensity).toBe(0.92);

    // Switch to Transistor Radio -> loads Transistor Radio defaults
    state = applySettingsAction(state, {
      type: 'SELECT_PRESET',
      presetId: 'transistor-radio',
    });
    expect(state.presetId).toBe('transistor-radio');
    expect(state.noiseLevel).toBe(getPresetDefaults('transistor-radio').noiseLevel);
    expect(isPresetModified(state)).toBe(false);

    // Switch back to Warm Tabletop -> restores 0.92 intensity & 0.45 noise
    state = applySettingsAction(state, {
      type: 'SELECT_PRESET',
      presetId: 'warm-tabletop',
    });
    expect(state.intensity).toBe(0.92);
    expect(state.noiseLevel).toBe(0.45);
    expect(isPresetModified(state)).toBe(true);

    // Reset preset -> restores exact Warm Tabletop hardware defaults
    state = applySettingsAction(state, { type: 'RESET_PRESET' });
    expect(isPresetModified(state)).toBe(false);
    expect(state.intensity).toBe(getPresetDefaults('warm-tabletop').intensity);
    expect(state.noiseLevel).toBe(getPresetDefaults('warm-tabletop').noiseLevel);
  });

  it('recovers gracefully from malformed stored settings', () => {
    const recovered = sanitizeStoredSettings({
      presetId: 'corrupted-id',
      intensity: -999,
      noiseLevel: 'loud',
      idleNoiseDucking: false,
    });
    expect(recovered.presetId).toBe('warm-tabletop');
    expect(recovered.intensity).toBe(0);
    expect(recovered.idleNoiseDucking).toBe(false);
  });

  it('identifies restricted Chrome URLs vs valid media URLs accurately', () => {
    expect(isCapturableTabUrl('chrome://extensions').capturable).toBe(false);
    expect(isCapturableTabUrl('https://chromewebstore.google.com/detail/xyz').capturable).toBe(
      false,
    );
    expect(isCapturableTabUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ').capturable).toBe(true);
    expect(isCapturableTabUrl('http://127.0.0.1:4173/test-audio.html').capturable).toBe(true);
  });
});
