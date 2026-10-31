import React, { useMemo } from 'react';
import { computeCompositeResponseDb, resolveTargetsForParams } from '../dsp/pipeline';
import type { AudioTelemetry, DspRuntimeParams } from '../shared/types';

const PLOT_FREQS_HZ: readonly number[] = Array.from({ length: 80 }, (_, idx) => {
  const t = idx / 79;
  return 20 * Math.pow(20000 / 20, t);
});

const GRID_MARKERS: readonly { hz: number; label: string }[] = [
  { hz: 100, label: '100' },
  { hz: 1000, label: '1k' },
  { hz: 5000, label: '5k' },
  { hz: 10000, label: '10k' },
];

function dbToMeterPercent(rmsDb: number | undefined): number {
  if (rmsDb === undefined || !Number.isFinite(rmsDb) || rmsDb <= -66) return 0;
  return Math.max(0, Math.min(100, ((rmsDb + 66) / 66) * 100));
}

function formatHz(hz: number): string {
  if (hz >= 1000) {
    return `${(hz / 1000).toFixed(1)} kHz`;
  }
  return `${Math.round(hz)} Hz`;
}

interface PassbandPlotProps {
  params: DspRuntimeParams;
  telemetry: AudioTelemetry | null;
  height?: number;
  isActive: boolean;
}

export const PassbandPlot: React.FC<PassbandPlotProps> = ({
  params,
  telemetry,
  height = 72,
  isActive,
}) => {
  const width = 330;
  const plotBottom = height - 12;

  const { pathD, fillD, hpText, lpText } = useMemo(() => {
    const mags = computeCompositeResponseDb(params, PLOT_FREQS_HZ, 48000);
    const targets = resolveTargetsForParams(params);

    const mapX = (index: number) => (index / (PLOT_FREQS_HZ.length - 1)) * width;
    // Map +8 dB (top) to -36 dB (plotBottom) and allow steep 24 dB/oct skirts to drop cleanly below clip box
    const mapY = (db: number) => ((8 - Math.min(8.5, db)) / 44) * (plotBottom - 4) + 4;

    const points = mags.map((db, idx) => `${mapX(idx).toFixed(1)},${mapY(db).toFixed(1)}`);
    const line = `M ${points.join(' L ')}`;
    const area = `${line} L ${width},${plotBottom + 6} L 0,${plotBottom + 6} Z`;

    return {
      pathD: line,
      fillD: area,
      hpText: params.bypass ? '20 Hz' : formatHz(targets.highPassHz),
      lpText: params.bypass ? '20.0 kHz' : formatHz(targets.lowPassHz),
    };
  }, [params, plotBottom]);

  const inPct = isActive ? dbToMeterPercent(telemetry?.inputRmsDb) : 0;
  const outPct = isActive ? dbToMeterPercent(telemetry?.outputRmsDb) : 0;
  const zeroDbY = (8 / 44) * (plotBottom - 4) + 4;
  const clipId = `passband-clip-${height}`;

  return (
    <div className="passband-window" role="region" aria-label="Receiver passband and signal level">
      <div className="passband-meta">
        <span>{params.bypass ? 'Original Full-Range Signal' : 'Receiver Passband'}</span>
        <span className="tabular">
          {hpText} – {lpText}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        aria-hidden="true"
        style={{ display: 'block' }}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x="0" y="0" width={width} height={plotBottom} />
          </clipPath>
        </defs>

        {/* Vertical log-frequency graticules & axis micro-labels */}
        {GRID_MARKERS.map(({ hz, label }) => {
          const x = (Math.log(hz / 20) / Math.log(20000 / 20)) * width;
          return (
            <g key={hz}>
              <line
                x1={x}
                y1={0}
                x2={x}
                y2={plotBottom}
                stroke="#D6CFC2"
                strokeWidth="0.75"
                strokeDasharray="2 2"
              />
              <text
                x={x}
                y={height - 2}
                textAnchor="middle"
                fill="#7A7267"
                fontSize="8.5"
                fontFamily="var(--font-mono)"
              >
                {label}
              </text>
            </g>
          );
        })}

        {/* 0 dB unity reference & bottom baseline */}
        <line x1={0} y1={zeroDbY} x2={width} y2={zeroDbY} stroke="#C2B9A9" strokeWidth="0.85" />
        <line
          x1={0}
          y1={plotBottom}
          x2={width}
          y2={plotBottom}
          stroke="#D6CFC2"
          strokeWidth="0.75"
        />

        {/* Clipped passband area + transfer curve */}
        <g clipPath={`url(#${clipId})`}>
          <path
            d={fillD}
            fill={params.bypass ? 'rgba(87, 81, 73, 0.08)' : 'rgba(184, 93, 25, 0.13)'}
          />
          <path
            d={pathD}
            fill="none"
            stroke={params.bypass ? '#575149' : '#B85D19'}
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
        </g>
      </svg>

      <div className="meter-strip">
        <span className="tabular">IN</span>
        <div className="meter-track" aria-hidden="true">
          <div className="meter-fill" style={{ width: `${inPct.toFixed(1)}%` }} />
        </div>
        <span className="tabular">OUT</span>
        <div className="meter-track" aria-hidden="true">
          <div
            className={`meter-fill ${params.bypass ? '' : 'processed'}`}
            style={{ width: `${outPct.toFixed(1)}%` }}
          />
        </div>
      </div>
    </div>
  );
};
