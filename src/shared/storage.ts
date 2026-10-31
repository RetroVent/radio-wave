import {
  clamp,
  createDefaultSettings,
  getPresetDefaults,
  isPresetId,
  sanitizeDspParams,
} from './presets';
import type { DspRuntimeParams, PresetId, PresetOverrides, UserSettings } from './types';

export const STORAGE_KEY = 'vintage_radio_settings_v1';

export type SettingsAction =
  | { type: 'SELECT_PRESET'; presetId: PresetId }
  | { type: 'SET_BYPASS'; bypass: boolean }
  | {
      type: 'UPDATE_CONTROLS';
      patch: Partial<{
        intensity: number;
        noiseLevel: number;
        idleNoiseDucking: boolean;
        stereoWidth: number;
        tuningDrift: number;
      }>;
    }
  | { type: 'RESET_PRESET' };

export function toDspRuntimeParams(settings: UserSettings): DspRuntimeParams {
  return sanitizeDspParams({
    presetId: settings.presetId,
    bypass: settings.bypass,
    intensity: settings.intensity,
    noiseLevel: settings.noiseLevel,
    idleNoiseDucking: settings.idleNoiseDucking,
    stereoWidth: settings.stereoWidth,
    tuningDrift: settings.tuningDrift,
  });
}

export function isPresetModified(settings: UserSettings): boolean {
  const defaults = getPresetDefaults(settings.presetId);
  return (
    Math.abs(settings.intensity - defaults.intensity) > 0.005 ||
    Math.abs(settings.noiseLevel - defaults.noiseLevel) > 0.005 ||
    Math.abs(settings.stereoWidth - defaults.stereoWidth) > 0.005 ||
    Math.abs(settings.tuningDrift - defaults.tuningDrift) > 0.005
  );
}

/**
 * Pure, deterministic state reducer for user settings & per-preset override memory.
 */
export function applySettingsAction(current: UserSettings, action: SettingsAction): UserSettings {
  switch (action.type) {
    case 'SELECT_PRESET': {
      if (!isPresetId(action.presetId)) return current;
      const savedCurrentOverride: PresetOverrides = {
        intensity: current.intensity,
        noiseLevel: current.noiseLevel,
        stereoWidth: current.stereoWidth,
        tuningDrift: current.tuningDrift,
      };
      const nextDefaults = getPresetDefaults(action.presetId);
      const nextOverride = current.overrides[action.presetId] ?? nextDefaults;

      return {
        ...current,
        presetId: action.presetId,
        intensity: clamp(nextOverride.intensity, 0, 1),
        noiseLevel: clamp(nextOverride.noiseLevel, 0, 1),
        stereoWidth: clamp(nextOverride.stereoWidth, 0, 1),
        tuningDrift: clamp(nextOverride.tuningDrift, 0, 1),
        overrides: {
          ...current.overrides,
          [current.presetId]: savedCurrentOverride,
        },
      };
    }

    case 'SET_BYPASS': {
      return {
        ...current,
        bypass: Boolean(action.bypass),
      };
    }

    case 'UPDATE_CONTROLS': {
      const intensity =
        action.patch.intensity !== undefined
          ? clamp(action.patch.intensity, 0, 1)
          : current.intensity;
      const noiseLevel =
        action.patch.noiseLevel !== undefined
          ? clamp(action.patch.noiseLevel, 0, 1)
          : current.noiseLevel;
      const stereoWidth =
        action.patch.stereoWidth !== undefined
          ? clamp(action.patch.stereoWidth, 0, 1)
          : current.stereoWidth;
      const tuningDrift =
        action.patch.tuningDrift !== undefined
          ? clamp(action.patch.tuningDrift, 0, 1)
          : current.tuningDrift;
      const idleNoiseDucking =
        action.patch.idleNoiseDucking !== undefined
          ? Boolean(action.patch.idleNoiseDucking)
          : current.idleNoiseDucking;

      return {
        ...current,
        intensity,
        noiseLevel,
        stereoWidth,
        tuningDrift,
        idleNoiseDucking,
        overrides: {
          ...current.overrides,
          [current.presetId]: {
            intensity,
            noiseLevel,
            stereoWidth,
            tuningDrift,
          },
        },
      };
    }

    case 'RESET_PRESET': {
      const defaults = getPresetDefaults(current.presetId);
      const nextOverrides = { ...current.overrides };
      delete nextOverrides[current.presetId];
      return {
        ...current,
        bypass: false,
        intensity: defaults.intensity,
        noiseLevel: defaults.noiseLevel,
        stereoWidth: defaults.stereoWidth,
        tuningDrift: defaults.tuningDrift,
        overrides: nextOverrides,
      };
    }
  }
}

