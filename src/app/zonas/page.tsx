"use client";

import React, { useCallback, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Icons } from "@/components/ui/Icons";
import { Btn } from "@/components/ui/Btn";
import type { Parcel, GeoJSONPolygon, BboxGeoJSON } from "@/types";
import type { ManualDrawApi } from "@/components/map/ManualDraw";
import type { MapZone } from "@/components/map/MapContainer";
import { polygonOnOrInsidePolygon } from "@/lib/geo/polygon-builder";
import type { BasemapType } from "@/lib/constants";

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
  name: string;
  crop: string;
  ha: number;
  polygon: GeoJSONPolygon;
  bbox: BboxGeoJSON;
}

const ZONE_COLORS = ['#2d6a3e', '#4a8a52', '#7aaa70', '#aac890'];

export default function ZonasPage() {
  const [zones, setZones] = useState<ZoneItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('capataz_zones');
        return raw ? (JSON.parse(raw) as ZoneItem[]) : [];
      } catch { return []; }
    }
    return [];
  });

  const [hasExistingZones] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('capataz_zones');
        return raw ? (JSON.parse(raw) as ZoneItem[]).length > 0 : false;
      } catch { return false; }
    }
    return false;
  });

  const [drawing, setDrawing] = useState(false);
  const [pointCount, setPointCount] = useState(0);
  const [drawError, setDrawError] = useState<string | null>(null);
  const [selectedCrop, setSelectedCrop] = useState(CROPS[0]);
  const selectedCropRef = useRef(CROPS[0]);
  const [zoneName, setZoneName] = useState('');
  const zoneNameRef = useRef('');
  const [basemap, setBasemap] = useState<BasemapType>('satellite');
  const drawApiRef = useRef<ManualDrawApi | null>(null);

  const [editingZoneId, setEditingZoneId] = useState<number | null>(null);
  const editingZoneIdRef = useRef<number | null>(null);
  const [initialDrawPoints, setInitialDrawPoints] = useState<[number, number][] | undefined>(undefined);

  const [farmName] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const d = JSON.parse(localStorage.getItem('capataz_farm') ?? '{}');
        return d.farmName ?? 'Mi Campo';
      } catch { return 'Mi Campo'; }
    }
    return 'Mi Campo';
  });
  const [parcel] = useState<Parcel | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('capataz_parcel');
        return raw ? (JSON.parse(raw) as Parcel) : null;
      } catch { return null; }
    }
    return null;
  });

  const handleDrawApiReady = useCallback((api: ManualDrawApi) => {
    drawApiRef.current = api;
  }, []);

  function startDrawing() {
    setDrawError(null);
    setPointCount(0);
    setZoneName('');
    zoneNameRef.current = '';
    setSelectedCrop(CROPS[0]);
    selectedCropRef.current = CROPS[0];
    setEditingZoneId(null);
    editingZoneIdRef.current = null;
    setInitialDrawPoints(undefined);
    setDrawing(true);
  }

  function startEditingZone(zone: ZoneItem) {
    setDrawError(null);
    setPointCount(0);
    setZoneName(zone.name);
    zoneNameRef.current = zone.name;
    setSelectedCrop(zone.crop);
    selectedCropRef.current = zone.crop;
    setEditingZoneId(zone.id);
    editingZoneIdRef.current = zone.id;
    // Drop the closing duplicate point that GeoJSON adds
    const ring = zone.polygon.coordinates[0] as [number, number][];
    const pts = ring.slice(0, ring.length - 1);
    setInitialDrawPoints(pts);
    setDrawing(true);
  }

  function cancelDrawing() {
    drawApiRef.current?.clear();
    setDrawing(false);
    setPointCount(0);
    setDrawError(null);
    setZoneName('');
    zoneNameRef.current = '';
    setEditingZoneId(null);
    editingZoneIdRef.current = null;
    setInitialDrawPoints(undefined);
  }

  function saveZoneClick() {
    if (pointCount < 3) return;
    drawApiRef.current?.finish();
  }

  const handleManualConfirm = useCallback((p: Parcel) => {
    if (!parcel) {
      setDrawError('Falta el contorno del predio. Vuelve al paso 1.');
      return;
    }
    if (!polygonOnOrInsidePolygon(p.polygon, parcel.polygon)) {
      setDrawError('La zona debe quedar completamente dentro del predio.');
      return;
    }

    const currentEditId = editingZoneIdRef.current;

    setZones((prev) => {
      if (currentEditId !== null) {
        return prev.map((z) =>
          z.id === currentEditId
            ? {
                ...z,
                name: zoneNameRef.current.trim() || z.name,
                crop: selectedCropRef.current,
                ha: +p.area_hectares.toFixed(1),
                polygon: p.polygon,
                bbox: p.bbox,
              }
            : z
        );
      }
      const nextId = Math.max(0, ...prev.map((z) => z.id)) + 1;
      const name = zoneNameRef.current.trim() || `Cuartel ${nextId}`;
      return [
        ...prev,
        {
          id: nextId,
          name,
          crop: selectedCropRef.current,
          ha: +p.area_hectares.toFixed(1),
          polygon: p.polygon,
          bbox: p.bbox,
        },
      ];
    });

    setDrawing(false);
    setPointCount(0);
    setDrawError(null);
    setZoneName('');
    zoneNameRef.current = '';
    setEditingZoneId(null);
    editingZoneIdRef.current = null;
    setInitialDrawPoints(undefined);
  }, [parcel]);

  const handleManualCancel = useCallback(() => {
    setDrawing(false);
    setPointCount(0);
    setDrawError(null);
    setZoneName('');
    zoneNameRef.current = '';
    setEditingZoneId(null);
    editingZoneIdRef.current = null;
    setInitialDrawPoints(undefined);
  }, []);

  function deleteZone(id: number) {
    setZones((z) => z.filter((zone) => zone.id !== id));
  }

  function handleSaveZones() {
    localStorage.setItem('capataz_zones', JSON.stringify(zones));
    window.location.href = '/dashboard';
  }

  const totalHa = zones.reduce((s, z) => s + z.ha, 0);

  const mapZones: MapZone[] = zones
    .filter((z) => z.id !== editingZoneId)
    .map((z, i) => ({
      id: z.id,
      polygon: z.polygon,
      color: ZONE_COLORS[i % ZONE_COLORS.length],
      label: z.name,
    }));

  const backHref = hasExistingZones ? '/dashboard' : '/mapa';

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
            <a href={backHref} style={{
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
              {hasExistingZones ? (
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text)' }}>{farmName}</p>
              ) : (
                <>
                  <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: 'var(--accent)', textTransform: 'uppercase' }}>Paso 2 de 3</p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text)' }}>{farmName}</p>
                </>
              )}
            </div>
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4, marginBottom: 6, color: 'var(--c-text)' }}>
            {hasExistingZones ? 'Editar cuarteles' : 'Define tus cuarteles'}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--c-text-muted)', lineHeight: 1.5 }}>
            {hasExistingZones
              ? 'Renombra, cambia cultivo o edita el contorno de cada cuartel.'
              : 'Dibuja cada cuartel y asígnale el cultivo correspondiente.'}
          </p>
        </div>

        {/* Zone list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {zones.map((z, i) => (
              <div key={z.id} style={{
                background: '#fff', borderRadius: 'var(--r-lg)',
                border: `1px solid ${z.id === editingZoneId ? 'var(--accent)' : 'var(--c-line)'}`,
                padding: '12px 14px',
                display: 'flex', alignItems: 'center', gap: 10,
                opacity: drawing && z.id !== editingZoneId ? 0.4 : 1,
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 'var(--r-md)',
                  background: ZONE_COLORS[i % ZONE_COLORS.length],
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, flexShrink: 0,
                }}>
                  {z.id}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text)' }}>{z.name}</p>
                  <p style={{ fontSize: 12, color: 'var(--c-text-faint)' }}>{z.crop} · {z.ha} ha</p>
                </div>
                {!drawing && (
                  <>
                    <button
                      onClick={() => startEditingZone(z)}
                      title="Editar cuartel"
                      style={{
                        width: 30, height: 30, borderRadius: 'var(--r-sm)',
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--c-text-faint)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Icons.pencil size={14} />
                    </button>
                    <button
                      onClick={() => deleteZone(z.id)}
                      title="Eliminar cuartel"
                      style={{
                        width: 30, height: 30, borderRadius: 'var(--r-sm)',
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--c-text-faint)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Icons.trash size={15} />
                    </button>
                  </>
                )}
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
                {editingZoneId !== null ? 'Editando cuartel…' : 'Dibujando cuartel nuevo…'}
              </p>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-muted)', display: 'block', marginBottom: 6 }}>
                  Nombre del cuartel
                </label>
                <input
                  type="text"
                  value={zoneName}
                  onChange={(e) => { setZoneName(e.target.value); zoneNameRef.current = e.target.value; }}
                  placeholder="Ej: Cuartel Norte"
                  style={{
                    width: '100%', height: 40, padding: '0 10px',
                    borderRadius: 'var(--r-md)', border: '1.5px solid var(--accent-line)',
                    background: '#fff', fontSize: 13, color: 'var(--c-text)',
                    fontFamily: 'inherit', boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-muted)', display: 'block', marginBottom: 6 }}>
                  Cultivo
                </label>
                <select
                  value={selectedCrop}
                  onChange={(e) => { setSelectedCrop(e.target.value); selectedCropRef.current = e.target.value; }}
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
              <p style={{ fontSize: 12, color: 'var(--c-text-muted)', marginBottom: 10 }}>
                {pointCount} punto{pointCount !== 1 ? 's' : ''} marcado{pointCount !== 1 ? 's' : ''} · mínimo 3
              </p>
              {drawError && (
                <p style={{ fontSize: 12, color: '#b91c1c', marginBottom: 10, lineHeight: 1.4 }}>
                  {drawError}
                </p>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn variant="primary" size="sm" full onClick={saveZoneClick} disabled={pointCount < 3}>
                  {editingZoneId !== null ? 'Guardar cambios' : 'Guardar zona'}
                </Btn>
                <Btn variant="secondary" size="sm" onClick={cancelDrawing}>
                  Cancelar
                </Btn>
              </div>
            </div>
          ) : (
            <button
              onClick={startDrawing}
              disabled={!parcel}
              style={{
                width: '100%', border: '2px dashed var(--c-line-strong)',
                borderRadius: 'var(--r-lg)', padding: '14px 0',
                background: 'transparent', cursor: parcel ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                fontSize: 14, fontWeight: 600, color: 'var(--c-text-muted)',
                opacity: parcel ? 1 : 0.5,
                transition: 'border-color 0.15s, color 0.15s',
              }}
              onMouseEnter={(e) => {
                if (!parcel) return;
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
            {hasExistingZones ? 'Guardar cambios' : 'Guardar y activar'}
          </Btn>
        </div>
      </div>

      {/* ── Right map area ── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <MapContainer
          parcel={parcel}
          drawMode={drawing}
          zones={mapZones}
          onManualDrawApi={handleDrawApiReady}
          onPointsChange={setPointCount}
          onManualConfirm={handleManualConfirm}
          onManualCancel={handleManualCancel}
          basemap={basemap}
          onBasemapChange={setBasemap}
          hideInMapControls={true}
          boundary={parcel?.polygon ?? undefined}
          initialDrawPoints={initialDrawPoints}
        />

        {/* Drawing toolbar (top right) */}
        <div style={{
          position: 'absolute', top: 20, right: 20, zIndex: 20,
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          {/* Polygon — active indicator while drawing */}
          <button title="Polígono" style={{
            width: 44, height: 44, borderRadius: 'var(--r-lg)',
            background: drawing ? 'var(--accent)' : '#fff',
            border: drawing ? 'none' : '1px solid var(--c-line)',
            color: drawing ? '#fff' : 'var(--c-text-muted)',
            boxShadow: 'var(--shadow-soft)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'default',
          }}>
            <Icons.polygon size={18} />
          </button>
          {/* Undo — remove last vertex */}
          <button
            title="Deshacer"
            onClick={() => drawApiRef.current?.undo()}
            disabled={!drawing || pointCount === 0}
            style={{
              width: 44, height: 44, borderRadius: 'var(--r-lg)',
              background: '#fff', border: '1px solid var(--c-line)',
              color: drawing && pointCount > 0 ? 'var(--c-text-muted)' : 'var(--c-line)',
              boxShadow: 'var(--shadow-soft)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: drawing && pointCount > 0 ? 'pointer' : 'not-allowed',
            }}
          >
            <Icons.undo size={18} />
          </button>
          {/* Capas — toggle satellite / hybrid */}
          <button
            title={basemap === 'hybrid' ? 'Ocultar etiquetas' : 'Mostrar etiquetas'}
            onClick={() => setBasemap(basemap === 'hybrid' ? 'satellite' : 'hybrid')}
            style={{
              width: 44, height: 44, borderRadius: 'var(--r-lg)',
              background: basemap === 'hybrid' ? 'var(--accent)' : '#fff',
              border: basemap === 'hybrid' ? 'none' : '1px solid var(--c-line)',
              color: basemap === 'hybrid' ? '#fff' : 'var(--c-text-muted)',
              boxShadow: 'var(--shadow-soft)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <Icons.layers size={18} />
          </button>
        </div>

        {/* Drawing hint pill */}
        {drawing && (
          <div style={{
            position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)',
            zIndex: 20, background: 'rgba(20,25,20,0.85)', backdropFilter: 'blur(8px)',
            borderRadius: 99, padding: '8px 20px',
            fontSize: 12, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap',
          }}>
            {editingZoneId !== null
              ? 'Arrastra los vértices para editar · doble click para confirmar'
              : 'Haz click en cada esquina del cuartel · doble click para cerrar'}
          </div>
        )}
      </div>
    </div>
  );
}
