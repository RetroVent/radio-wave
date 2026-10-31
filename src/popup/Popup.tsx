import React, { useEffect, useState } from 'react';
import { PassbandPlot } from '../components/PassbandPlot';
import { useExtensionSession } from '../hooks/useExtensionSession';
import { PRESET_ORDER, PRESETS } from '../shared/presets';
import { isPresetModified, toDspRuntimeParams } from '../shared/storage';
import type { PresetId, SaturationMode } from '../shared/types';

const SATURATION_LABELS: Record<SaturationMode, string> = {
  'asymmetric-tube': 'Stage: Single-Ended Tube',
  'germanium-transistor': 'Stage: Class-B Germanium',
  'soft-tanh': 'Stage: Broadcast Limiter',
  'clean-warmth': 'Stage: Studio Warmth',
};

export const Popup: React.FC = () => {
  const {
    session,
    activeTab,
    dispatchSettings,
    startCapture,
    stopCapture,
    clearError,
    openWorkbench,
  } = useExtensionSession();

  const [calibrationOpen, setCalibrationOpen] = useState(false);

  const { settings, status, telemetry, errorMessage } = session;
  const isCapturing = status === 'capturing';
  const isBusy = status === 'starting' || status === 'stopping';
  const currentPreset = PRESETS[settings.presetId];
  const runtimeParams = toDspRuntimeParams(settings);
  const modified = isPresetModified(settings);

  // Keyboard shortcut 'B' for instant eyes-closed A/B comparison
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        void dispatchSettings({ type: 'SET_BYPASS', bypass: !settings.bypass });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dispatchSettings, settings.bypass]);

  const handlePresetKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const delta = e.key === 'ArrowRight' ? 1 : -1;
    const nextIdx = (idx + delta + PRESET_ORDER.length) % PRESET_ORDER.length;
    const nextId: PresetId = PRESET_ORDER[nextIdx];
    void dispatchSettings({ type: 'SELECT_PRESET', presetId: nextId });
    const btn = document.getElementById(`preset-btn-${nextId}`);
    btn?.focus();
  };

  const statusText = isCapturing
    ? settings.bypass
      ? 'Bypassed · Original Audio'
      : `Live · ${session.sampleRate ? `${(session.sampleRate / 1000).toFixed(1).replace('.0', '')} kHz` : '48 kHz'}`
    : status === 'starting'
      ? 'Connecting tab stream…'
      : 'Standby · Tab Unmodified';

  const contextLabel = isCapturing
    ? `Processing: ${session.capturedTabTitle || 'Active Tab'}`
    : activeTab.capturable
      ? `Target: ${activeTab.title}`
      : 'Internal page — open media tab or Workbench';

  return (
    <main className="popup-shell" aria-label="Vintage Radio Controls">
      {/* Header & Primary Power Toggle */}
      <header className="popup-header">
        <div className="brand-group">
          <div className="brand-dial-mark" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="#1C1A17" strokeWidth="1.2" />
              <line
                x1="8"
                y1="8"
                x2="11.2"
                y2="4.2"
                stroke="#B85D19"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <circle cx="8" cy="8" r="1.4" fill="#1C1A17" />
            </svg>
          </div>
          <div>
            <h1 className="brand-title">Vintage Radio</h1>
            <div className="brand-status-row" aria-live="polite">
              <span
                className={`status-dot ${isCapturing ? (settings.bypass ? 'bypass' : 'live') : ''}`}
              />
              <span>{statusText}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          data-testid="power-toggle"
          className={`btn-tactile power-btn ${isCapturing ? 'active' : 'inactive'}`}
          aria-pressed={isCapturing}
          disabled={isBusy}
          onClick={() => {
            if (isCapturing) {
              void stopCapture();
            } else {
              void startCapture();
            }
          }}
        >
          <span>{isCapturing ? 'Stop Radio' : 'Enable Radio'}</span>
        </button>
      </header>

      {/* Active Tab Context Strip */}
      <div className="context-strip" title={contextLabel}>
        <span className="context-strip-title">{contextLabel}</span>
        {isCapturing &&
        activeTab.capturable &&
        activeTab.id !== null &&
        activeTab.id !== session.capturedTabId ? (
          <button
            type="button"
            className="link-btn"
            style={{ flexShrink: 0 }}
            onClick={() => void startCapture()}
          >
            Switch here
          </button>
        ) : (
          isCapturing &&
          telemetry?.clipped && (
            <span className="tabular" style={{ color: 'var(--accent-amber)', fontWeight: 600 }}>
              LIM
            </span>
          )
        )}
      </div>

      {/* Actionable Error / Restricted Tab Recovery */}
      {errorMessage && (
        <div className="error-banner" role="alert" data-testid="error-banner">
          <div>{errorMessage}</div>
          <div className="error-actions">
            <button type="button" className="link-btn" onClick={openWorkbench}>
              Audition in Workbench ↗
            </button>
            <button type="button" className="link-btn" onClick={() => void clearError()}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Signature Passband Scale + Loudness-Matched A/B Comparison */}
      <section className="section-block" aria-label="Signal Passband and Comparison">
        <PassbandPlot params={runtimeParams} telemetry={telemetry} isActive={isCapturing} />

        <div className="ab-row">
          <span className="ab-label">Loudness-matched compare (B)</span>
          <div className="segmented-ab" role="group" aria-label="Signal comparison mode">
            <button
              type="button"
              data-testid="compare-original"
              className={`seg-btn ${settings.bypass ? 'selected' : ''}`}
              aria-pressed={settings.bypass}
              onClick={() => void dispatchSettings({ type: 'SET_BYPASS', bypass: true })}
            >
              Original
            </button>
            <button
              type="button"
              data-testid="compare-processed"
              className={`seg-btn ${!settings.bypass ? 'selected' : ''}`}
              aria-pressed={!settings.bypass}
              onClick={() => void dispatchSettings({ type: 'SET_BYPASS', bypass: false })}
            >
              Processed
            </button>
          </div>
        </div>
      </section>

      {/* 5 Scientifically Defined Receiver Profiles */}
      <section className="section-block" aria-labelledby="profile-heading">
        <div className="section-heading-row">
          <span id="profile-heading" className="section-label">
            Receiver Profile
          </span>
          <span className="era-tag">{currentPreset.eraTag}</span>
        </div>

        <div className="preset-grid" role="radiogroup" aria-labelledby="profile-heading">
          {PRESET_ORDER.map((id, index) => {
            const p = PRESETS[id];
            const selected = settings.presetId === id;
            return (
              <button
                key={id}
                id={`preset-btn-${id}`}
                data-testid={`preset-${id}`}
                type="button"
                role="radio"
                aria-checked={selected}
                tabIndex={selected ? 0 : -1}
                className={`preset-pill ${selected ? 'selected' : ''}`}
                onClick={() => void dispatchSettings({ type: 'SELECT_PRESET', presetId: id })}
                onKeyDown={(e) => handlePresetKeyDown(e, index)}
              >
                {p.shortLabel}
              </button>
            );
          })}
        </div>

        <p className="preset-caption" data-testid="preset-subtitle">
          {currentPreset.subtitle}
        </p>
      </section>

      {/* Core Macro Controls */}
      <section className="section-block control-stack" aria-label="Primary Controls">
        <div className="slider-group">
          <div className="slider-header">
            <label htmlFor="intensity-slider">Character Intensity</label>
            <span className="slider-value tabular">{Math.round(settings.intensity * 100)}%</span>
          </div>
          <input
            id="intensity-slider"
            data-testid="intensity-slider"
            className="precision-range"
            style={
              { '--range-pct': `${Math.round(settings.intensity * 100)}%` } as React.CSSProperties
            }
            type="range"
            min={0}
            max={100}
            step={1}
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
            <label htmlFor="noise-slider">Receiver Static</label>
            <div className="slider-right">
              <button
                type="button"
                data-testid="duck-toggle"
                className={`duck-chip ${settings.idleNoiseDucking ? 'on' : ''}`}
                aria-pressed={settings.idleNoiseDucking}
                title="Automatically attenuate static when playback pauses"
                onClick={() =>
                  void dispatchSettings({
                    type: 'UPDATE_CONTROLS',
                    patch: { idleNoiseDucking: !settings.idleNoiseDucking },
                  })
                }
              >
                Auto-duck
              </button>
              <span className="slider-value tabular">
                {settings.noiseLevel <= 0.005 ? 'Off' : `${Math.round(settings.noiseLevel * 100)}%`}
              </span>
            </div>
          </div>
          <input
            id="noise-slider"
            data-testid="noise-slider"
            className="precision-range"
            style={
              { '--range-pct': `${Math.round(settings.noiseLevel * 100)}%` } as React.CSSProperties
            }
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(settings.noiseLevel * 100)}
            onChange={(e) =>
              void dispatchSettings({
                type: 'UPDATE_CONTROLS',
                patch: { noiseLevel: Number(e.target.value) / 100 },
              })
            }
          />
        </div>
      </section>

      {/* Collapsible Advanced Calibration Section */}
      <section className="calibration-drawer" aria-label="Advanced Calibration">
        <button
          type="button"
          data-testid="calibration-toggle"
          className="calibration-toggle"
          aria-expanded={calibrationOpen}
          onClick={() => setCalibrationOpen((prev) => !prev)}
        >
          <span>Calibration {modified ? '· Modified' : ''}</span>
          <span aria-hidden="true">{calibrationOpen ? '−' : '+'}</span>
        </button>

        {calibrationOpen && (
          <div className="calibration-body">
            <div className="slider-group">
              <div className="slider-header">
                <label htmlFor="stereo-slider">Channel Width</label>
                <span className="slider-value tabular">
                  {settings.stereoWidth <= 0.02
                    ? 'Mono'
                    : `${Math.round(settings.stereoWidth * 100)}%`}
                </span>
              </div>
              <input
                id="stereo-slider"
                data-testid="stereo-slider"
                className="precision-range"
                style={
                  {
                    '--range-pct': `${Math.round(settings.stereoWidth * 100)}%`,
                  } as React.CSSProperties
                }
                type="range"
                min={0}
                max={100}
                step={1}
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
                <label htmlFor="tuning-slider">Skywave Drift</label>
                <span className="slider-value tabular">
                  {settings.tuningDrift <= 0.005
                    ? 'Off'
                    : `${Math.round(settings.tuningDrift * 100)}%`}
                </span>
              </div>
              <input
                id="tuning-slider"
                data-testid="tuning-slider"
                className="precision-range"
                style={
                  {
                    '--range-pct': `${Math.round(settings.tuningDrift * 100)}%`,
                  } as React.CSSProperties
                }
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(settings.tuningDrift * 100)}
                onChange={(e) =>
                  void dispatchSettings({
                    type: 'UPDATE_CONTROLS',
                    patch: { tuningDrift: Number(e.target.value) / 100 },
                  })
                }
              />
            </div>

            <div className="calibration-actions">
              <span style={{ fontSize: '11px', color: 'var(--ink-muted)' }}>
                {SATURATION_LABELS[currentPreset.dsp.saturationMode]}
              </span>
              <button
                type="button"
                data-testid="reset-preset"
                className="btn-tactile"
                style={{ padding: '3px 9px', fontSize: '11px' }}
                disabled={!modified && !settings.bypass}
                onClick={() => void dispatchSettings({ type: 'RESET_PRESET' })}
              >
                Reset Preset
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="popup-footer">
        <span>Local DSP · No audio leaves Chrome</span>
        <button
          type="button"
          data-testid="open-workbench"
          className="link-btn"
          onClick={openWorkbench}
        >
          Workbench ↗
        </button>
      </footer>
    </main>
  );
};
