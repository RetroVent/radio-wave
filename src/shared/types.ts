export type PresetId =
  'warm-tabletop' | 'mid-century-am' | 'transistor-radio' | 'late-night-radio' | 'clean-vintage';

export type SaturationMode =
  'asymmetric-tube' | 'soft-tanh' | 'germanium-transistor' | 'clean-warmth';

export type FilterSlopeDb = 12 | 24;

export interface NoiseProfileSpec {
  /** Relative weight of Paul Kellet 3-pole pink noise (0..1) */
  pinkWeight: number;
  /** Relative weight of integrated brownian/red atmospheric noise (0..1) */
  brownWeight: number;
  /** AC mains supply ripple level (0 for battery-powered transistor sets!) */
  mainsHumLevel: number;
  /** Fundamental AC supply frequency in Hz */
  mainsFundamentalHz: 50 | 60;
  /** Probability scalar for subtle band-limited atmospheric sferic ticks (0..1) */
  crackleDensity: number;
  /** Speaker/IF passband shaping for the generated noise floor */
  noiseHighPassHz: number;
  noiseLowPassHz: number;
}

export interface PresetDspSpec {
  highPassHz: number;
  highPassSlopeDb: FilterSlopeDb;
  lowPassHz: number;
  lowPassSlopeDb: FilterSlopeDb;
  cabinetResonanceHz: number;
  cabinetResonanceGainDb: number;
  cabinetResonanceQ: number;
  conePresenceHz: number;
  conePresenceGainDb: number;
  conePresenceQ: number;
  /** Mild pre-HPF harmonic excitation (0..0.5) preserving missing-fundamental bass perception */
  preExciteAmount: number;
  saturationMode: SaturationMode;
  /** Drive factor >= 1.0 at nominal intensity */
  saturationDrive: number;
  compressorThresholdDb: number;
  compressorRatio: number;
  compressorAttackMs: number;
  compressorReleaseMs: number;
  defaultStereoWidth: number;
  defaultNoiseLevel: number;
  noiseProfile: NoiseProfileSpec;
  defaultTuningDrift: number;
  /** Calibrated makeup gain in dB at nominal intensity (0.75) for loudness-matched bypass */
  makeupGainDb: number;
}

export interface PresetDefinition {
  id: PresetId;
  name: string;
  shortLabel: string;
  eraTag: string;
  subtitle: string;
  description: string;
  epistemicNote: string;
  dsp: PresetDspSpec;
}

export interface PresetOverrides {
  intensity: number;
  noiseLevel: number;
  stereoWidth: number;
  tuningDrift: number;
}

export interface UserSettings {
  presetId: PresetId;
  bypass: boolean;
  intensity: number;
  noiseLevel: number;
  idleNoiseDucking: boolean;
  stereoWidth: number;
  tuningDrift: number;
  overrides: Partial<Record<PresetId, PresetOverrides>>;
}

export interface DspRuntimeParams {
  presetId: PresetId;
  bypass: boolean;
  /** 0..1 macro intensity (0 = uncolored, 0.75 = nominal hardware target, 1.0 = pushed vintage) */
  intensity: number;
  /** 0..1 user noise control (0 = true zero-CPU noise off) */
  noiseLevel: number;
  /** Attenuate static smoothly when input signal pauses */
  idleNoiseDucking: boolean;
  /** 0 = true mono, 1 = original stereo width */
  stereoWidth: number;
  /** 0..1 optional selective-fading / tuning drift ambience */
  tuningDrift: number;
}

export interface AudioTelemetry {
  inputRmsDb: number;
  outputRmsDb: number;
  gainReductionDb: number;
  noiseGateGain: number;
  clipped: boolean;
  timestamp: number;
}

export type CaptureStatus = 'idle' | 'starting' | 'capturing' | 'stopping' | 'error';

export interface SessionState {
  status: CaptureStatus;
  capturedTabId: number | null;
  capturedTabTitle: string | null;
  capturedTabUrl: string | null;
  errorMessage: string | null;
  sampleRate: number | null;
  engineMode: 'audioworklet' | 'fallback' | null;
  settings: UserSettings;
  telemetry: AudioTelemetry | null;
}
