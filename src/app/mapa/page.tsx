"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type L from "leaflet";
import { Icons } from "@/components/ui/Icons";
import { Btn } from "@/components/ui/Btn";
import { TextField } from "@/components/ui/TextField";
import type { BasemapType } from "@/lib/constants";
import { NOMINATIM_CONFIG } from "@/lib/constants";
import { searchLocation } from "@/lib/geo/geocode";
import { es } from "@/lib/i18n/es";
import type { GeocodingResult } from "@/types";
import type { ManualDrawApi } from "@/components/map/ManualDraw";

// Dynamic import — Leaflet requires browser APIs
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

const BASEMAP_OPTIONS: { id: BasemapType; label: string }[] = [
  { id: "street", label: es.map.basemapStreet },
  { id: "satellite", label: es.map.basemapSatellite },
  { id: "hybrid", label: es.map.basemapHybrid },
];

export default function MapaPage() {
  const [drawn, setDrawn] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Map wiring
  const mapRef = useRef<L.Map | null>(null);
  const [basemap, setBasemap] = useState<BasemapType>("hybrid");
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);

  // Manual draw wiring
  const drawApiRef = useRef<ManualDrawApi | null>(null);
  const [pointCount, setPointCount] = useState(0);
  const [editing, setEditing] = useState(false);

  // Step-card dismiss
  const [stepCardOpen, setStepCardOpen] = useState(true);

  // Search state
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);

  // Save modal form state
  const [farmName, setFarmName] = useState('');
  const [owner, setOwner] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  function handleSave() {
    if (!farmName || !email) return;
    localStorage.setItem('capataz_farm', JSON.stringify({ farmName, owner, email }));
    window.location.href = '/zonas';
  }

  const handleDrawApiReady = useCallback((api: ManualDrawApi) => {
    drawApiRef.current = api;
  }, []);

  // Clicking Guardar: finalize polygon (if needed) and open the modal
  const handleGuardarClick = useCallback(() => {
    if (pointCount < 3) return;
    if (!drawn) drawApiRef.current?.finish();
    setSheetOpen(true);
  }, [pointCount, drawn]);

  // ── Search: debounced Nominatim call ──
  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    setSearchError(false);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.length < NOMINATIM_CONFIG.minQueryLength) {
      setResults([]);
      setResultsOpen(false);
      setSearching(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setSearching(true);
      try {
        const found = await searchLocation(value, controller.signal);
        setResults(found);
        setResultsOpen(true);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setSearchError(true);
      } finally {
        setSearching(false);
      }
    }, NOMINATIM_CONFIG.debounceMs);
  }, []);

  const handleSelectResult = useCallback((r: GeocodingResult) => {
    // boundingbox: [south, north, west, east]
    const [south, north, west, east] = r.boundingbox;
    mapRef.current?.fitBounds([[south, west], [north, east]]);
    setQuery('');
    setResults([]);
    setResultsOpen(false);
  }, []);

  // Close search dropdown on outside click
  useEffect(() => {
    function handleDown(e: MouseEvent) {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setResultsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleDown);
    return () => document.removeEventListener('mousedown', handleDown);
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Derived state for toolbar button enabled-ness
  const hasPoints = pointCount > 0;
  const canEdit = pointCount >= 3;
  const canSave = pointCount >= 3;

  return (
    <div style={{ position: 'relative', overflow: 'hidden', height: '100vh', width: '100vw', fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif" }}>

      {/* ── Map (fills entire viewport) ── */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <MapContainer
          parcel={null}
          drawMode={true}
          basemap={basemap}
          onBasemapChange={setBasemap}
          onMapReady={(m) => { mapRef.current = m; }}
          onCenterChange={setCenter}
          hideInMapControls={true}
          onManualConfirm={() => setDrawn(true)}
          onManualCancel={() => setDrawn(false)}
          onManualDrawApi={handleDrawApiReady}
          onPointsChange={setPointCount}
          onEditChange={setEditing}
        />
      </div>

      {/* ── Top bar ── */}
      <div style={{
        position: 'absolute', top: 20, left: 20, right: 20, zIndex: 20,
        display: 'flex', gap: 10, alignItems: 'flex-start',
      }}>
        {/* Back */}
        <a href="/" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 44, height: 44, borderRadius: 'var(--r-lg)',
          background: '#fff', border: '1px solid var(--c-line)',
          boxShadow: 'var(--shadow-soft)', textDecoration: 'none', color: 'var(--c-text)',
          flexShrink: 0,
        }}>
          <svg width={18} height={18} viewBox="0 0 20 20" fill="none">
            <path d="M13 4 L7 10 L13 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>

        {/* Search input + dropdown */}
        <div ref={searchWrapRef} style={{ flex: 1, position: 'relative' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: '#fff', border: '1px solid var(--c-line)',
            borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-soft)',
            padding: '0 14px', height: 44,
          }}>
            <Icons.search size={16} style={{ color: 'var(--c-text-faint)', flexShrink: 0 }} />
            <input
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onFocus={() => { if (results.length > 0) setResultsOpen(true); }}
              placeholder="Buscar ubicación…"
              style={{
                flex: 1, border: 'none', outline: 'none', fontSize: 14,
                color: 'var(--c-text)', background: 'transparent', fontFamily: 'inherit',
              }}
            />
            <span style={{ fontSize: 11, color: 'var(--c-text-faint)', fontFamily: 'var(--font-ibm-plex-mono,monospace)', flexShrink: 0 }}>
              {center ? `${center.lat.toFixed(2)}, ${center.lng.toFixed(2)}` : '—'}
            </span>
          </div>

          {resultsOpen && query.length >= NOMINATIM_CONFIG.minQueryLength && (
            <div style={{
              position: 'absolute', top: 48, left: 0, right: 0,
              background: '#fff', border: '1px solid var(--c-line)',
              borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-card)',
              overflow: 'hidden', zIndex: 30,
            }}>
              {searching && (
                <div style={{ padding: '10px 14px', fontSize: 13, color: 'var(--c-text-muted)' }}>
                  {es.search.loading}
                </div>
              )}
              {!searching && searchError && (
                <div style={{ padding: '10px 14px', fontSize: 13, color: '#b91c1c' }}>
                  {es.search.error}
                </div>
              )}
              {!searching && !searchError && results.length === 0 && (
                <div style={{ padding: '10px 14px', fontSize: 13, color: 'var(--c-text-muted)' }}>
                  {es.search.noResults}
                </div>
              )}
              {!searching && results.map((r) => (
                <button
                  key={`${r.lat}-${r.lng}`}
                  type="button"
                  onClick={() => handleSelectResult(r)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '10px 14px', fontSize: 13, color: 'var(--c-text)',
                    background: 'transparent', border: 'none', borderBottom: '1px solid var(--c-line)',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  {r.displayName}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Basemap segmented control — always visible */}
        <div
          style={{
            display: 'flex', alignItems: 'center',
            height: 44, padding: 4, gap: 2,
            background: '#fff', border: '1px solid var(--c-line)',
            borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-soft)',
            flexShrink: 0,
          }}
        >
          {BASEMAP_OPTIONS.map((opt) => {
            const active = opt.id === basemap;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setBasemap(opt.id)}
                style={{
                  height: 36, padding: '0 14px', borderRadius: 'calc(var(--r-lg) - 4px)',
                  fontSize: 13, fontWeight: active ? 700 : 500,
                  color: active ? '#fff' : 'var(--c-text-muted)',
                  background: active ? 'var(--accent)' : 'transparent',
                  border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Drawing toolbar (functional) ── */}
      <div style={{
        position: 'absolute', top: 90, left: 20, zIndex: 20,
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        {([
          {
            key: 'draw',
            icon: <Icons.polygon size={18} />,
            label: editing ? 'Volver a dibujar' : 'Dibujar polígono',
            active: !editing,
            disabled: false,
            onClick: () => { if (editing) drawApiRef.current?.setEdit(false); },
          },
          {
            key: 'edit',
            icon: <Icons.pencil size={18} />,
            label: 'Editar vértices',
            active: editing,
            disabled: !canEdit,
            onClick: () => drawApiRef.current?.toggleEdit(),
          },
          {
            key: 'undo',
            icon: <Icons.undo size={18} />,
            label: 'Deshacer último',
            active: false,
            disabled: !hasPoints,
            onClick: () => drawApiRef.current?.undo(),
          },
          {
            key: 'clear',
            icon: <Icons.trash size={18} />,
            label: 'Limpiar todo',
            active: false,
            disabled: !hasPoints,
            onClick: () => { drawApiRef.current?.clear(); setDrawn(false); },
          },
        ] as const).map(({ key, icon, label, active, disabled, onClick }) => (
          <button
            key={key}
            type="button"
            title={label}
            onClick={onClick}
            disabled={disabled}
            style={{
              width: 44, height: 44, borderRadius: 'var(--r-lg)',
              background: active ? 'var(--accent)' : '#fff',
              border: active ? 'none' : '1px solid var(--c-line)',
              color: active ? '#fff' : disabled ? 'var(--c-line-strong)' : 'var(--c-text-muted)',
              boxShadow: 'var(--shadow-soft)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.5 : 1,
              transition: 'background 0.15s, color 0.15s, opacity 0.15s',
            }}
          >
            {icon}
          </button>
        ))}
      </div>

      {/* ── Hint card (desktop) — dismissable ── */}
      {stepCardOpen && (
        <div style={{
          position: 'absolute', top: 90, right: 20, zIndex: 20,
          width: 320, background: '#fff', borderRadius: 'var(--r-xl)',
          border: '1px solid var(--c-line)', boxShadow: 'var(--shadow-card)',
          padding: '20px 22px',
        }}>
          <button
            type="button"
            onClick={() => setStepCardOpen(false)}
            aria-label="Cerrar"
            style={{
              position: 'absolute', top: 10, right: 10,
              width: 28, height: 28, borderRadius: 8,
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--c-text-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, lineHeight: 1,
            }}
          >
            <svg width={14} height={14} viewBox="0 0 14 14" fill="none">
              <path d="M3 3 L11 11 M11 3 L3 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 10 }}>
            Paso 1 de 3
          </p>
          <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.4, marginBottom: 10, color: 'var(--c-text)' }}>
            Dibuja el contorno de tu predio
          </h2>
          <p style={{ fontSize: 13, color: 'var(--c-text-muted)', lineHeight: 1.6, marginBottom: 14 }}>
            Haz clic en el mapa para marcar cada vértice del límite de tu campo. Con al menos 3 puntos puedes presionar <strong>Guardar predio</strong> para cerrar el perímetro, o ajustar los vértices con la herramienta de edición (lápiz).
          </p>
          <div style={{
            background: 'var(--accent-soft)', border: '1px solid var(--accent-line)',
            borderRadius: 'var(--r-md)', padding: '10px 14px',
          }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-deep)' }}>
              💡 TIP
            </p>
            <p style={{ fontSize: 12, color: 'var(--accent-deep)', lineHeight: 1.5, marginTop: 3 }}>
              Usa la vista satélite o híbrido para trazar el límite con precisión sobre las imágenes reales de tu campo.
            </p>
          </div>
        </div>
      )}

      {/* ── Measurement chip (when drawn) ── */}
      {pointCount > 0 && (
        <div style={{
          position: 'absolute', bottom: 110, left: '50%', transform: 'translateX(-50%)', zIndex: 20,
          background: 'rgba(20,25,20,0.85)', backdropFilter: 'blur(8px)',
          borderRadius: 99, padding: '8px 20px',
          fontSize: 13, fontWeight: 600, color: '#fff',
          whiteSpace: 'nowrap', letterSpacing: 0.2,
        }}>
          {pointCount} punto{pointCount !== 1 ? 's' : ''}
          {editing && ' · editando vértices'}
          {!editing && pointCount >= 3 && ' · listo para guardar'}
        </div>
      )}

      {/* ── Zoom buttons ── */}
      <div style={{
        position: 'absolute', right: 20, bottom: 140, zIndex: 20,
        display: 'flex', flexDirection: 'column', gap: 2,
      }}>
        <button
          type="button"
          onClick={() => mapRef.current?.zoomIn()}
          aria-label="Acercar"
          style={{
            width: 40, height: 40, borderRadius: '8px 8px 0 0',
            background: '#fff', border: '1px solid var(--c-line)',
            boxShadow: 'var(--shadow-soft)', fontSize: 18, fontWeight: 400,
            color: 'var(--c-text)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          +
        </button>
        <button
          type="button"
          onClick={() => mapRef.current?.zoomOut()}
          aria-label="Alejar"
          style={{
            width: 40, height: 40, borderRadius: '0 0 8px 8px',
            background: '#fff', border: '1px solid var(--c-line)',
            boxShadow: 'var(--shadow-soft)', fontSize: 18, fontWeight: 400,
            color: 'var(--c-text)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          −
        </button>
      </div>

      {/* ── Save button (bottom full width) ── */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20,
        background: 'linear-gradient(to top, rgba(255,255,255,0.98) 60%, transparent)',
        padding: '20px 20px 24px',
      }}>
        <button
          onClick={handleGuardarClick}
          disabled={!canSave}
          style={{
            width: '100%', height: 72, borderRadius: 'var(--r-xl)',
            background: canSave ? 'var(--accent)' : 'var(--c-line-strong)',
            color: '#fff', border: 'none', cursor: canSave ? 'pointer' : 'not-allowed',
            fontSize: 18, fontWeight: 700, letterSpacing: -0.3,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            transition: 'background 0.2s',
          }}
        >
          <Icons.check size={22} />
          Guardar predio
        </button>
      </div>

      {/* ── Save modal ── */}
      {sheetOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(20,25,20,0.55)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20,
        }}>
          <div style={{
            background: '#fff', borderRadius: 'var(--r-xl)',
            boxShadow: 'var(--shadow-card)',
            padding: '32px 32px 28px',
            width: '100%', maxWidth: 440,
          }}>
            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.2, color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 6 }}>
              Guardar predio
            </p>
            <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5, marginBottom: 24, color: 'var(--c-text)' }}>
              Crea tu cuenta para guardar
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
              <TextField label="Nombre del predio" value={farmName} onChange={setFarmName} placeholder="Ej: Fundo Los Almendros" />
              <TextField label="Tu nombre" value={owner} onChange={setOwner} placeholder="Juan Pérez" autoComplete="name" />
              <TextField label="Correo electrónico" value={email} onChange={setEmail} placeholder="tu@correo.cl" type="email" autoComplete="email" />

              {/* Password field with show/hide */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-muted)' }}>Contraseña</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    autoComplete="new-password"
                    style={{
                      width: '100%', height: 44, padding: '0 44px 0 14px',
                      borderRadius: 'var(--r-md)', border: '1.5px solid var(--c-line-strong)',
                      fontSize: 14, color: 'var(--c-text)', outline: 'none',
                      fontFamily: 'inherit', boxSizing: 'border-box', background: '#fff',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    style={{
                      position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 12, color: 'var(--c-text-faint)', fontWeight: 600,
                    }}
                  >
                    {showPassword ? 'Ocultar' : 'Ver'}
                  </button>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Btn variant="primary" size="lg" full onClick={handleSave}>
                Guardar y activar
              </Btn>
              <Btn variant="secondary" size="md" full onClick={() => setSheetOpen(false)}>
                Volver al mapa
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
