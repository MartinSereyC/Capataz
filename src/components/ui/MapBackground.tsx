"use client";

import React, { useMemo } from "react";

interface MapBackgroundProps {
  seed?: number;
  showLabels?: boolean;
  zoomed?: boolean;
  style?: React.CSSProperties;
}

function seededRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

type FieldPattern = 'vineyard' | 'orchard' | 'pasture' | 'bare';

interface Field {
  points: string;
  pattern: FieldPattern;
  label: string;
  labelX: number;
  labelY: number;
}

const patternColors: Record<FieldPattern, string> = {
  vineyard: '#c8d8a0',
  orchard:  '#b4d4a8',
  pasture:  '#d4e8b0',
  bare:     '#e8e0c8',
};

const patternLabels: Record<FieldPattern, string> = {
  vineyard: 'Viñedo',
  orchard:  'Huerto',
  pasture:  'Pradera',
  bare:     'Barbecho',
};

export function MapBackground({ seed = 42, showLabels = true, style }: MapBackgroundProps) {
  const fields = useMemo<Field[]>(() => {
    const rng = seededRng(seed);
    const patterns: FieldPattern[] = ['vineyard', 'orchard', 'pasture', 'bare'];
    const rawFields = [
      { pts: "5,10 30,8 34,35 8,38",      lx: 18, ly: 22 },
      { pts: "30,8 60,5 62,30 34,35",      lx: 46, ly: 18 },
      { pts: "60,5 90,10 88,38 62,30",     lx: 74, ly: 20 },
      { pts: "8,38 34,35 36,62 10,65",     lx: 22, ly: 50 },
      { pts: "34,35 62,30 64,58 36,62",    lx: 49, ly: 46 },
      { pts: "62,30 88,38 84,64 64,58",    lx: 74, ly: 48 },
      { pts: "10,65 36,62 38,85 12,88",    lx: 24, ly: 74 },
      { pts: "36,62 64,58 66,84 38,85",    lx: 51, ly: 72 },
      { pts: "64,58 84,64 80,88 66,84",    lx: 73, ly: 74 },
    ];
    return rawFields.map((f) => {
      const pi = Math.floor(rng() * patterns.length);
      return {
        points: f.pts,
        pattern: patterns[pi],
        label: patternLabels[patterns[pi]],
        labelX: f.lx,
        labelY: f.ly,
      };
    });
  }, [seed]);

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      style={{ width: '100%', height: '100%', display: 'block', background: '#dde8cc', ...style }}
    >
      {/* Base terrain */}
      <rect x="0" y="0" width="100" height="100" fill="#dde8cc" />

      {/* Fields */}
      {fields.map((f, i) => (
        <polygon
          key={i}
          points={f.points}
          fill={patternColors[f.pattern]}
          stroke="#b8c890"
          strokeWidth="0.4"
        />
      ))}

      {/* Row texture lines for vineyard/orchard */}
      {fields.map((f, i) =>
        f.pattern === 'vineyard' || f.pattern === 'orchard' ? (
          <g key={`lines-${i}`} opacity="0.25" clipPath={`url(#clip-${i})`}>
            {[...Array(8)].map((_, j) => (
              <line
                key={j}
                x1="0"
                y1={j * 12 + 5}
                x2="100"
                y2={j * 12 + 5}
                stroke="#2d6a3e"
                strokeWidth="0.3"
              />
            ))}
          </g>
        ) : null
      )}

      {/* River */}
      <path
        d="M 95,0 C 90,20 88,30 92,50 C 96,70 93,85 90,100"
        stroke="#7ab4d4"
        strokeWidth="1.8"
        fill="none"
        opacity="0.7"
      />
      <path
        d="M 95,0 C 90,20 88,30 92,50 C 96,70 93,85 90,100"
        stroke="#a8d0e8"
        strokeWidth="0.8"
        fill="none"
        opacity="0.5"
      />

      {/* Road horizontal */}
      <line x1="0" y1="50" x2="88" y2="50" stroke="#c8b87a" strokeWidth="0.6" opacity="0.6" />
      {/* Road vertical */}
      <line x1="34" y1="0" x2="34" y2="100" stroke="#c8b87a" strokeWidth="0.5" opacity="0.5" />

      {/* Labels */}
      {showLabels && fields.map((f, i) => (
        <text
          key={`label-${i}`}
          x={f.labelX}
          y={f.labelY}
          fontSize="2.8"
          fill="#2d6a3e"
          opacity="0.7"
          textAnchor="middle"
          fontFamily="Inter, sans-serif"
          fontWeight="500"
        >
          {f.label}
        </text>
      ))}

      {/* Border vignette */}
      <rect x="0" y="0" width="100" height="100" fill="none" stroke="#8aaa60" strokeWidth="0.3" opacity="0.4" />
    </svg>
  );
}
