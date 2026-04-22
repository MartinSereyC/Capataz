"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { Icons } from "@/components/ui/Icons";
import { Btn } from "@/components/ui/Btn";

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

const CROPS = [
  'Palta Hass', 'Uva de mesa', 'Uva vinífera', 'Cerezo', 'Nogal',
  'Kiwi', 'Manzano', 'Peral', 'Arándano', 'Maíz', 'Trigo', 'Avena',
  'Pradera', 'Hortalizas', 'Otro',
];

interface ZoneItem {
  id: number;
  crop: string;
  ha: number;
  pts: string;
}

const DEMO_ZONES: ZoneItem[] = [
  { id: 1, crop: 'Palta Hass',  ha: 8.2, pts: "20,22 40,18 44,44 22,48" },
  { id: 2, crop: 'Palta Hass',  ha: 6.4, pts: "40,18 58,14 64,40 44,44" },
  { id: 3, crop: 'Uva de mesa', ha: 7.1, pts: "58,14 86,28 82,50 64,40" },
  { id: 4, crop: 'Cerezo',      ha: 5.8, pts: "22,48 44,44 48,70 26,72" },
];

function centroid(pts: string): [number, number] {
  const pairs = pts.split(' ').map((p) => p.split(',').map(Number) as [number, number]);
  return [
    pairs.reduce((s, [x]) => s + x, 0) / pairs.length,
    pairs.reduce((s, [, y]) => s + y, 0) / pairs.length,
  ];
}

const ZONE_COLORS = ['#2d6a3e', '#4a8a52', '#7aaa70', '#aac890'];