export function sanitizeStoredSettings(raw: unknown): UserSettings {
  const fallback = createDefaultSettings();
  if (!raw || typeof raw !== 'object') return fallback;
  const obj = raw as Record<string, unknown>;
  const presetId: PresetId = isPresetId(obj.presetId) ? obj.presetId : fallback.presetId;
  const presetDefaults = getPresetDefaults(presetId);

  const overrides: Partial<Record<PresetId, PresetOverrides>> = {};
  if (obj.overrides && typeof obj.overrides === 'object') {
    for (const [k, v] of Object.entries(obj.overrides as Record<string, unknown>)) {
      if (isPresetId(k) && v && typeof v === 'object') {
        const ov = v as Record<string, unknown>;
        const d = getPresetDefaults(k);
        overrides[k] = {
          intensity: clamp(typeof ov.intensity === 'number' ? ov.intensity : d.intensity, 0, 1),
          noiseLevel: clamp(typeof ov.noiseLevel === 'number' ? ov.noiseLevel : d.noiseLevel, 0, 1),
          stereoWidth: clamp(
            typeof ov.stereoWidth === 'number' ? ov.stereoWidth : d.stereoWidth,
            0,
            1,
          ),
          tuningDrift: clamp(
            typeof ov.tuningDrift === 'number' ? ov.tuningDrift : d.tuningDrift,
            0,
            1,
          ),
        };
      }
    }
  }

  return {
    presetId,
    // Intentionally never persist bypass=true across fresh browser sessions so newly enabled radio isn't silently bypassed
    bypass: Boolean(obj.bypass ?? false),
    intensity: clamp(
      typeof obj.intensity === 'number' ? obj.intensity : presetDefaults.intensity,
      0,
      1,
    ),
    noiseLevel: clamp(
      typeof obj.noiseLevel === 'number' ? obj.noiseLevel : presetDefaults.noiseLevel,
      0,
      1,
    ),
    idleNoiseDucking: typeof obj.idleNoiseDucking === 'boolean' ? obj.idleNoiseDucking : true,
    stereoWidth: clamp(
      typeof obj.stereoWidth === 'number' ? obj.stereoWidth : presetDefaults.stereoWidth,
      0,
      1,
    ),
    tuningDrift: clamp(
      typeof obj.tuningDrift === 'number' ? obj.tuningDrift : presetDefaults.tuningDrift,
      0,
      1,
    ),
    overrides,
  };
}

export async function loadPersistedSettings(): Promise<UserSettings> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      if (result && result[STORAGE_KEY]) {
        const loaded = sanitizeStoredSettings(result[STORAGE_KEY]);
        return { ...loaded, bypass: false };
      }
      return createDefaultSettings();
    }
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return sanitizeStoredSettings(JSON.parse(raw));
      }
    }
  } catch {
    // Gracefully fall back to defaults if storage is unavailable or corrupted
  }
  return createDefaultSettings();
}

export async function savePersistedSettings(settings: UserSettings): Promise<void> {
  try {
    // Persist user preferences only (never transient capture IDs or bypass lock)
    const toStore: UserSettings = { ...settings, bypass: false };
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.set({ [STORAGE_KEY]: toStore });
      return;
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
    }
  } catch {
    // Ignore quota/storage errors safely
  }
}
