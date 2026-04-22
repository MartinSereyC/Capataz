"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { Logo } from "@/components/ui/Logo";
import { Icons } from "@/components/ui/Icons";
import { Btn } from "@/components/ui/Btn";
import { StressChip } from "@/components/ui/StressChip";
import { TimelineSlider } from "@/components/ui/TimelineSlider";
import type { StressLevel } from "@/components/ui/StressChip";

const MapContainer = dynamic(
  () => import("@/components/map/MapContainer").then((m) => m.MapContainer),
  {
    ssr: false,
    loading: () => (
      <div style={{ width: '100%', height: '100%', background: '#dde8cc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 14, color: '#5c6159' }}>Cargando mapa...</span>
      </div>
    ),
  }
);

// ─── Zone data ───────────────────────────────────────────────
interface ZoneRow {
  id: number;
  crop: string;
  ha: number;
  stress: StressLevel;
  rec: string;
  priority: number;
  pts: string;
}

const ZONES: ZoneRow[] = [
  { id: 3, crop: 'Uva de mesa', ha: 7.1, stress: 'high', rec: 'Regar hoy',       priority: 1, pts: "58,14 86,28 82,50 64,40" },
  { id: 4, crop: 'Uva de mesa', ha: 5.2, stress: 'crit', rec: 'Regar hoy',       priority: 1, pts: "82,50 92,62 78,76 64,66" },
  { id: 7, crop: 'Nogal',       ha: 4.4, stress: 'warn', rec: 'Regar mañana',    priority: 3, pts: "48,70 64,66 78,76 72,84 50,84" },
  { id: 2, crop: 'Palta Hass',  ha: 6.4, stress: 'warn', rec: 'Regar mañana',    priority: 2, pts: "40,18 58,14 64,40 44,44" },
  { id: 1, crop: 'Palta Hass',  ha: 8.2, stress: 'mild', rec: 'Regar en 3 días', priority: 4, pts: "20,22 40,18 44,44 22,48" },
  { id: 6, crop: 'Cerezo',      ha: 3.9, stress: 'mild', rec: 'Regar en 3 días', priority: 4, pts: "44,44 64,40 64,66 48,70" },
  { id: 5, crop: 'Cerezo',      ha: 4.8, stress: 'ok',   rec: 'Sin urgencia',    priority: 5, pts: "22,48 44,44 48,70 26,72" },
  { id: 8, crop: 'Nogal',       ha: 6.3, stress: 'ok',   rec: 'Sin urgencia',    priority: 5, pts: "26,72 48,70 50,84 34,82 14,60 22,48" },
];

const STRESS_COLORS: Record<StressLevel, string> = {
  ok:   '#4a8a52',
  mild: '#b6c24a',
  warn: '#e4b53a',
  high: '#d97a2a',
  crit: '#c24231',
};

const REC_COLORS: Record<StressLevel, string> = {
  ok:   '#4a8a52',
  mild: '#8a9a30',
  warn: '#a07010',
  high: '#c05010',
  crit: '#c24231',
};

function centroid(pts: string): [number, number] {
  const pairs = pts.split(' ').map((p) => p.split(',').map(Number) as [number, number]);
  return [
    pairs.reduce((s, [x]) => s + x, 0) / pairs.length,
    pairs.reduce((s, [, y]) => s + y, 0) / pairs.length,
  ];
}

function dayToDate(day: number): string {
  const base = new Date(2026, 0, 20);
  const d = new Date(base.getTime() + day * 86400000);
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ─── Payment sheet ────────────────────────────────────────────
function PaymentSheet({ onClose }: { onClose: () => void }) {
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');

  const price = billing === 'monthly' ? '$50.040' : '$492.393';
  const period = billing === 'monthly' ? '/mes' : '/año';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(20,25,20,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        background: '#fff', borderRadius: 'var(--r-xl)', width: '100%', maxWidth: 520,
        boxShadow: 'var(--shadow-card)', padding: '32px 32px 28px',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 6 }}>
          Activar Capataz
        </p>
        <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5, marginBottom: 6, color: 'var(--c-text)' }}>
          Mantén acceso completo
        </h2>
        <p style={{ fontSize: 13, color: 'var(--c-text-muted)', marginBottom: 20 }}>mjserey@gmail.com</p>

        {/* Billing toggle */}
        <div style={{ display: 'flex', gap: 2, background: 'var(--c-bg-muted)', borderRadius: 10, padding: 3, marginBottom: 20 }}>
          {(['monthly', 'annual'] as const).map((b) => (
            <button key={b} onClick={() => setBilling(b)} style={{
              flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: billing === b ? '#fff' : 'transparent',
              border: 'none', cursor: 'pointer',
              color: billing === b ? 'var(--c-text)' : 'var(--c-text-muted)',
              boxShadow: billing === b ? 'var(--shadow-soft)' : 'none',
              transition: 'all 0.15s',
            }}>
              {b === 'monthly' ? 'Mensual · $50.040/mes' : (
                <span>Anual · $492.393/año <span style={{ color: 'var(--accent)', fontSize: 11 }}>Ahorra 18%</span></span>
              )}
            </button>
          ))}
        </div>

        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Nombre en tarjeta', value: cardName, set: setCardName, placeholder: 'Juan Pérez' },
            { label: 'Número de tarjeta', value: cardNumber, set: setCardNumber, placeholder: '•••• •••• •••• ••••' },
          ].map(({ label, value, set, placeholder }) => (
            <div key={label}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-muted)', display: 'block', marginBottom: 5 }}>{label}</label>
              <input
                value={value}
                onChange={(e) => set(e.target.value)}
                placeholder={placeholder}
                style={{
                  width: '100%', height: 44, padding: '0 14px',
                  borderRadius: 'var(--r-md)', border: '1.5px solid var(--c-line-strong)',
                  fontSize: 14, color: 'var(--c-text)', fontFamily: 'inherit',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
          ))}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: 'Vencimiento', value: expiry, set: setExpiry, placeholder: 'MM/AA' },
              { label: 'CVV', value: cvv, set: setCvv, placeholder: '•••' },
            ].map(({ label, value, set, placeholder }) => (
              <div key={label}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-muted)', display: 'block', marginBottom: 5 }}>{label}</label>
                <input
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  placeholder={placeholder}
                  style={{
                    width: '100%', height: 44, padding: '0 14px',
                    borderRadius: 'var(--r-md)', border: '1.5px solid var(--c-line-strong)',
                    fontSize: 14, color: 'var(--c-text)', fontFamily: 'inherit',
                    outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Total summary */}
        <div style={{
          background: 'var(--c-bg-muted)', borderRadius: 'var(--r-md)',
          padding: '12px 16px', marginBottom: 16,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 13, color: 'var(--c-text-muted)' }}>42 ha × $1.200</span>
            <span style={{ fontSize: 13, color: 'var(--c-text)' }}>$50.400</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-text)' }}>Total</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>{price}{period}</span>
          </div>
        </div>

        <Btn variant="primary" size="lg" full>
          Activar y pagar
        </Btn>
        <p style={{ fontSize: 11, color: 'var(--c-text-faint)', textAlign: 'center', marginTop: 10 }}>
          Pagos procesados con Webpay
        </p>

        <div style={{ marginTop: 14, textAlign: 'center' }}>
          <button onClick={onClose} style={{
            fontSize: 13, color: 'var(--c-text-muted)', background: 'none',
            border: 'none', cursor: 'pointer', textDecoration: 'underline',
          }}>
            Volver al dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────
export default function DashboardPage() {
  const [farmMenuOpen, setFarmMenuOpen] = useState(false);
  const [farmEditOpen, setFarmEditOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [activeZone, setActiveZone] = useState<number | null>(null);
  const [editingZone, setEditingZone] = useState<number | null>(null);
  const [zoneDraft, setZoneDraft] = useState('');
  const [dayIdx, setDayIdx] = useState(87);
  const [activateOpen, setActivateOpen] = useState(false);

  const totalHa = ZONES.reduce((s, z) => s + z.ha, 0).toFixed(1);
  const urgentCount = ZONES.filter((z) => z.stress === 'crit' || z.stress === 'high').length;
  const activeZoneData = activeZone ? ZONES.find((z) => z.id === activeZone) : null;

  function startEdit(z: ZoneRow) {
    setEditingZone(z.id);
    setZoneDraft(z.crop);
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif", position: 'relative' }}>

      {/* ── Left panel ── */}
      <div style={{
        width: 360, flexShrink: 0, height: '100%', display: 'flex', flexDirection: 'column',
        background: '#fff', borderRight: '1px solid var(--c-line)', overflow: 'hidden', zIndex: 10,
      }}>

        {/* Logo row + user */}
        <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--c-line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Logo size={16} />
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setUserMenuOpen((v) => !v)}
              style={{
                width: 34, height: 34, borderRadius: '50%',
                background: 'var(--accent)', color: '#fff',
                border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
              }}
            >
              JP
            </button>
            {userMenuOpen && (
              <div style={{
                position: 'absolute', top: 40, right: 0, width: 200,
                background: '#fff', borderRadius: 'var(--r-lg)',
                border: '1px solid var(--c-line)', boxShadow: 'var(--shadow-card)',
                zIndex: 100, overflow: 'hidden',
              }}>
                {['Mi cuenta', 'Facturación', 'Idioma · Español', 'Ayuda', '—', 'Cerrar sesión'].map((item) => (
                  item === '—'
                    ? <div key={item} style={{ height: 1, background: 'var(--c-line)', margin: '4px 0' }} />
                    : (
                      <button key={item} style={{
                        width: '100%', textAlign: 'left', padding: '9px 14px',
                        fontSize: 13, color: item === 'Cerrar sesión' ? '#c24231' : 'var(--c-text)',
                        background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--c-bg-muted)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                      >
                        {item}
                      </button>
                    )
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Farm selector row */}
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--c-line)', display: 'flex', gap: 6, alignItems: 'center', position: 'relative' }}>
          <button
            onClick={() => { setFarmMenuOpen((v) => !v); setFarmEditOpen(false); }}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 12px', borderRadius: 'var(--r-md)',
              background: 'var(--c-bg-muted)', border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, color: 'var(--c-text)', fontFamily: 'inherit',
            }}
          >
            Fundo Los Almendros
            <Icons.chevronDown size={12} />
          </button>
          <button
            onClick={() => { setFarmEditOpen((v) => !v); setFarmMenuOpen(false); }}
            style={{
              width: 36, height: 36, borderRadius: 'var(--r-md)',
              background: 'var(--c-bg-muted)', border: 'none', cursor: 'pointer',
              color: 'var(--c-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Icons.pencil size={15} />
          </button>

          {/* Farm dropdown */}
          {farmMenuOpen && (
            <div style={{
              position: 'absolute', top: 54, left: 12, right: 12,
              background: '#fff', borderRadius: 'var(--r-lg)',
              border: '1px solid var(--c-line)', boxShadow: 'var(--shadow-card)', zIndex: 50,
            }}>
              {['Fundo Los Almendros', 'Parcela El Manzano', 'Campo San Vicente'].map((name, i) => (
                <button key={name} style={{
                  width: '100%', textAlign: 'left', padding: '10px 14px',
                  fontSize: 13, fontWeight: i === 0 ? 600 : 400,
                  color: i === 0 ? 'var(--accent)' : 'var(--c-text)',
                  background: i === 0 ? 'var(--accent-soft)' : 'none',
                  border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                }}
                  onMouseEnter={(e) => i !== 0 && (e.currentTarget.style.background = 'var(--c-bg-muted)')}
                  onMouseLeave={(e) => i !== 0 && (e.currentTarget.style.background = 'none')}
                >
                  {name}
                </button>
              ))}
              <div style={{ height: 1, background: 'var(--c-line)', margin: '4px 0' }} />
              <a href="/mapa" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', fontSize: 13, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
                <Icons.plus size={14} /> Nuevo predio
              </a>
            </div>
          )}

          {/* Farm edit menu */}
          {farmEditOpen && (
            <div style={{
              position: 'absolute', top: 54, right: 12, width: 220,
              background: '#fff', borderRadius: 'var(--r-lg)',
              border: '1px solid var(--c-line)', boxShadow: 'var(--shadow-card)', zIndex: 50,
            }}>
              {['Editar perímetro', 'Editar cuarteles', 'Renombrar predio'].map((item) => (
                <button key={item} style={{
                  width: '100%', textAlign: 'left', padding: '9px 14px',
                  fontSize: 13, color: 'var(--c-text)',
                  background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--c-bg-muted)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                >
                  {item}
                </button>
              ))}
              <div style={{ height: 1, background: 'var(--c-line)', margin: '4px 0' }} />
              <button style={{
                width: '100%', textAlign: 'left', padding: '9px 14px',
                fontSize: 13, color: '#c24231',
                background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              }}>
                Eliminar predio
              </button>
            </div>
          )}
        </div>

        {/* Trial card */}
        <div style={{
          margin: '10px 12px', borderRadius: 'var(--r-lg)',
          background: '#0f1d13', padding: '14px 16px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#a8d0a8', letterSpacing: 0.2 }}>Prueba gratis · 30/30 días</span>
          </div>
          <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)', marginBottom: 12 }}>
            <div style={{ height: '100%', width: '100%', borderRadius: 2, background: 'var(--accent)' }} />
          </div>
          <button
            onClick={() => setActivateOpen(true)}
            style={{
              width: '100%', height: 38, borderRadius: 'var(--r-md)',
              background: '#fff', color: '#0f1d13', border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
            }}
          >
            Activar Capataz →
          </button>
        </div>

        {/* Date header */}
        <div style={{ padding: '10px 16px 8px', borderBottom: '1px solid var(--c-line)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>Al {dayToDate(dayIdx)}</span>
            <span style={{ fontSize: 11, color: 'var(--c-text-faint)', fontFamily: 'var(--font-ibm-plex-mono,monospace)' }}>Sentinel-2 · 4d</span>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>{ZONES.length} cuarteles</span>
            <span style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>{totalHa} ha</span>
          </div>
        </div>

        {/* Zone list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {ZONES.map((z) => (
            <div
              key={z.id}
              onClick={() => setActiveZone((v) => v === z.id ? null : z.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px',
                borderBottom: '1px solid var(--c-line)',
                background: activeZone === z.id ? 'var(--accent-soft)' : 'transparent',
                cursor: 'pointer', position: 'relative',
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => {
                if (activeZone !== z.id) (e.currentTarget as HTMLDivElement).style.background = 'var(--c-bg-muted)';
              }}
              onMouseLeave={(e) => {
                if (activeZone !== z.id) (e.currentTarget as HTMLDivElement).style.background = 'transparent';
              }}
            >
              {/* Stress color bar */}
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: STRESS_COLORS[z.stress], borderRadius: '0 2px 2px 0' }} />

              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-text-faint)', minWidth: 22, textAlign: 'right', paddingLeft: 6 }}>
                {String(z.id).padStart(2, '0')}
              </span>

              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text)', marginBottom: 2 }}>{z.crop}</p>
                <p style={{ fontSize: 12, color: REC_COLORS[z.stress], fontWeight: 600 }}>{z.rec}</p>
              </div>

              {editingZone === z.id ? (
                <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: 6 }}>
                  <input
                    value={zoneDraft}
                    onChange={(e) => setZoneDraft(e.target.value)}
                    style={{
                      height: 30, padding: '0 8px', borderRadius: 'var(--r-sm)',
                      border: '1.5px solid var(--accent)', fontSize: 12,
                      fontFamily: 'inherit', outline: 'none',
                    }}
                  />
                  <button onClick={() => setEditingZone(null)} style={{
                    padding: '0 8px', height: 30, borderRadius: 'var(--r-sm)',
                    background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                  }}>OK</button>
                  <button onClick={() => setEditingZone(null)} style={{
                    padding: '0 8px', height: 30, borderRadius: 'var(--r-sm)',
                    background: 'none', color: 'var(--c-text-muted)', border: '1px solid var(--c-line)', cursor: 'pointer', fontSize: 11,
                  }}>✕</button>
                </div>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); startEdit(z); }}
                  style={{
                    width: 28, height: 28, borderRadius: 'var(--r-sm)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--c-text-faint)', opacity: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                  className="zone-edit-btn"
                >
                  <Icons.pencil size={13} />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Legend footer */}
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--c-line)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-faint)', marginRight: 4 }}>Estrés hídrico</span>
          {(['crit', 'high', 'warn', 'mild', 'ok'] as StressLevel[]).map((s) => {
            const labels: Record<StressLevel, string> = { crit: 'Crit.', high: 'Alto', warn: 'Mod.', mild: 'Leve', ok: 'OK' };
            return (
              <span key={s} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--c-text-muted)' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: STRESS_COLORS[s], display: 'inline-block' }} />
                {labels[s]}
              </span>
            );
          })}
        </div>
      </div>

      {/* ── Right map area ── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <MapContainer parcel={null} drawMode={false} />

        {/* Zone SVG overlay */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid slice"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 5 }}
        >
          {ZONES.map((z) => {
            const [cx, cy] = centroid(z.pts);
            const isActive = activeZone === z.id;
            const color = STRESS_COLORS[z.stress];
            return (
              <g
                key={z.id}
                onClick={() => setActiveZone((v) => v === z.id ? null : z.id)}
                onMouseEnter={() => setActiveZone(z.id)}
                onMouseLeave={() => setActiveZone(null)}
                style={{ cursor: 'pointer' }}
              >
                <polygon
                  points={z.pts}
                  fill={color}
                  fillOpacity={isActive ? 0.6 : 0.35}
                  stroke={color}
                  strokeWidth={isActive ? 1 : 0.5}
                />
                <circle cx={cx} cy={cy} r="3.5" fill="#fff" fillOpacity="0.9" />
                <text x={cx} y={cy + 1.1} textAnchor="middle" fontSize="3" fontWeight="700"
                  fill={color} fontFamily="Inter,sans-serif">
                  {z.id}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Status pills top-right */}
        <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 20, display: 'flex', gap: 6 }}>
          {urgentCount > 0 && (
            <div style={{ background: '#c24231', borderRadius: 99, padding: '5px 12px', fontSize: 12, fontWeight: 700, color: '#fff', boxShadow: 'var(--shadow-soft)' }}>
              {urgentCount} urgentes
            </div>
          )}
          <div style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)', borderRadius: 99, padding: '5px 12px', fontSize: 12, fontWeight: 600, color: 'var(--c-text)', boxShadow: 'var(--shadow-soft)', fontFamily: 'var(--font-ibm-plex-mono,monospace)' }}>
            ET₀ 4.8 mm
          </div>
          <div style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)', borderRadius: 99, padding: '5px 12px', fontSize: 12, fontWeight: 600, color: 'var(--c-text)', boxShadow: 'var(--shadow-soft)' }}>
            28° · 22%
          </div>
        </div>

        {/* Zone detail card */}
        {activeZoneData && (
          <div style={{
            position: 'absolute', top: 60, right: 16, zIndex: 20,
            width: 300, background: '#fff', borderRadius: 'var(--r-xl)',
            border: '1px solid var(--c-line)', boxShadow: 'var(--shadow-card)',
            padding: '16px 18px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <p style={{ fontSize: 11, color: 'var(--c-text-faint)', marginBottom: 2 }}>Cuartel {activeZoneData.id}</p>
                <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-text)' }}>{activeZoneData.crop}</p>
              </div>
              <StressChip level={activeZoneData.stress} />
            </div>

            <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--c-text-muted)', marginBottom: 12 }}>
              <span>{activeZoneData.ha} ha</span>
              <span>·</span>
              <span>Prioridad {activeZoneData.priority}</span>
            </div>

            <div style={{ background: 'var(--accent-soft)', borderRadius: 'var(--r-md)', padding: '10px 12px', marginBottom: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-deep)', marginBottom: 3 }}>Recomendación</p>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-deep)' }}>{activeZoneData.rec}</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {[
                { label: 'NDVI', value: '0.42' },
                { label: 'vs. prom.', value: '−18%' },
                { label: 'Lluvia', value: '12 mm' },
              ].map(({ label, value }) => (
                <div key={label} style={{
                  background: 'var(--c-bg-muted)', borderRadius: 'var(--r-md)',
                  padding: '8px 10px', textAlign: 'center',
                }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text)' }}>{value}</p>
                  <p style={{ fontSize: 10, color: 'var(--c-text-faint)', marginTop: 2 }}>{label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Timeline panel (bottom, frosted glass) */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20,
          background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)',
          borderTop: '1px solid var(--c-line)', padding: '12px 20px 16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-text-muted)' }}>Línea de tiempo · 3 meses</span>
              <span style={{
                fontSize: 10, fontWeight: 700, background: 'var(--c-bg-muted)',
                border: '1px solid var(--c-line)', borderRadius: 4,
                padding: '2px 6px', color: 'var(--c-text-faint)',
                fontFamily: 'var(--font-ibm-plex-mono,monospace)',
              }}>
                Sentinel-2 L2A
              </span>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-ibm-plex-mono,monospace)' }}>
              {dayToDate(dayIdx)}
            </span>
          </div>
          <TimelineSlider value={dayIdx} onChange={setDayIdx} min={0} max={90} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--c-text-faint)' }}>{dayToDate(0)}</span>
            <span style={{ fontSize: 11, color: 'var(--c-text-faint)' }}>{dayToDate(90)}</span>
          </div>
        </div>
      </div>

      {/* Payment sheet */}
      {activateOpen && <PaymentSheet onClose={() => setActivateOpen(false)} />}

      {/* Inline style for zone edit button hover visibility */}
      <style>{`
        div:hover .zone-edit-btn { opacity: 1 !important; }
      `}</style>
    </div>
  );
}
