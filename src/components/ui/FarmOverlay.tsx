"use client";

import React from "react";
import type { StressLevel } from "./StressChip";

export interface Zone {
  id: number;
  pts: string;
  stress: StressLevel;
  crop: string;
}

const stressColors: Record<StressLevel, string> = {
  ok:   '#4a8a52',
  mild: '#b6c24a',
  warn: '#e4b53a',
  high: '#d97a2a',
  crit: '#c24231',
};

const DEFAULT_ZONES: Zone[] = [
  { id: 1, pts: "20,22 40,18 44,44 22,48",            stress: 'ok',   crop: 'Palta Hass' },
  { id: 2, pts: "40,18 58,14 64,40 44,44",            stress: 'mild', crop: 'Palta Hass' },
  { id: 3, pts: "58,14 86,28 82,50 64,40",            stress: 'warn', crop: 'Uva de mesa' },
  { id: 4, pts: "82,50 92,62 78,76 64,66",            stress: 'crit', crop: 'Uva de mesa' },
  { id: 5, pts: "22,48 44,44 48,70 26,72",            stress: 'ok',   crop: 'Cerezo' },
  { id: 6, pts: "44,44 64,40 64,66 48,70",            stress: 'mild', crop: 'Cerezo' },
  { id: 7, pts: "48,70 64,66 78,76 72,84 50,84",      stress: 'warn', crop: 'Nogal' },
  { id: 8, pts: "26,72 48,70 50,84 34,82 14,60 22,48", stress: 'ok',  crop: 'Nogal' },
];

function centroid(pts: string): [number, number] {
  const pairs = pts.split(' ').map((p) => p.split(',').map(Number) as [number, number]);
  const x = pairs.reduce((s, [px]) => s + px, 0) / pairs.length;
  const y = pairs.reduce((s, [, py]) => s + py, 0) / pairs.length;
  return [x, y];
}

interface FarmOverlayProps {
  zones?: Zone[];
  highlightId?: number | null;
  showStress?: boolean;
}

export function FarmOverlay({ zones = DEFAULT_ZONES, highlightId = null, showStress = true }: FarmOverlayProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    >
      {zones.map((z) => {
        const color = showStress ? stressColors[z.stress] : '#2d6a3e';
        const isHighlighted = highlightId === z.id;
        const [cx, cy] = centroid(z.pts);
        return (
          <g key={z.id}>
            <polygon
              points={z.pts}
              fill={color}
              fillOpacity={isHighlighted ? 0.55 : 0.35}
              stroke={color}
              strokeWidth={isHighlighted ? 0.8 : 0.5}
            />
            {/* Zone number badge */}
            <circle cx={cx} cy={cy} r="3.2" fill="#fff" fillOpacity="0.85" />
            <text
              x={cx}
              y={cy + 1}
              textAnchor="middle"
              fontSize="3"
              fontWeight="700"
              fill={color}
              fontFamily="Inter, sans-serif"
            >
              {z.id}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export { DEFAULT_ZONES, stressColors };
