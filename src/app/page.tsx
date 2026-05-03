"use client";

import React, { useState, useRef, useEffect } from "react";
import { Logo } from "@/components/ui/Logo";
import { Icons } from "@/components/ui/Icons";
import { Btn } from "@/components/ui/Btn";
import { StressChip } from "@/components/ui/StressChip";
import { MapBackground } from "@/components/ui/MapBackground";
import { FarmOverlay } from "@/components/ui/FarmOverlay";
import { TimelineSlider } from "@/components/ui/TimelineSlider";
import type { StressLevel } from "@/components/ui/StressChip";
import type { Zone } from "@/components/ui/FarmOverlay";

// ------- stress evolution data -------
const zoneData = [
  { id: 1, crop: 'Palta Hass',  start: 'ok'   as StressLevel, end: 'mild' as StressLevel, pts: "20,22 40,18 44,44 22,48" },
  { id: 2, crop: 'Palta Hass',  start: 'ok'   as StressLevel, end: 'warn' as StressLevel, pts: "40,18 58,14 64,40 44,44" },
  { id: 3, crop: 'Uva de mesa', start: 'mild' as StressLevel, end: 'high' as StressLevel, pts: "58,14 86,28 82,50 64,40" },
  { id: 4, crop: 'Uva de mesa', start: 'mild' as StressLevel, end: 'crit' as StressLevel, pts: "82,50 92,62 78,76 64,66" },
  { id: 5, crop: 'Cerezo',      start: 'ok'   as StressLevel, end: 'ok'   as StressLevel, pts: "22,48 44,44 48,70 26,72" },
  { id: 6, crop: 'Cerezo',      start: 'ok'   as StressLevel, end: 'mild' as StressLevel, pts: "44,44 64,40 64,66 48,70" },
  { id: 7, crop: 'Nogal',       start: 'ok'   as StressLevel, end: 'warn' as StressLevel, pts: "48,70 64,66 78,76 72,84 50,84" },
  { id: 8, crop: 'Nogal',       start: 'ok'   as StressLevel, end: 'ok'   as StressLevel, pts: "26,72 48,70 50,84 34,82 14,60 22,48" },
];

const stressOrder: StressLevel[] = ['ok', 'mild', 'warn', 'high', 'crit'];

function interpolateStress(start: StressLevel, end: StressLevel, t: number): StressLevel {
  const si = stressOrder.indexOf(start);
  const ei = stressOrder.indexOf(end);
  const idx = Math.round(si + (ei - si) * t);
  return stressOrder[Math.max(0, Math.min(4, idx))];
}

function getZonesForDay(dayIdx: number): Zone[] {
  const t = dayIdx / 90;
  return zoneData.map((z) => ({
    id: z.id,
    pts: z.pts,
    crop: z.crop,
    stress: interpolateStress(z.start, z.end, t),
  }));
}

const recLabels: Record<StressLevel, string> = {
  ok:   'Sin urgencia',
  mild: 'Regar en 3 días',
  warn: 'Regar mañana',
  high: 'Regar hoy',
  crit: 'Regar hoy',
};

function dayToDate(day: number): string {
  const base = new Date(2026, 0, 20); // Jan 20 2026
  const d = new Date(base.getTime() + day * 86400000);
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
}

// Zone polygon hitbox centroids (approximate for interactivity)
function centroid(pts: string): [number, number] {
  const pairs = pts.split(' ').map((p) => p.split(',').map(Number) as [number, number]);
  return [
    pairs.reduce((s, [x]) => s + x, 0) / pairs.length,
    pairs.reduce((s, [, y]) => s + y, 0) / pairs.length,
  ];
}