export default function ZonasPage() {
  const [zones, setZones] = useState<ZoneItem[]>(DEMO_ZONES);
  const [drawing, setDrawing] = useState(false);
  const [selectedCrop, setSelectedCrop] = useState(CROPS[0]);
  const [farmName] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const d = JSON.parse(localStorage.getItem('capataz_farm') ?? '{}');
        return d.farmName ?? 'Mi Campo';
      } catch { return 'Mi Campo'; }
    }
    return 'Mi Campo';
  });

  function deleteZone(id: number) {
    setZones((z) => z.filter((zone) => zone.id !== id));
  }

  function finishDrawing() {
    // Add a mock zone from drawing
    const nextId = Math.max(0, ...zones.map((z) => z.id)) + 1;
    setZones((prev) => [
      ...prev,
      { id: nextId, crop: selectedCrop, ha: +(3 + Math.random() * 5).toFixed(1), pts: "26,72 48,70 50,84 34,82 14,60 22,48" },
    ]);
    setDrawing(false);
  }

  function handleSaveZones() {
    localStorage.setItem('capataz_zones', JSON.stringify(zones));
    window.location.href = '/dashboard';
  }

  const totalHa = zones.reduce((s, z) => s + z.ha, 0);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif" }}>

      {/* ── Left panel ── */}
      <div style={{
        width: 380, flexShrink: 0, height: '100%', display: 'flex', flexDirection: 'column',
        background: '#fff', borderRight: '1px solid var(--c-line)', overflow: 'hidden',
        zIndex: 10,
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid var(--c-line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <a href="/mapa" style={{
              width: 36, height: 36, borderRadius: 'var(--r-md)',
              background: 'var(--c-bg-muted)', border: '1px solid var(--c-line)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              textDecoration: 'none', color: 'var(--c-text)',
            }}>
              <svg width={16} height={16} viewBox="0 0 20 20" fill="none">
                <path d="M13 4 L7 10 L13 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: 'var(--accent)', textTransform: 'uppercase' }}>Paso 2 de 3</p>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text)' }}>{farmName}</p>
            </div>
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4, marginBottom: 6, color: 'var(--c-text)' }}>
            Define tus cuarteles
          </h2>
          <p style={{ fontSize: 13, color: 'var(--c-text-muted)', lineHeight: 1.5 }}>
            Dibuja cada cuartel y asígnale el cultivo correspondiente.
          </p>
        </div>

        {/* Zone list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {zones.map((z, i) => (
              <div key={z.id} style={{
                background: '#fff', borderRadius: 'var(--r-lg)',
                border: '1px solid var(--c-line)',
                padding: '12px 14px',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                {/* Number badge */}
                <div style={{
                  width: 28, height: 28, borderRadius: 'var(--r-md)',
                  background: ZONE_COLORS[i % ZONE_COLORS.length],
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, flexShrink: 0,
                }}>
                  {z.id}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text)' }}>{z.crop}</p>
                  <p style={{ fontSize: 12, color: 'var(--c-text-faint)' }}>{z.ha} ha</p>
                </div>
                <button
                  onClick={() => deleteZone(z.id)}
                  style={{
                    width: 30, height: 30, borderRadius: 'var(--r-sm)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--c-text-faint)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Icons.trash size={15} />
                </button>
              </div>
            ))}
          </div>

          {/* Drawing state */}
          {drawing ? (
            <div style={{
              border: '2px dashed var(--accent)', borderRadius: 'var(--r-lg)',
              padding: '14px 16px', background: 'var(--accent-soft)', marginBottom: 8,
            }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-deep)', marginBottom: 10 }}>
                Dibujando cuartel nuevo…
              </p>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-muted)', display: 'block', marginBottom: 6 }}>
                  Cultivo
                </label>
                <select
                  value={selectedCrop}
                  onChange={(e) => setSelectedCrop(e.target.value)}
                  style={{
                    width: '100%', height: 40, padding: '0 10px',
                    borderRadius: 'var(--r-md)', border: '1.5px solid var(--accent-line)',
                    background: '#fff', fontSize: 13, color: 'var(--c-text)',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  {CROPS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn variant="primary" size="sm" full onClick={finishDrawing}>
                  Terminar trazo
                </Btn>
                <Btn variant="secondary" size="sm" onClick={() => setDrawing(false)}>
                  Cancelar
                </Btn>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setDrawing(true)}
              style={{
                width: '100%', border: '2px dashed var(--c-line-strong)',
                borderRadius: 'var(--r-lg)', padding: '14px 0',
                background: 'transparent', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                fontSize: 14, fontWeight: 600, color: 'var(--c-text-muted)',
                transition: 'border-color 0.15s, color 0.15s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)';
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--c-line-strong)';
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--c-text-muted)';
              }}
            >
              <Icons.plus size={18} />
              Nuevo cuartel
            </button>
          )}
        </div>

        {/* Footer — pinned */}
        <div style={{ padding: '14px 16px', borderTop: '1px solid var(--c-line)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--c-text-muted)' }}>{zones.length} cuarteles</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text)' }}>{totalHa.toFixed(1)} ha total</span>
          </div>
          <Btn variant="primary" size="lg" full onClick={handleSaveZones} disabled={zones.length === 0}>
            Guardar y activar
          </Btn>
        </div>
      </div>

      {/* ── Right map area ── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <MapContainer parcel={null} drawMode={drawing} />

        {/* SVG overlay with zone polygons */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid slice"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 5 }}
        >
          {/* Perimeter outline */}
          <polygon
            points="14,22 86,14 92,76 14,76"
            fill="none"
            stroke="#fff"
            strokeWidth="0.6"
            strokeDasharray="3 2"
            opacity="0.7"
          />
          {zones.map((z, i) => {
            const [cx, cy] = centroid(z.pts);
            return (
              <g key={z.id}>
                <polygon
                  points={z.pts}
                  fill={ZONE_COLORS[i % ZONE_COLORS.length]}
                  fillOpacity="0.4"
                  stroke={ZONE_COLORS[i % ZONE_COLORS.length]}
                  strokeWidth="0.5"
                />
                <circle cx={cx} cy={cy} r="3.2" fill="#fff" fillOpacity="0.9" />
                <text x={cx} y={cy + 1.1} textAnchor="middle" fontSize="2.8" fontWeight="700"
                  fill={ZONE_COLORS[i % ZONE_COLORS.length]} fontFamily="Inter,sans-serif">
                  {z.id}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Drawing toolbar (top right) */}
        <div style={{
          position: 'absolute', top: 20, right: 20, zIndex: 20,
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          {[
            { icon: <Icons.polygon size={18} />, label: 'Polígono', active: drawing },
            { icon: <Icons.undo size={18} />, label: 'Deshacer' },
            { icon: <Icons.layers size={18} />, label: 'Capas' },
          ].map(({ icon, label, active }) => (
            <button key={label} title={label} style={{
              width: 44, height: 44, borderRadius: 'var(--r-lg)',
              background: active ? 'var(--accent)' : '#fff',
              border: active ? 'none' : '1px solid var(--c-line)',
              color: active ? '#fff' : 'var(--c-text-muted)',
              boxShadow: 'var(--shadow-soft)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}>
              {icon}
            </button>
          ))}
        </div>

        {/* Drawing hint pill */}
        {drawing && (
          <div style={{
            position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)',
            zIndex: 20, background: 'rgba(20,25,20,0.85)', backdropFilter: 'blur(8px)',
            borderRadius: 99, padding: '8px 20px',
            fontSize: 12, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap',
          }}>
            Haz click en cada esquina del cuartel · doble click para cerrar
          </div>
        )}
      </div>
    </div>
  );
}
