import React, { useEffect, useRef, useState } from 'react';
import { PassbandPlot } from '../components/PassbandPlot';
import { resolveTargetsForParams } from '../dsp/pipeline';
import { useExtensionSession } from '../hooks/useExtensionSession';
import { PRESET_ORDER, PRESETS } from '../shared/presets';
import { isPresetModified, toDspRuntimeParams } from '../shared/storage';
import type { AudioTelemetry } from '../shared/types';
import { LocalAuditioner, type AuditionSignalType } from './localAuditioner';

const SIGNAL_OPTIONS: { id: AuditionSignalType; label: string; note: string }[] = [
  {
    id: 'jazz-chord',
    label: 'Warm Electric Piano',
    note: 'Chordal midrange & harmonic warmth test (Dm9 → G13)',
  },
  {
    id: 'spoken-cadence',
    label: 'Spoken Cadence + Pause',
    note: 'Tests vocal intelligibility & automatic static ducking during 1.8s silence',
  },
  {
    id: 'sub-groove',
    label: '65 Hz Sub-Bass + Pulse',
    note: 'Demonstrates missing-fundamental harmonic retention on small-cone presets',
  },
  {
    id: 'pink-noise',
    label: 'Calibrated Pink Noise',
    note: 'Objective broadband reference (-16 dBFS) for loudness-matched A/B checks',
  },
];