export default function LandingPage() {
  const [dayIdx, setDayIdx] = useState(45);
  const [hoveredZone, setHoveredZone] = useState<number | null>(null);
  const [ha, setHa] = useState(120);
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');

  const zones = getZonesForDay(dayIdx);
  const hoveredData = hoveredZone ? zones.find((z) => z.id === hoveredZone) : null;

  const monthlyCost = ha * 1200;
  const annualCost = Math.round(ha * 1200 * 12 * 0.82);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--c-bg)', color: 'var(--c-text)', fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif" }}>

      {/* ── Sticky Nav ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--c-line)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 32px', height: 60,
      }}>
        <Logo size={18} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <a href="#como" style={{ fontSize: 14, color: 'var(--c-text-muted)', textDecoration: 'none', display: 'none' }}
            className="md:inline">Cómo funciona</a>
          <a href="#precios" style={{ fontSize: 14, color: 'var(--c-text-muted)', textDecoration: 'none', display: 'none' }}
            className="md:inline">Precios</a>
          <div style={{ display: 'flex', gap: 2, background: 'var(--c-bg-muted)', borderRadius: 6, padding: 2 }}>
            <button style={{ padding: '4px 10px', borderRadius: 4, fontSize: 12, fontWeight: 600, background: '#fff', border: 'none', cursor: 'pointer', color: 'var(--c-text)' }}>ES</button>
            <button style={{ padding: '4px 10px', borderRadius: 4, fontSize: 12, fontWeight: 500, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--c-text-muted)' }}>EN</button>
          </div>
          <a href="/mapa" style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none' }}>Ingresar</a>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ maxWidth: 1400, margin: '0 auto', padding: '96px 32px 64px' }}>
        {/* Badge */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--accent-soft)', border: '1px solid var(--accent-line)', borderRadius: 99, padding: '6px 16px', marginBottom: 32 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-deep)' }}>Para agricultores de Chile</span>
        </div>

        <h1 style={{ fontSize: 'clamp(42px, 6vw, 84px)', fontWeight: 700, lineHeight: 1.05, letterSpacing: -2, maxWidth: 760, marginBottom: 24, color: 'var(--c-text)' }}>
          Prioriza tus zonas de riego con{' '}
          <span style={{ color: 'var(--accent)' }}>información satelital</span>.
        </h1>

        <p style={{ fontSize: 18, color: 'var(--c-text-muted)', maxWidth: 560, lineHeight: 1.6, marginBottom: 40 }}>
          Detecta estrés hídrico en cada cuartel antes de que se vea a simple vista. Datos Sentinel-2 cada 4 días, directo a tu pantalla.
        </p>

        <a href="/mapa" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'var(--accent)', color: '#fff', padding: '0 28px', height: 56, borderRadius: 'var(--r-lg)', fontSize: 16, fontWeight: 600, textDecoration: 'none', letterSpacing: -0.2 }}>
          Mapear mi campo
          <Icons.arrowRight size={18} />
        </a>
      </section>

      {/* ── Demo Farm Section ── */}
      <section style={{ maxWidth: 1400, margin: '0 auto', padding: '0 32px 96px' }}>
        {/* Section header */}
        <div style={{ marginBottom: 32 }}>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 10 }}>
            Así se ve un campo hoy
          </p>
          <h2 style={{ fontSize: 36, fontWeight: 700, letterSpacing: -1, color: 'var(--c-text)' }}>
            Un campo real, con datos reales
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24, alignItems: 'start' }}>

          {/* ── Map Card ── */}
          <div style={{
            background: '#fff',
            borderRadius: 'var(--r-xl)',
            border: '1px solid var(--c-line)',
            boxShadow: 'var(--shadow-card)',
            overflow: 'hidden',
          }}>
            {/* Map top bar */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--c-line)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text)' }}>Fundo Los Almendros</span>
              {/* Live pulse */}
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--accent-soft)', border: '1px solid var(--accent-line)', borderRadius: 99, padding: '2px 8px' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--stress-ok)', display: 'inline-block', animation: 'capataz-pulse 2s ease-in-out infinite' }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent-deep)' }}>En vivo</span>
              </span>
              <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: 'var(--c-text-faint)', background: 'var(--c-bg-muted)', padding: '3px 8px', borderRadius: 4 }}>Solo lectura</span>
            </div>

            {/* Map area */}
            <div style={{ position: 'relative', aspectRatio: '16/9', minHeight: 320 }}>
              <MapBackground seed={42} showLabels={false} />
              {/* Zone overlay with SVG hitboxes */}
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="xMidYMid slice"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
              >
                {zones.map((z) => {
                  const stressColorMap: Record<StressLevel, string> = {
                    ok: '#4a8a52', mild: '#b6c24a', warn: '#e4b53a', high: '#d97a2a', crit: '#c24231',
                  };
                  const color = stressColorMap[z.stress];
                  const [cx, cy] = centroid(z.pts);
                  const isHov = hoveredZone === z.id;
                  return (
                    <g key={z.id}
                      onMouseEnter={() => setHoveredZone(z.id)}
                      onMouseLeave={() => setHoveredZone(null)}
                      style={{ cursor: 'pointer' }}
                    >
                      <polygon
                        points={z.pts}
                        fill={color}
                        fillOpacity={isHov ? 0.65 : 0.38}
                        stroke={color}
                        strokeWidth={isHov ? 1 : 0.5}
                      />
                      <circle cx={cx} cy={cy} r="3.5" fill="#fff" fillOpacity="0.9" />
                      <text x={cx} y={cy + 1.1} textAnchor="middle" fontSize="3" fontWeight="700" fill={color} fontFamily="Inter,sans-serif">{z.id}</text>
                    </g>
                  );
                })}
              </svg>

              {/* Hover tooltip */}
              {hoveredData && (
                <div style={{
                  position: 'absolute', top: 12, right: 12, zIndex: 10,
                  background: '#fff', borderRadius: 'var(--r-lg)',
                  boxShadow: 'var(--shadow-card)',
                  border: '1px solid var(--c-line)',
                  padding: '12px 16px', minWidth: 180,
                }}>
                  <p style={{ fontSize: 12, color: 'var(--c-text-faint)', marginBottom: 4 }}>Cuartel {hoveredData.id}</p>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text)', marginBottom: 8 }}>{hoveredData.crop}</p>
                  <StressChip level={hoveredData.stress} />
                  <p style={{ fontSize: 12, color: 'var(--c-text-muted)', marginTop: 8 }}>{recLabels[hoveredData.stress]}</p>
                </div>
              )}

              {/* In-map CTA */}
              <div style={{ position: 'absolute', bottom: 56, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
                <a href="/mapa" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  background: 'var(--accent)', color: '#fff',
                  padding: '0 20px', height: 42, borderRadius: 'var(--r-lg)',
                  fontSize: 13, fontWeight: 600, textDecoration: 'none',
                  boxShadow: '0 4px 16px rgba(45,106,62,0.4)',
                  whiteSpace: 'nowrap',
                }}>
                  Mapear mi campo →
                </a>
              </div>

              {/* Stress legend */}
              <div style={{ position: 'absolute', bottom: 8, left: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
                {(['ok', 'mild', 'warn', 'high', 'crit'] as StressLevel[]).map((s) => {
                  const cols: Record<StressLevel, string> = { ok: '#4a8a52', mild: '#b6c24a', warn: '#e4b53a', high: '#d97a2a', crit: '#c24231' };
                  const lbls: Record<StressLevel, string> = { ok: 'OK', mild: 'Leve', warn: 'Mod.', high: 'Alto', crit: 'Crit.' };
                  return (
                    <span key={s} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#fff', background: 'rgba(0,0,0,0.45)', borderRadius: 4, padding: '2px 5px', backdropFilter: 'blur(4px)' }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: cols[s], display: 'inline-block' }} />
                      {lbls[s]}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Timeline slider */}
            <div style={{ padding: '16px 20px 20px', borderTop: '1px solid var(--c-line)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-muted)' }}>Línea de tiempo · 90 días</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-ibm-plex-mono, monospace)' }}>{dayToDate(dayIdx)}</span>
              </div>
              <TimelineSlider value={dayIdx} onChange={setDayIdx} min={0} max={90} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--c-text-faint)' }}>{dayToDate(0)}</span>
                <span style={{ fontSize: 11, color: 'var(--c-text-faint)' }}>{dayToDate(90)}</span>
              </div>
            </div>
          </div>

          {/* ── Cost Cards ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Demo farm card */}
            <div style={{
              background: '#fff', borderRadius: 'var(--r-xl)',
              border: '1px solid var(--c-line)', boxShadow: 'var(--shadow-soft)',
              padding: '20px 24px',
            }}>
              <p style={{ fontSize: 12, color: 'var(--c-text-faint)', marginBottom: 6 }}>Campo de ejemplo</p>
              <p style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5, marginBottom: 4 }}>42 ha</p>
              <p style={{ fontSize: 13, color: 'var(--c-text-muted)', marginBottom: 16 }}>8 cuarteles · Rancagua, O'Higgins</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid var(--c-line)' }}>
                <span style={{ fontSize: 13, color: 'var(--c-text-muted)' }}>Costo mensual</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>$50.400/mes</span>
              </div>
            </div>

            {/* Interactive estimator */}
            <div style={{
              background: '#fff', borderRadius: 'var(--r-xl)',
              border: '1px solid var(--c-line)', boxShadow: 'var(--shadow-soft)',
              padding: '20px 24px',
            }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-muted)', marginBottom: 16 }}>Estima tu costo</p>

              {/* ha input */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <label style={{ fontSize: 13, color: 'var(--c-text-muted)' }}>Superficie</label>
                  <span style={{ fontSize: 18, fontWeight: 700 }}>{ha} ha</span>
                </div>
                <input
                  type="range" min={1} max={500} value={ha}
                  onChange={(e) => setHa(Number(e.target.value))}
                  className="capataz-range"
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ fontSize: 11, color: 'var(--c-text-faint)' }}>1 ha</span>
                  <span style={{ fontSize: 11, color: 'var(--c-text-faint)' }}>500 ha</span>
                </div>
              </div>

              {/* Billing toggle */}
              <div style={{ display: 'flex', gap: 2, background: 'var(--c-bg-muted)', borderRadius: 8, padding: 3, marginBottom: 16 }}>
                {(['monthly', 'annual'] as const).map((b) => (
                  <button
                    key={b}
                    onClick={() => setBilling(b)}
                    style={{
                      flex: 1, padding: '7px 0', borderRadius: 6, fontSize: 12, fontWeight: 600,
                      background: billing === b ? '#fff' : 'transparent',
                      border: 'none', cursor: 'pointer',
                      color: billing === b ? 'var(--c-text)' : 'var(--c-text-muted)',
                      boxShadow: billing === b ? 'var(--shadow-soft)' : 'none',
                      transition: 'all 0.15s',
                    }}
                  >
                    {b === 'monthly' ? 'Mensual' : 'Anual'}
                    {b === 'annual' && <span style={{ color: 'var(--accent)', marginLeft: 4 }}>−18%</span>}
                  </button>
                ))}
              </div>

              {/* Price display */}
              <div style={{ background: 'var(--accent-soft)', borderRadius: 'var(--r-md)', padding: '12px 16px', marginBottom: 16 }}>
                <p style={{ fontSize: 26, fontWeight: 700, color: 'var(--accent-deep)', letterSpacing: -0.5 }}>
                  ${billing === 'monthly'
                    ? monthlyCost.toLocaleString('es-CL')
                    : annualCost.toLocaleString('es-CL')}
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--accent)' }}>
                    {billing === 'monthly' ? '/mes' : '/año'}
                  </span>
                </p>
                <p style={{ fontSize: 12, color: 'var(--accent)', marginTop: 2 }}>
                  $1.200 CLP / ha / mes
                </p>
              </div>

              <a href="/mapa" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                background: 'var(--accent)', color: '#fff', height: 48, borderRadius: 'var(--r-lg)',
                fontSize: 14, fontWeight: 600, textDecoration: 'none', marginBottom: 10,
              }}>
                Mapear mi campo
                <Icons.arrowRight size={16} />
              </a>
              <p style={{ fontSize: 12, color: 'var(--c-text-faint)', textAlign: 'center' }}>Gratis los primeros 30 días</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{
        borderTop: '1px solid var(--c-line)',
        padding: '24px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 8,
      }}>
        <span style={{ fontSize: 13, color: 'var(--c-text-faint)' }}>© 2026 Capataz · Rancagua, Chile</span>
        <span style={{ fontSize: 13, color: 'var(--c-text-faint)' }}>Hecho para la zona centro y sur</span>
      </footer>
    </div>
  );
}
