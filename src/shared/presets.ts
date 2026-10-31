import type {
  DspRuntimeParams,
  PresetDefinition,
  PresetId,
  PresetOverrides,
  UserSettings,
} from './types';

export const DEFAULT_PRESET_ID: PresetId = 'warm-tabletop';
export const NOMINAL_INTENSITY = 0.75;

export const PRESET_ORDER: readonly PresetId[] = [
  'warm-tabletop',
  'mid-century-am',
  'transistor-radio',
  'late-night-radio',
  'clean-vintage',
] as const;

export const PRESETS: Record<PresetId, PresetDefinition> = {
  'warm-tabletop': {
    id: 'warm-tabletop',
    name: 'Warm Tabletop',
    shortLabel: 'Tabletop',
    eraTag: '1956 · Wood Cabinet',
    subtitle: 'Full-bodied domestic tube receiver with warm wood resonance',
    description:
      'Inspired by late-1950s wood-enclosure tabletop receivers (Braun SK / Zenith H-series) with 6–8" paper-cone drivers. Balances an 85 Hz – 5.8 kHz passband, 225 Hz cabinet warmth, and gentle asymmetric tube harmonics without muddying vocals.',
    epistemicNote:
      'Electroacoustic estimate from 6.5" open-back wood enclosure dimensions + EL84/6V6 single-ended tube operating curves.',
    dsp: {
      highPassHz: 85,
      highPassSlopeDb: 12,
      lowPassHz: 5800,
      lowPassSlopeDb: 12,
      cabinetResonanceHz: 225,
      cabinetResonanceGainDb: 3.0,
      cabinetResonanceQ: 1.1,
      conePresenceHz: 2100,
      conePresenceGainDb: 1.4,
      conePresenceQ: 0.9,
      preExciteAmount: 0.14,
      saturationMode: 'asymmetric-tube',
      saturationDrive: 1.55,
      compressorThresholdDb: -18,
      compressorRatio: 2.5,
      compressorAttackMs: 12,
      compressorReleaseMs: 240,
      defaultStereoWidth: 0.15,
      defaultNoiseLevel: 0.16,
      noiseProfile: {
        pinkWeight: 0.75,
        brownWeight: 0.25,
        mainsHumLevel: 0.06,
        mainsFundamentalHz: 60,
        crackleDensity: 0.08,
        noiseHighPassHz: 95,
        noiseLowPassHz: 4800,
      },
      defaultTuningDrift: 0.0,
      makeupGainDb: 2.1,
    },
  },

  'mid-century-am': {
    id: 'mid-century-am',
    name: 'Mid-Century AM',
    shortLabel: 'Mid-AM',
    eraTag: '1948 · All-American Five',
    subtitle: 'Authentic 455 kHz IF superheterodyne & 5" Bakelite speaker',
    description:
      'Models a classic 5-tube AC/DC domestic AM receiver (50L6GT beam pentode, 455 kHz double-tuned IF strip, 5" Alnico speaker). Monaural, focused midrange intelligibility, gentle tube compression, and trace 60/120 Hz heater ripple.',
    epistemicNote:
      '4.2 kHz IF skirt documented in Radiotron Designer’s Handbook (1953); 135 Hz dipole roll-off and 320 Hz box peak estimated.',
    dsp: {
      highPassHz: 135,
      highPassSlopeDb: 24,
      lowPassHz: 4200,
      lowPassSlopeDb: 24,
      cabinetResonanceHz: 320,
      cabinetResonanceGainDb: 3.2,
      cabinetResonanceQ: 1.6,
      conePresenceHz: 2450,
      conePresenceGainDb: 2.4,
      conePresenceQ: 1.3,
      preExciteAmount: 0.24,
      saturationMode: 'asymmetric-tube',
      saturationDrive: 2.05,
      compressorThresholdDb: -15,
      compressorRatio: 4.0,
      compressorAttackMs: 5,
      compressorReleaseMs: 160,
      defaultStereoWidth: 0.0,
      defaultNoiseLevel: 0.22,
      noiseProfile: {
        pinkWeight: 0.7,
        brownWeight: 0.3,
        mainsHumLevel: 0.14,
        mainsFundamentalHz: 60,
        crackleDensity: 0.22,
        noiseHighPassHz: 140,
        noiseLowPassHz: 3900,
      },
      defaultTuningDrift: 0.1,
      makeupGainDb: 1.8,
    },
  },

  'transistor-radio': {
    id: 'transistor-radio',
    name: 'Transistor Pocket',
    shortLabel: 'Transistor',
    eraTag: '1957 · Pocket Portable',
    subtitle: 'Compact 2.5" paper cone & Class-B germanium output stage',
    description:
      'Inspired by 1950s–60s pocket portables (Regency TR-1 / Sony TR-63). Steep 360 Hz bass cut with pre-speaker harmonic excitation so bass lines remain audible via the missing-fundamental effect, crisp 2.35 kHz cone presence, and zero AC mains hum.',
    epistemicNote:
      '262/455 kHz miniature IF and Class-B germanium stage documented; 2.5" speaker cone breakup estimated. Battery-powered (zero 60 Hz hum).',
    dsp: {
      highPassHz: 360,
      highPassSlopeDb: 24,
      lowPassHz: 3300,
      lowPassSlopeDb: 24,
      cabinetResonanceHz: 1150,
      cabinetResonanceGainDb: 3.5,
      cabinetResonanceQ: 1.8,
      conePresenceHz: 2350,
      conePresenceGainDb: 4.2,
      conePresenceQ: 2.1,
      preExciteAmount: 0.34,
      saturationMode: 'germanium-transistor',
      saturationDrive: 1.9,
      compressorThresholdDb: -13,
      compressorRatio: 5.0,
      compressorAttackMs: 3,
      compressorReleaseMs: 90,
      defaultStereoWidth: 0.0,
      defaultNoiseLevel: 0.18,
      noiseProfile: {
        pinkWeight: 0.88,
        brownWeight: 0.12,
        mainsHumLevel: 0.0, // Battery-powered 9V/22.5V DC — zero AC mains hum
        mainsFundamentalHz: 60,
        crackleDensity: 0.16,
        noiseHighPassHz: 380,
        noiseLowPassHz: 3200,
      },
      defaultTuningDrift: 0.08,
      makeupGainDb: 3.6,
    },
  },

  'late-night-radio': {
    id: 'late-night-radio',
    name: 'Late-Night DX',
    shortLabel: 'Late-Night',
    eraTag: 'Artistic · Skywave Broadcast',
    subtitle: 'Intimate dark broadcast compression with gentle ionospheric drift',
    description:
      'An atmospheric interpretation of after-midnight distant broadcast listening. Combines smooth broadcast AGC density, darkened 4.6 kHz roll-off, narrowed intimate stereo, soft atmospheric static, and slow selective-fading ambience.',
    epistemicNote:
      'Creative voicing informed by ionospheric F-layer selective fading (0.08–0.2 Hz) and broadcast AGC density.',
    dsp: {
      highPassHz: 120,
      highPassSlopeDb: 12,
      lowPassHz: 4600,
      lowPassSlopeDb: 24,
      cabinetResonanceHz: 250,
      cabinetResonanceGainDb: 2.8,
      cabinetResonanceQ: 1.2,
      conePresenceHz: 1950,
      conePresenceGainDb: 1.6,
      conePresenceQ: 1.1,
      preExciteAmount: 0.18,
      saturationMode: 'soft-tanh',
      saturationDrive: 1.75,
      compressorThresholdDb: -17,
      compressorRatio: 3.5,
      compressorAttackMs: 10,
      compressorReleaseMs: 320,
      defaultStereoWidth: 0.35,
      defaultNoiseLevel: 0.28,
      noiseProfile: {
        pinkWeight: 0.55,
        brownWeight: 0.45,
        mainsHumLevel: 0.05,
        mainsFundamentalHz: 60,
        crackleDensity: 0.3,
        noiseHighPassHz: 110,
        noiseLowPassHz: 4200,
      },
      defaultTuningDrift: 0.28,
      makeupGainDb: 2.8,
    },
  },

  'clean-vintage': {
    id: 'clean-vintage',
    name: 'Clean Vintage',
    shortLabel: 'Clean',
    eraTag: '1968 · Studio Broadcast',
    subtitle: 'Subtle FM/studio broadcast warmth with zero default static',
    description:
      'Minimal, fatigue-free vintage coloration inspired by late-1960s studio broadcast limiters and hi-fi monitor tuners. Silky 9.2 kHz top-end trim, low-order (<1.2% THD) harmonic warmth, cohesive 65% stereo stage, and zero static by default.',
    epistemicNote:
      'Voiced around 75 µs FM de-emphasis warmth and studio program limiting without narrowband receiver degradation.',
    dsp: {
      highPassHz: 55,
      highPassSlopeDb: 12,
      lowPassHz: 9200,
      lowPassSlopeDb: 12,
      cabinetResonanceHz: 190,
      cabinetResonanceGainDb: 1.4,
      cabinetResonanceQ: 0.8,
      conePresenceHz: 2800,
      conePresenceGainDb: 0.8,
      conePresenceQ: 0.7,
      preExciteAmount: 0.06,
      saturationMode: 'clean-warmth',
      saturationDrive: 1.25,
      compressorThresholdDb: -20,
      compressorRatio: 1.8,
      compressorAttackMs: 20,
      compressorReleaseMs: 300,
      defaultStereoWidth: 0.65,
      defaultNoiseLevel: 0.0,
      noiseProfile: {
        pinkWeight: 0.8,
        brownWeight: 0.2,
        mainsHumLevel: 0.0,
        mainsFundamentalHz: 60,
        crackleDensity: 0.04,
        noiseHighPassHz: 70,
        noiseLowPassHz: 7500,
      },
      defaultTuningDrift: 0.0,
      makeupGainDb: 2.4,
    },
  },
};

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function isPresetId(value: unknown): value is PresetId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(PRESETS, value);
}