export const Workbench: React.FC = () => {
  const { session, dispatchSettings } = useExtensionSession();
  const { settings } = session;

  const [localPlaying, setLocalPlaying] = useState(false);
  const [signalType, setSignalType] = useState<AuditionSignalType>('jazz-chord');
  const [localTelemetry, setLocalTelemetry] = useState<AudioTelemetry | null>(null);
  const auditionerRef = useRef<LocalAuditioner | null>(null);

  const runtimeParams = toDspRuntimeParams(settings);
  const currentPreset = PRESETS[settings.presetId];
  const resolved = resolveTargetsForParams(runtimeParams);
  const modified = isPresetModified(settings);

  useEffect(() => {
    const aud = new LocalAuditioner((tel) => setLocalTelemetry(tel));
    auditionerRef.current = aud;
    return () => {
      void aud.stop();
    };
  }, []);

  useEffect(() => {
    auditionerRef.current?.updateParams(runtimeParams);
  }, [runtimeParams]);

  const toggleLocalAudition = async () => {
    const aud = auditionerRef.current;
    if (!aud) return;
    if (localPlaying) {
      await aud.stop();
      setLocalPlaying(false);
      setLocalTelemetry(null);
    } else {
      await aud.start(signalType, runtimeParams);
      setLocalPlaying(true);
    }
  };

  const handleSelectSignal = async (next: AuditionSignalType) => {
    setSignalType(next);
    if (localPlaying && auditionerRef.current) {
      await auditionerRef.current.switchSignal(next, runtimeParams);
    }
  };

  const activeTelemetry = localPlaying ? localTelemetry : session.telemetry;

  return (
    <div className="workbench-page">
      <header className="workbench-header">
        <div>
          <div className="section-label" style={{ marginBottom: 4 }}>
            Vintage Radio · Acoustic Calibration & Reference Lab
          </div>
          <h1 style={{ margin: 0, fontSize: 24, letterSpacing: '-0.02em' }}>Signal Workbench</h1>
          <p style={{ margin: '6px 0 0', color: 'var(--ink-secondary)', maxWidth: 620 }}>
            Inspect receiver transfer curves, audition presets against synthetic reference signals
            at matched loudness, and review the electroacoustic and psychoacoustic evidence behind
            each profile. Settings synchronize automatically with the toolbar popup.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            type="button"
            data-testid="wb-audition-toggle"
            className={`btn-tactile power-btn ${localPlaying ? 'active' : 'inactive'}`}
            aria-pressed={localPlaying}
            onClick={() => void toggleLocalAudition()}
          >
            {localPlaying ? 'Stop Reference Generator' : 'Play Reference Audio'}
          </button>
        </div>
      </header>

      <div className="workbench-grid">
        {/* Left Column: Transfer Curve, Reference Signal Generator & Preset Matrix */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <section className="wb-panel" aria-label="Electroacoustic Transfer Function">
            <div className="section-heading-row">
              <h2>Linear Transfer Curve (20 Hz – 20 kHz)</h2>
              <div className="segmented-ab" role="group" aria-label="Workbench comparison mode">
                <button
                  type="button"
                  data-testid="wb-compare-original"
                  className={`seg-btn ${settings.bypass ? 'selected' : ''}`}
                  aria-pressed={settings.bypass}
                  onClick={() => void dispatchSettings({ type: 'SET_BYPASS', bypass: true })}
                >
                  Original
                </button>
                <button
                  type="button"
                  data-testid="wb-compare-processed"
                  className={`seg-btn ${!settings.bypass ? 'selected' : ''}`}
                  aria-pressed={!settings.bypass}
                  onClick={() => void dispatchSettings({ type: 'SET_BYPASS', bypass: false })}
                >
                  Processed
                </button>
              </div>
            </div>

            <PassbandPlot
              params={runtimeParams}
              telemetry={activeTelemetry}
              height={132}
              isActive={localPlaying || session.status === 'capturing'}
            />

            <div style={{ marginTop: 14 }}>
              <span className="section-label">Local Reference Signal Source</span>
              <div className="source-pills" role="radiogroup" aria-label="Reference signal source">
                {SIGNAL_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    data-testid={`wb-signal-${opt.id}`}
                    role="radio"
                    aria-checked={signalType === opt.id}
                    className={`preset-pill ${signalType === opt.id ? 'selected' : ''}`}
                    style={{ padding: '6px 10px' }}
                    onClick={() => void handleSelectSignal(opt.id)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-secondary)' }}>
                {SIGNAL_OPTIONS.find((s) => s.id === signalType)?.note}
              </p>
            </div>
          </section>

          <section className="wb-panel" aria-label="Profile Documentation">
            <div className="section-heading-row">
              <h2>Receiver Profile & Epistemic Basis</h2>
              <span className="era-tag">{currentPreset.eraTag}</span>
            </div>

            <div className="preset-grid" style={{ marginBottom: 12 }}>
              {PRESET_ORDER.map((id) => (
                <button
                  key={id}
                  type="button"
                  data-testid={`wb-preset-${id}`}
                  className={`preset-pill ${settings.presetId === id ? 'selected' : ''}`}
                  onClick={() => void dispatchSettings({ type: 'SELECT_PRESET', presetId: id })}
                >
                  {PRESETS[id].name}
                </button>
              ))}
            </div>

            <p style={{ margin: '0 0 8px', color: 'var(--ink-primary)' }}>
              {currentPreset.description}
            </p>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-muted)' }}>
              <strong>Evidence & Estimation Note:</strong> {currentPreset.epistemicNote}
            </p>

            <dl className="spec-dl">
              <div>
                <dt>Effective High-Pass Corner</dt>
                <dd className="tabular">
                  {Math.round(resolved.highPassHz)} Hz ({resolved.highPassSlopeDb} dB/oct)
                </dd>
              </div>
              <div>
                <dt>Effective Low-Pass Corner</dt>
                <dd className="tabular">
                  {(resolved.lowPassHz / 1000).toFixed(2)} kHz ({resolved.lowPassSlopeDb} dB/oct)
                </dd>
              </div>
              <div>
                <dt>Cabinet / Enclosure Formant</dt>
                <dd className="tabular">
                  {resolved.cabinetHz} Hz ({resolved.cabinetGainDb >= 0 ? '+' : ''}
                  {resolved.cabinetGainDb.toFixed(1)} dB, Q={resolved.cabinetQ.toFixed(1)})
                </dd>
              </div>
              <div>
                <dt>Paper-Cone Presence Peak</dt>
                <dd className="tabular">
                  {resolved.coneHz} Hz (+{resolved.coneGainDb.toFixed(1)} dB, Q=
                  {resolved.coneQ.toFixed(1)})
                </dd>
              </div>
              <div>
                <dt>Nonlinear Stage</dt>
                <dd className="tabular">
                  {resolved.saturationMode} (drive {resolved.saturationDrive.toFixed(2)}×, 2× OS)
                </dd>
              </div>
              <div>
                <dt>AC Mains Hum Coupling</dt>
                <dd className="tabular">
                  {currentPreset.dsp.noiseProfile.mainsHumLevel > 0
                    ? '60 / 120 Hz Heater Ripple'
                    : 'Zero (DC Battery / Studio)'}
                </dd>
              </div>
            </dl>
          </section>
        </div>

        {/* Right Column: Precision Parameter Controls & Scientific Integrity Notes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <section className="wb-panel control-stack" aria-label="Workbench Parameter Calibration">
            <div className="section-heading-row">
              <h2>Synchronized DSP Parameters</h2>
              <button
                type="button"
                className="btn-tactile"
                style={{ padding: '3px 9px', fontSize: 11 }}
                disabled={!modified && !settings.bypass}
                onClick={() => void dispatchSettings({ type: 'RESET_PRESET' })}
              >
                Reset Preset
              </button>
            </div>

            <div className="slider-group">
              <div className="slider-header">
                <label htmlFor="wb-intensity">Character Intensity</label>
                <span className="slider-value tabular">
                  {Math.round(settings.intensity * 100)}%
                </span>
              </div>
              <input
                id="wb-intensity"
                className="precision-range"
                style={
                  {
                    '--range-pct': `${Math.round(settings.intensity * 100)}%`,
                  } as React.CSSProperties
                }
                type="range"
                min={0}
                max={100}
                value={Math.round(settings.intensity * 100)}
                onChange={(e) =>
                  void dispatchSettings({
                    type: 'UPDATE_CONTROLS',
                    patch: { intensity: Number(e.target.value) / 100 },
                  })
                }
              />
            </div>

            <div className="slider-group">
              <div className="slider-header">
                <label htmlFor="wb-noise">Receiver Static & Room Floor</label>
                <div className="slider-right">
                  <button
                    type="button"
                    className={`duck-chip ${settings.idleNoiseDucking ? 'on' : ''}`}
                    aria-pressed={settings.idleNoiseDucking}
                    onClick={() =>
                      void dispatchSettings({
                        type: 'UPDATE_CONTROLS',
                        patch: { idleNoiseDucking: !settings.idleNoiseDucking },
                      })
                    }
                  >
                    Auto-duck on silence
                  </button>
                  <span className="slider-value tabular">
                    {settings.noiseLevel <= 0.005
                      ? 'Off'
                      : `${Math.round(settings.noiseLevel * 100)}%`}
                  </span>
                </div>
              </div>
              <input
                id="wb-noise"
                className="precision-range"
                style={
                  {
                    '--range-pct': `${Math.round(settings.noiseLevel * 100)}%`,
                  } as React.CSSProperties
                }
                type="range"
                min={0}
                max={100}
                value={Math.round(settings.noiseLevel * 100)}
                onChange={(e) =>
                  void dispatchSettings({
                    type: 'UPDATE_CONTROLS',
                    patch: { noiseLevel: Number(e.target.value) / 100 },
                  })
                }
              />
            </div>

            <div className="slider-group">
              <div className="slider-header">
                <label htmlFor="wb-width">Channel Width (Mono ↔ Stereo)</label>
                <span className="slider-value tabular">
                  {settings.stereoWidth <= 0.02
                    ? 'True Mono'
                    : `${Math.round(settings.stereoWidth * 100)}%`}
                </span>
              </div>
              <input
                id="wb-width"
                className="precision-range"
                style={
                  {
                    '--range-pct': `${Math.round(settings.stereoWidth * 100)}%`,
                  } as React.CSSProperties
                }
                type="range"
                min={0}
                max={100}
                value={Math.round(settings.stereoWidth * 100)}
                onChange={(e) =>
                  void dispatchSettings({
                    type: 'UPDATE_CONTROLS',
                    patch: { stereoWidth: Number(e.target.value) / 100 },
                  })
                }
              />
            </div>

            <div className="slider-group">
              <div className="slider-header">
                <label htmlFor="wb-tuning">Skywave Selective-Fading Drift</label>
                <span className="slider-value tabular">
                  {settings.tuningDrift <= 0.005
                    ? 'Off'
                    : `${Math.round(settings.tuningDrift * 100)}%`}
                </span>
              </div>
              <input
                id="wb-tuning"
                className="precision-range"
                style={
                  {
                    '--range-pct': `${Math.round(settings.tuningDrift * 100)}%`,
                  } as React.CSSProperties
                }
                type="range"
                min={0}
                max={100}
                value={Math.round(settings.tuningDrift * 100)}
                onChange={(e) =>
                  void dispatchSettings({
                    type: 'UPDATE_CONTROLS',
                    patch: { tuningDrift: Number(e.target.value) / 100 },
                  })
                }
              />
            </div>
          </section>

          <section className="wb-panel" aria-label="Scientific Notes and Privacy">
            <h2>Psychoacoustics, Memory & Privacy Guardrails</h2>
            <ul
              style={{
                margin: 0,
                paddingLeft: 18,
                color: 'var(--ink-secondary)',
                display: 'grid',
                gap: 8,
              }}
            >
              <li>
                <strong>Symmetrical Bandwidth Balance:</strong> High-pass and low-pass corners pair
                around a ~1 kHz geometric center so audio feels warm and focused rather than muffled
                (Moore &amp; Tan, 2003).
              </li>
              <li>
                <strong>Missing-Fundamental Bass Continuity:</strong> Mild pre-baffle harmonic
                excitation generates 2nd/3rd overtones before small-cone bass roll-off so modern
                bass lines remain musically intelligible (Winkler et al., 1997).
              </li>
              <li>
                <strong>Honest Nostalgia Framing:</strong> Peer-reviewed research shows music-evoked
                nostalgia depends primarily on personal song familiarity and autobiographical
                association (Barrett et al., 2010; Hennessy et al., 2025) — never on an audio filter
                alone.
              </li>
              <li>
                <strong>Strict Local Privacy:</strong> Tab audio flows exclusively inside your local
                Chrome AudioWorklet. Zero audio recording, zero microphone access, and zero external
                network requests.
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
};
