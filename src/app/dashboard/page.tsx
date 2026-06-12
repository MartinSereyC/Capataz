"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useZoneStats } from "@/hooks/useZoneStats";
import { useSatelliteDates } from "@/hooks/useSatelliteDates";
import { useParcelContext } from "@/context/ParcelContext";
import dynamic from "next/dynamic";
import type L from "leaflet";
import { Logo } from "@/components/ui/Logo";
import { Icons } from "@/components/ui/Icons";
import { Btn } from "@/components/ui/Btn";
import { StressChip } from "@/components/ui/StressChip";
import { TimelineSlider } from "@/components/ui/TimelineSlider";
import type { StressLevel } from "@/components/ui/StressChip";
import type { Parcel, SavedZone } from "@/types";
import type { MapZone } from "@/components/map/MapContainer";
import { MAP_DEFAULTS } from "@/lib/constants";
import { toBboxLeaflet } from "@/lib/geo/polygon-builder";
import { useFusionAnalysis } from "@/hooks/useFusionAnalysis";
import { textoConfianza, colorConfianza, labelFuente, labelConfianza } from "@/lib/fusion/confidence";
import { useWeatherForecast } from "@/hooks/useWeatherForecast";
import { useZoneSync, type ZoneAdvice } from "@/hooks/useZoneSync";
import { RiegoForm } from "@/components/dashboard/RiegoForm";
import { es } from "@/lib/i18n/es";

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

// Vista de zona: SavedZone + estado derivado de datos reales (NDVI o advice).
// stress null = sin dato → presentación neutra (regla: solo datos reales).
interface ZoneRow extends SavedZone {
  stress: StressLevel | null;
  rec: string | null;
  priority: number | null;
  advice: ZoneAdvice | null;
}

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

const STRESS_BG: Record<StressLevel, string> = {
  crit: 'rgba(194,66,49,0.07)',
  high: 'rgba(217,122,42,0.07)',
  warn: 'rgba(228,181,58,0.06)',
  mild: 'transparent',
  ok:   'transparent',
};

const TIMING_LABEL: Record<string, string> = {
  'hoy':        es.riego.regarHoy,
  'mañana':     es.riego.regarManana,
  '3-4 días':   es.riego.regar34,
  'no urgente': es.riego.sinUrgencia,
};

const SEMAFORO_STRESS: Record<string, StressLevel> = {
  rojo: 'crit',
  amarillo: 'warn',
  verde: 'ok',
};

const NEUTRAL_COLOR = '#a8b0a6';

function isoToEs(iso: string | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
}

function ndviToStress(ndvi: number | null): StressLevel | null {
  if (ndvi === null) return null;
  if (ndvi > 0.65) return 'ok';
  if (ndvi > 0.50) return 'mild';
  if (ndvi > 0.35) return 'warn';
  if (ndvi > 0.20) return 'high';
  return 'crit';
}

