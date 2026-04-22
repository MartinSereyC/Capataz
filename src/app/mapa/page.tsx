"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { Icons } from "@/components/ui/Icons";
import { Btn } from "@/components/ui/Btn";
import { TextField } from "@/components/ui/TextField";

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

export default function MapaPage() {
  const [drawn, setDrawn] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [query, setQuery] = useState('');

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

  return (
    <div style={{ position: 'relative', overflow: 'hidden', height: '100vh', width: '100vw', fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif" }}>

      {/* ── Map (fills entire viewport) ── */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <MapContainer
          parcel={null}
          drawMode={true}
          onManualConfirm={() => setDrawn(true)}
          onManualCancel={() => setDrawn(false)}
        />
      </div>

      {/* ── Top bar ── */}
      <div style={{
        position: 'absolute', top: 20, left: 20, right: 20, zIndex: 20,
        display: 'flex', gap: 10, alignItems: 'center',
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

        {/* Search input */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 10,
          background: '#fff', border: '1px solid var(--c-line)',
          borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-soft)',
          padding: '0 14px', height: 44,
        }}>
          <Icons.search size={16} style={{ color: 'var(--c-text-faint)', flexShrink: 0 }} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar ubicación…"
            style={{
              flex: 1, border: 'none', outline: 'none', fontSize: 14,
              color: 'var(--c-text)', background: 'transparent', fontFamily: 'inherit',
            }}
          />
          <span style={{ fontSize: 11, color: 'var(--c-text-faint)', fontFamily: 'var(--font-ibm-plex-mono,monospace)', flexShrink: 0 }}>
            −34.17, −70.74
          </span>
        </div>

        {/* Híbrido button */}
        <button style={{
          display: 'flex', alignItems: 'center', gap: 6,
          height: 44, padding: '0 14px', borderRadius: 'var(--r-lg)',
          background: '#fff', border: '1px solid var(--c-line)',
          boxShadow: 'var(--shadow-soft)', fontSize: 13, fontWeight: 600,
          color: 'var(--c-text)', cursor: 'pointer', flexShrink: 0,
        }}>
          <Icons.layers size={16} />
          Híbrido
        </button>
      </div>

      {/* ── Drawing toolbar ── */}
      <div style={{
        position: 'absolute', top: 90, left: 20, zIndex: 20,
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        {[
          { icon: <Icons.polygon size={18} />, label: 'Polígono', active: true },
          { icon: <Icons.undo size={18} />, label: 'Deshacer', active: false },
          { icon: <Icons.trash size={18} />, label: 'Limpiar', active: false },
        ].map(({ icon, label, active }) => (
          <button
            key={label}
            title={label}
            style={{
              width: 44, height: 44, borderRadius: 'var(--r-lg)',
              background: active ? 'var(--accent)' : '#fff',
              border: active ? 'none' : '1px solid var(--c-line)',
              color: active ? '#fff' : 'var(--c-text-muted)',
              boxShadow: 'var(--shadow-soft)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            {icon}
          </button>
        ))}
      </div>

      {/* ── Hint card (desktop) ── */}
      <div style={{
        position: 'absolute', top: 90, right: 20, zIndex: 20,
        width: 320, background: '#fff', borderRadius: 'var(--r-xl)',
        border: '1px solid var(--c-line)', boxShadow: 'var(--shadow-card)',
        padding: '20px 22px',
      }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 10 }}>
          Paso 1 de 3
        </p>
        <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.4, marginBottom: 10, color: 'var(--c-text)' }}>
          Dibuja el contorno de tu predio
        </h2>
        <p style={{ fontSize: 13, color: 'var(--c-text-muted)', lineHeight: 1.6, marginBottom: 14 }}>
          Haz click en el mapa para ir marcando los vértices del límite de tu campo. Cierra el polígono haciendo doble click en el último punto.
        </p>
        <div style={{
          background: 'var(--accent-soft)', border: '1px solid var(--accent-line)',
          borderRadius: 'var(--r-md)', padding: '10px 14px',
        }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-deep)' }}>
            💡 TIP
          </p>
          <p style={{ fontSize: 12, color: 'var(--accent-deep)', lineHeight: 1.5, marginTop: 3 }}>
            Usa la vista satélite para trazar el límite con precisión sobre las imágenes reales de tu campo.
          </p>
        </div>
      </div>

      {/* ── Measurement chip (when drawn) ── */}
      {drawn && (
        <div style={{
          position: 'absolute', bottom: 110, left: '50%', transform: 'translateX(-50%)', zIndex: 20,
          background: 'rgba(20,25,20,0.85)', backdropFilter: 'blur(8px)',
          borderRadius: 99, padding: '8px 20px',
          fontSize: 13, fontWeight: 600, color: '#fff',
          whiteSpace: 'nowrap', letterSpacing: 0.2,
        }}>
          7 puntos · 42.3 ha · 2.7 km perímetro
        </div>
      )}

      {/* ── Zoom buttons ── */}
      <div style={{
        position: 'absolute', right: 20, bottom: 140, zIndex: 20,
        display: 'flex', flexDirection: 'column', gap: 2,
      }}>
        {['+', '−'].map((label) => (
          <button
            key={label}
            style={{
              width: 40, height: 40, borderRadius: label === '+' ? '8px 8px 0 0' : '0 0 8px 8px',
              background: '#fff', border: '1px solid var(--c-line)',
              boxShadow: 'var(--shadow-soft)', fontSize: 18, fontWeight: 400,
              color: 'var(--c-text)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Save button (bottom full width) ── */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20,
        background: 'linear-gradient(to top, rgba(255,255,255,0.98) 60%, transparent)',
        padding: '20px 20px 24px',
      }}>
        <button
          onClick={() => drawn && setSheetOpen(true)}
          disabled={!drawn}
          style={{
            width: '100%', height: 72, borderRadius: 'var(--r-xl)',
            background: drawn ? 'var(--accent)' : 'var(--c-line-strong)',
            color: '#fff', border: 'none', cursor: drawn ? 'pointer' : 'not-allowed',
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