export function getPresetDefaults(presetId: PresetId): PresetOverrides {
  const preset = PRESETS[presetId];
  return {
    intensity: NOMINAL_INTENSITY,
    noiseLevel: preset.dsp.defaultNoiseLevel,
    stereoWidth: preset.dsp.defaultStereoWidth,
    tuningDrift: preset.dsp.defaultTuningDrift,
  };
}

export function createDefaultSettings(): UserSettings {
  const defaults = getPresetDefaults(DEFAULT_PRESET_ID);
  return {
    presetId: DEFAULT_PRESET_ID,
    bypass: false,
    intensity: defaults.intensity,
    noiseLevel: defaults.noiseLevel,
    idleNoiseDucking: true,
    stereoWidth: defaults.stereoWidth,
    tuningDrift: defaults.tuningDrift,
    overrides: {},
  };
}

export function sanitizeDspParams(raw: Partial<DspRuntimeParams>): DspRuntimeParams {
  const presetId: PresetId = isPresetId(raw.presetId) ? raw.presetId : DEFAULT_PRESET_ID;
  const defaults = getPresetDefaults(presetId);
  return {
    presetId,
    bypass: Boolean(raw.bypass),
    intensity: clamp(raw.intensity ?? defaults.intensity, 0, 1),
    noiseLevel: clamp(raw.noiseLevel ?? defaults.noiseLevel, 0, 1),
    idleNoiseDucking: raw.idleNoiseDucking ?? true,
    stereoWidth: clamp(raw.stereoWidth ?? defaults.stereoWidth, 0, 1),
    tuningDrift: clamp(raw.tuningDrift ?? defaults.tuningDrift, 0, 1),
  };
}