// ─── Payment sheet ────────────────────────────────────────────
function PaymentSheet({ onClose, totalHa }: { onClose: () => void; totalHa: number }) {
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');

  const monthly = Math.max(0, Math.round(totalHa * 1200));
  const annual = Math.round(monthly * 12 * 0.82);
  const fmt = (n: number) => '$' + n.toLocaleString('es-CL');
  const price = billing === 'monthly' ? fmt(monthly) : fmt(annual);
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
              {b === 'monthly' ? `Mensual · ${fmt(monthly)}/mes` : (
                <span>Anual · {fmt(annual)}/año <span style={{ color: 'var(--accent)', fontSize: 11 }}>Ahorra 18%</span></span>
              )}
            </button>
          ))}
        </div>

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

        <div style={{
          background: 'var(--c-bg-muted)', borderRadius: 'var(--r-md)',
          padding: '12px 16px', marginBottom: 16,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 13, color: 'var(--c-text-muted)' }}>{totalHa.toFixed(1)} ha × $1.200</span>
            <span style={{ fontSize: 13, color: 'var(--c-text)' }}>{fmt(monthly)}</span>
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
  const { selectedLayerType, setSelectedLayerType } = useParcelContext();

  const [farmMenuOpen, setFarmMenuOpen] = useState(false);
  const [farmEditOpen, setFarmEditOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [activeZone, setActiveZone] = useState<number | null>(null);
  const [editingZone, setEditingZone] = useState<number | null>(null);
  const [zoneDraft, setZoneDraft] = useState('');
  const [dayIdx, setDayIdx] = useState(0);
  const [activateOpen, setActivateOpen] = useState(false);

  const [farmName] = useState<string>(() => {
    if (typeof window === 'undefined') return 'Mi Campo';
    try {
      const d = JSON.parse(localStorage.getItem('capataz_farm') ?? '{}');
      return d.farmName ?? 'Mi Campo';
    } catch { return 'Mi Campo'; }
  });

  const [parcel] = useState<Parcel | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem('capataz_parcel');
      return raw ? (JSON.parse(raw) as Parcel) : null;
    } catch { return null; }
  });

  const { dates: satDates, cloudCoverage } = useSatelliteDates(parcel?.bbox ?? null);

  const parcelCentroidLat = parcel ? (parcel.bbox[1] + parcel.bbox[3]) / 2 : null;
  const parcelCentroidLng = parcel ? (parcel.bbox[0] + parcel.bbox[2]) / 2 : null;
  const { forecast: weatherForecast, loading: weatherLoading } = useWeatherForecast(parcelCentroidLat, parcelCentroidLng);

  useEffect(() => {
    if (satDates.length > 0) setDayIdx(satDates.length - 1);
  }, [satDates.length]);

  const [zones, setZones] = useState<SavedZone[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem('capataz_zones');
      return raw ? (JSON.parse(raw) as SavedZone[]) : [];
    } catch { return []; }
  });

  // Sincroniza con la DB, dispara backfill/refresh y trae el advice por zona
  const { fase: syncFase, advicePorUuid, refrescar: refrescarAdvice } = useZoneSync();

  const [debouncedDate, setDebouncedDate] = useState('');
  useEffect(() => {
    const date = satDates[dayIdx] ?? '';
    const timer = setTimeout(() => setDebouncedDate(date), 800);
    return () => clearTimeout(timer);
  }, [dayIdx, satDates]);

  const zoneStats = useZoneStats(zones, debouncedDate);

  const displayZones: ZoneRow[] = useMemo(() => {
    const rows = zones.map((z): ZoneRow => {
      const advice = z.uuid ? (advicePorUuid[z.uuid] ?? null) : null;
      const stat = zoneStats[z.id];
      const ndviStress = stat && !stat.loading ? ndviToStress(stat.ndvi) : null;
      // Advice (balance histórico) manda; NDVI del día como respaldo real
      const stress = advice ? SEMAFORO_STRESS[advice.rec.semaforo] : ndviStress;
      return {
        ...z,
        stress,
        rec: advice ? TIMING_LABEL[advice.rec.timing] : null,
        priority: advice?.prioridad ?? null,
        advice,
      };
    });
    return rows.sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99) || a.id - b.id);
  }, [zones, zoneStats, advicePorUuid]);

  const totalHa = zones.reduce((s, z) => s + z.ha, 0);
  const urgentCount = displayZones.filter((z) =>
    z.advice ? z.advice.rec.semaforo === 'rojo' : z.stress === 'crit' || z.stress === 'high',
  ).length;
  const activeZoneData = activeZone ? displayZones.find((z) => z.id === activeZone) : null;

  const { result: fusionResult, loading: fusionLoading } = useFusionAnalysis({
    zoneId: activeZoneData?.id ?? null,
    polygon: activeZoneData?.polygon ?? null,
    crop: activeZoneData?.crop ?? null,
    date: debouncedDate || null,
    ndmi: activeZoneData ? (zoneStats[activeZoneData.id]?.ndmi ?? null) : null,
    cloudCoverage: debouncedDate ? (cloudCoverage[debouncedDate] ?? null) : null,
  });

  const mapZones: MapZone[] = displayZones.map((z) => ({
    id: z.id,
    polygon: z.polygon,
    color: z.stress ? STRESS_COLORS[z.stress] : NEUTRAL_COLOR,
    label: `${z.id} · ${z.crop}`,
  }));

  const handleMapReady = useCallback((map: L.Map) => {
    if (!parcel) return;
    map.fitBounds(toBboxLeaflet(parcel.bbox), { padding: MAP_DEFAULTS.fitBoundsPadding });
  }, [parcel]);

  function startEdit(z: ZoneRow) {
    setEditingZone(z.id);
    setZoneDraft(z.crop);
  }

  function commitEdit(id: number) {
    setZones((prev) => {
      const next = prev.map((z) => (z.id === id ? { ...z, crop: zoneDraft } : z));
      try {
        localStorage.setItem('capataz_zones', JSON.stringify(next));
      } catch { /* ignore */ }
      return next;
    });
    setEditingZone(null);
    // El cambio de cultivo altera Kc y umbrales: re-sincronizar y recalcular
    refrescarAdvice();
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif", position: 'relative' }}>

      {/* ── Left panel ── */}
      <div style={{
        width: 360, flexShrink: 0, height: '100%', display: 'flex', flexDirection: 'column',
        background: '#fff', borderRight: '1px solid var(--c-line)', overflow: 'hidden', zIndex: 10,
      }}>

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
            {farmName}
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

          {farmMenuOpen && (
            <div style={{
              position: 'absolute', top: 54, left: 12, right: 12,
              background: '#fff', borderRadius: 'var(--r-lg)',
              border: '1px solid var(--c-line)', boxShadow: 'var(--shadow-card)', zIndex: 50,
            }}>
              <button style={{
                width: '100%', textAlign: 'left', padding: '10px 14px',
                fontSize: 13, fontWeight: 600,
                color: 'var(--accent)', background: 'var(--accent-soft)',
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              }}>
                {farmName}
              </button>
              <div style={{ height: 1, background: 'var(--c-line)', margin: '4px 0' }} />
              <a href="/mapa" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', fontSize: 13, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
                <Icons.plus size={14} /> Nuevo predio
              </a>
            </div>
          )}

          {farmEditOpen && (
            <div style={{
              position: 'absolute', top: 54, right: 12, width: 220,
              background: '#fff', borderRadius: 'var(--r-lg)',
              border: '1px solid var(--c-line)', boxShadow: 'var(--shadow-card)', zIndex: 50,
            }}>
              {[
                { label: 'Editar perímetro', href: '/mapa' },
                { label: 'Editar cuarteles', href: '/zonas' },
              ].map(({ label, href }) => (
                <a key={label} href={href} style={{
                  display: 'block', textAlign: 'left', padding: '9px 14px',
                  fontSize: 13, color: 'var(--c-text)',
                  textDecoration: 'none', fontFamily: 'inherit',
                }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--c-bg-muted)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                >
                  {label}
                </a>
              ))}
            </div>
          )}
        </div>

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

        <div style={{ padding: '10px 16px 8px', borderBottom: '1px solid var(--c-line)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>Al {isoToEs(satDates[dayIdx])}</span>
            <span style={{ fontSize: 11, color: 'var(--c-text-faint)', fontFamily: 'var(--font-ibm-plex-mono,monospace)' }}>Sentinel-2 · 4d</span>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>{zones.length} cuarteles</span>
            <span style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>{totalHa.toFixed(1)} ha</span>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {zones.length === 0 && (
            <div style={{ padding: '32px 20px', textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: 'var(--c-text-muted)', marginBottom: 14, lineHeight: 1.5 }}>
                Aún no has dibujado cuarteles para este predio.
              </p>
              <a href="/zonas" style={{
                display: 'inline-block', padding: '10px 16px',
                borderRadius: 'var(--r-md)', background: 'var(--accent)',
                color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none',
              }}>
                Dibujar cuarteles
              </a>
            </div>
          )}
          {displayZones.map((z) => (
            <div
              key={z.id}
              onClick={() => setActiveZone((v) => v === z.id ? null : z.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px',
                borderBottom: '1px solid var(--c-line)',
                background: activeZone === z.id ? 'var(--accent-soft)' : (z.stress ? STRESS_BG[z.stress] : 'transparent'),
                cursor: 'pointer', position: 'relative',
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => {
                if (activeZone !== z.id) (e.currentTarget as HTMLDivElement).style.background = 'var(--c-bg-muted)';
              }}
              onMouseLeave={(e) => {
                if (activeZone !== z.id) (e.currentTarget as HTMLDivElement).style.background = z.stress ? STRESS_BG[z.stress] : 'transparent';
              }}
            >
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: z.stress ? STRESS_COLORS[z.stress] : NEUTRAL_COLOR, borderRadius: '0 2px 2px 0' }} />

              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-text-faint)', minWidth: 22, textAlign: 'right', paddingLeft: 6 }}>
                {String(z.id).padStart(2, '0')}
              </span>

              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text)', marginBottom: 2 }}>{z.crop}</p>
                {z.rec ? (
                  <p style={{ fontSize: 12, color: z.stress ? REC_COLORS[z.stress] : 'var(--c-text-muted)', fontWeight: 600 }}>
                    {z.rec}
                    {z.advice?.rec.laminaMm != null && (
                      <span style={{ fontWeight: 500, color: 'var(--c-text-muted)' }}> · {z.advice.rec.laminaMm} mm</span>
                    )}
                    {z.advice?.rec.diasHastaEstres != null && z.advice.rec.diasHastaEstres > 0 && (
                      <span style={{ fontWeight: 500, color: 'var(--c-text-muted)' }}> · estrés en {z.advice.rec.diasHastaEstres}d</span>
                    )}
                  </p>
                ) : (syncFase === 'sincronizando' || syncFase === 'backfill') ? (
                  <p style={{ fontSize: 12, color: 'var(--c-text-faint)' }}>{es.riego.calculando}</p>
                ) : null}
              </div>

              {editingZone === z.id ? (
                <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: 6 }}>
                  <input
                    value={zoneDraft}
                    onChange={(e) => setZoneDraft(e.target.value)}
                    style={{
                      height: 30, padding: '0 8px', borderRadius: 'var(--r-sm)',
                      border: '1.5px solid var(--accent)', fontSize: 12,
                      fontFamily: 'inherit', outline: 'none', maxWidth: 110,
                    }}
                  />
                  <button onClick={() => commitEdit(z.id)} style={{
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
        <MapContainer
          parcel={parcel}
          drawMode={false}
          zones={mapZones}
          basemap="satellite"
          onMapReady={handleMapReady}
          selectedDate={debouncedDate || null}
          availableDates={satDates}
          onZoneClick={(id) => {
            const nid = typeof id === 'number' ? id : parseInt(String(id));
            setActiveZone((v) => (v === nid ? null : nid));
          }}
        />

        <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 20, display: 'flex', gap: 6, alignItems: 'center' }}>
          {urgentCount > 0 && (
            <div style={{ background: '#c24231', borderRadius: 99, padding: '5px 12px', fontSize: 12, fontWeight: 700, color: '#fff', boxShadow: 'var(--shadow-soft)' }}>
              {urgentCount} urgentes
            </div>
          )}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)', borderRadius: 99, padding: 3, boxShadow: 'var(--shadow-soft)' }}>
            {(['true-color', 'ndvi'] as const).map((lt) => (
              <button
                key={lt}
                onClick={() => setSelectedLayerType(lt)}
                style={{
                  borderRadius: 99, padding: '4px 12px', fontSize: 11, fontWeight: 600,
                  background: selectedLayerType === lt ? 'var(--c-text)' : 'transparent',
                  color: selectedLayerType === lt ? '#fff' : 'var(--c-text-muted)',
                  border: 'none', cursor: 'pointer', transition: 'background 0.15s',
                }}
              >
                {lt === 'true-color' ? 'Real' : 'NDVI'}
              </button>
            ))}
          </div>
        </div>

        {activeZoneData && (
          <div style={{
            position: 'absolute', top: 60, right: 16, zIndex: 20,
            width: 300, background: '#fff', borderRadius: 'var(--r-xl)',
            border: '1px solid var(--c-line)', boxShadow: 'var(--shadow-card)',
            padding: '16px 18px',
          }}>
            {fusionResult && fusionResult.ultimaImagenDias !== null && fusionResult.ultimaImagenDias > 6 && (
              <div style={{
                background: '#fef9c3', border: '1px solid #fde047',
                borderRadius: 'var(--r-md)', padding: '7px 10px', marginBottom: 10,
                display: 'flex', gap: 6, alignItems: 'center',
              }}>
                <span style={{ fontSize: 11 }}>⚠️</span>
                <p style={{ fontSize: 11, color: '#713f12', lineHeight: 1.4 }}>
                  Sin imagen óptica en {fusionResult.ultimaImagenDias} días. Usando radar SAR y clima.
                </p>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <p style={{ fontSize: 11, color: 'var(--c-text-faint)', marginBottom: 2 }}>Cuartel {activeZoneData.id}</p>
                <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-text)' }}>{activeZoneData.crop}</p>
              </div>
              {activeZoneData.stress && <StressChip level={activeZoneData.stress} />}
            </div>

            <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--c-text-muted)', marginBottom: 12 }}>
              <span>{activeZoneData.ha} ha</span>
              {activeZoneData.priority != null && (
                <>
                  <span>·</span>
                  <span>{es.riego.prioridad} {activeZoneData.priority}</span>
                </>
              )}
              {activeZoneData.advice?.origenMock && (
                <span style={{
                  fontSize: 10, fontWeight: 700, borderRadius: 99, padding: '1px 8px',
                  background: '#fef3c7', color: '#92400e', alignSelf: 'center',
                }}>
                  {es.riego.datosSimulados}
                </span>
              )}
            </div>

            <div style={{ background: 'var(--accent-soft)', borderRadius: 'var(--r-md)', padding: '10px 12px', marginBottom: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-deep)', marginBottom: 3 }}>Recomendación</p>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-deep)' }}>
                {activeZoneData.rec
                  ?? (fusionLoading ? '…' : fusionResult ? TIMING_LABEL[fusionResult.timing] : '—')}
              </p>
              {activeZoneData.advice && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {activeZoneData.advice.rec.laminaMm != null && (
                    <p style={{ fontSize: 12, color: 'var(--accent-deep)' }}>
                      {es.riego.laminaSugerida}: <b>{activeZoneData.advice.rec.laminaMm} mm</b>
                    </p>
                  )}
                  {activeZoneData.advice.rec.diasHastaEstres != null && (
                    <p style={{ fontSize: 12, color: 'var(--accent-deep)' }}>
                      {es.riego.diasHastaEstres}: <b>{activeZoneData.advice.rec.diasHastaEstres}</b>
                    </p>
                  )}
                  <p style={{ fontSize: 12, color: 'var(--accent-deep)' }}>
                    {es.riego.deficit}: <b>{activeZoneData.advice.rec.deficitPct.toFixed(0)}%</b>
                  </p>
                  {activeZoneData.advice.rec.postergar &&
                    activeZoneData.advice.rec.lluviaProximaMm != null &&
                    activeZoneData.advice.rec.lluviaProximaDias != null && (
                    <p style={{
                      fontSize: 11, color: '#1d4ed8', background: '#dbeafe',
                      borderRadius: 'var(--r-sm)', padding: '4px 8px', marginTop: 2,
                    }}>
                      {es.riego.postergarLluvia
                        .replace('{mm}', String(activeZoneData.advice.rec.lluviaProximaMm))
                        .replace('{dias}', String(activeZoneData.advice.rec.lluviaProximaDias))}
                    </p>
                  )}
                  {activeZoneData.advice.rec.supuestos.includes('sin_registro_riego') && (
                    <p style={{ fontSize: 10, color: 'var(--c-text-faint)', marginTop: 2 }}>
                      {es.riego.sinRegistroRiego}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              {(() => {
                const stat = zoneStats[activeZoneData.id];
                const fmtIdx = (v: number | null | undefined) =>
                  stat?.loading ? '…' : v != null ? v.toFixed(2) : '—';
                return [
                  { label: 'NDVI', value: fmtIdx(stat?.ndvi) },
                  { label: 'NDMI', value: fmtIdx(stat?.ndmi) },
                ];
              })().map(({ label, value }) => (
                <div key={label} style={{
                  background: 'var(--c-bg-muted)', borderRadius: 'var(--r-md)',
                  padding: '8px 10px', textAlign: 'center',
                }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text)' }}>{value}</p>
                  <p style={{ fontSize: 10, color: 'var(--c-text-faint)', marginTop: 2 }}>{label}</p>
                </div>
              ))}
            </div>

            {activeZoneData.advice ? (
              <div style={{ borderTop: '1px solid var(--c-line)', paddingTop: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-faint)' }}>
                    {labelConfianza(activeZoneData.advice.rec.confianza)}
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, borderRadius: 99,
                    padding: '2px 8px', color: '#fff',
                    background: colorConfianza(activeZoneData.advice.rec.confianza),
                  }}>
                    {activeZoneData.advice.rec.confianza}
                  </span>
                </div>
                {activeZoneData.advice.evaluacion && activeZoneData.advice.evaluacion.maeDeficitPct != null && (
                  <p style={{ fontSize: 11, color: 'var(--c-text-muted)', lineHeight: 1.5, marginBottom: 6 }}>
                    {es.riego.validacion
                      .replace('{n}', String(activeZoneData.advice.evaluacion.nObservaciones))
                      .replace('{mae}', String(activeZoneData.advice.evaluacion.maeDeficitPct))}
                  </p>
                )}
                <p style={{ fontSize: 10, color: 'var(--c-text-faint)', marginBottom: 6 }}>
                  {es.riego.balanceAl.replace('{fecha}', isoToEs(activeZoneData.advice.fechaBalance))}
                </p>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {activeZoneData.advice.fuentes.map((f) => (
                    <span key={f} style={{
                      fontSize: 10, padding: '2px 7px', borderRadius: 99,
                      background: 'var(--c-bg-muted)', border: '1px solid var(--c-line)',
                      color: 'var(--c-text-muted)', fontWeight: 600,
                    }}>
                      {labelFuente(f)}
                    </span>
                  ))}
                </div>
                {activeZoneData.uuid && (
                  <RiegoForm zoneUuid={activeZoneData.uuid} onSaved={refrescarAdvice} />
                )}
              </div>
            ) : fusionResult && (
              <div style={{ borderTop: '1px solid var(--c-line)', paddingTop: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-faint)' }}>
                    {labelConfianza(fusionResult.confianza)}
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, borderRadius: 99,
                    padding: '2px 8px', color: '#fff',
                    background: colorConfianza(fusionResult.confianza),
                  }}>
                    {fusionResult.confianza}
                  </span>
                </div>
                <p style={{ fontSize: 11, color: 'var(--c-text-muted)', lineHeight: 1.5, marginBottom: 6 }}>
                  {textoConfianza(fusionResult.confianza, fusionResult.ultimaImagenDias)}
                </p>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {fusionResult.fuentes.map((f) => (
                    <span key={f} style={{
                      fontSize: 10, padding: '2px 7px', borderRadius: 99,
                      background: 'var(--c-bg-muted)', border: '1px solid var(--c-line)',
                      color: 'var(--c-text-muted)', fontWeight: 600,
                    }}>
                      {labelFuente(f)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20,
          background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)',
          borderTop: '1px solid var(--c-line)', padding: '12px 20px 16px',
        }}>
          {(weatherForecast.length > 0 || weatherLoading) && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
                {weatherLoading
                  ? Array.from({ length: 7 }).map((_, i) => (
                      <div key={i} style={{
                        flex: '0 0 auto', width: 52, background: 'var(--c-bg-muted)',
                        borderRadius: 'var(--r-md)', padding: '6px 0', textAlign: 'center',
                        opacity: 0.5,
                      }}>
                        <div style={{ height: 11, width: 30, background: 'var(--c-line)', borderRadius: 4, margin: '0 auto 4px' }} />
                        <div style={{ height: 16, width: 20, background: 'var(--c-line)', borderRadius: 4, margin: '0 auto 4px' }} />
                        <div style={{ height: 10, width: 28, background: 'var(--c-line)', borderRadius: 4, margin: '0 auto' }} />
                      </div>
                    ))
                  : weatherForecast.map((day, i) => {
                      const [y, m, d] = day.fecha.split('-').map(Number);
                      const dt = new Date(y, m - 1, d);
                      const isToday = i === 0;
                      const dayName = isToday ? 'Hoy' : dt.toLocaleDateString('es-CL', { weekday: 'short' }).replace('.', '');
                      const rain = day.precipitacionMm;
                      const icon = rain === 0 ? '☀️' : rain < 2 ? '🌤️' : rain < 8 ? '🌦️' : '🌧️';
                      return (
                        <div key={day.fecha} style={{
                          flex: '0 0 auto', width: 52,
                          background: isToday ? 'var(--accent-soft)' : 'var(--c-bg-muted)',
                          border: isToday ? '1px solid var(--accent)' : '1px solid transparent',
                          borderRadius: 'var(--r-md)', padding: '6px 4px',
                          textAlign: 'center',
                        }}>
                          <p style={{ fontSize: 10, fontWeight: 600, color: isToday ? 'var(--accent-deep)' : 'var(--c-text-faint)', marginBottom: 2, textTransform: 'capitalize' }}>
                            {dayName}
                          </p>
                          <p style={{ fontSize: 16, lineHeight: 1, marginBottom: 3 }}>{icon}</p>
                          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text)' }}>
                            {Math.round(day.tMax)}°
                          </p>
                          <p style={{ fontSize: 10, color: 'var(--c-text-faint)' }}>
                            {Math.round(day.tMin)}°
                          </p>
                          {rain > 0 && (
                            <p style={{ fontSize: 9, color: '#2563eb', marginTop: 2, fontWeight: 600 }}>
                              {rain.toFixed(0)}mm
                            </p>
                          )}
                        </div>
                      );
                    })}
              </div>
            </div>
          )}

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
              {isoToEs(satDates[dayIdx])}
            </span>
          </div>
          <TimelineSlider value={dayIdx} onChange={setDayIdx} min={0} max={Math.max(0, satDates.length - 1)} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--c-text-faint)' }}>{isoToEs(satDates[0])}</span>
            <span style={{ fontSize: 11, color: 'var(--c-text-faint)' }}>{isoToEs(satDates[satDates.length - 1])}</span>
          </div>
        </div>
      </div>

      {activateOpen && <PaymentSheet onClose={() => setActivateOpen(false)} totalHa={totalHa} />}

      <style>{`
        div:hover .zone-edit-btn { opacity: 1 !important; }
      `}</style>
    </div>
  );
}
