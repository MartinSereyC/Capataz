"use client";

import React, { useState } from 'react';
import { es } from '@/lib/i18n/es';

interface RiegoFormProps {
  zoneUuid: string;
  onSaved: () => void;
}

// Formulario mínimo de registro de riego (opcional para el agricultor).
// Acepta mm o horas; el balance solo usa mm (horas quedan registradas para
// conversión futura cuando se conozca el caudal del equipo).
export function RiegoForm({ zoneUuid, onSaved }: RiegoFormProps) {
  const hoy = new Date().toISOString().split('T')[0];
  const [fecha, setFecha] = useState(hoy);
  const [mm, setMm] = useState('');
  const [horas, setHoras] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const valido = fecha && (mm.trim() !== '' || horas.trim() !== '');

  async function guardar() {
    if (!valido || guardando) return;
    setGuardando(true);
    setMensaje(null);
    try {
      const res = await fetch(`/api/zones/${zoneUuid}/riegos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha,
          mmAplicados: mm.trim() !== '' ? parseFloat(mm) : null,
          horas: horas.trim() !== '' ? parseFloat(horas) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? 'error');
      setMensaje(es.riego.riegoGuardado);
      setMm('');
      setHoras('');
      onSaved();
    } catch {
      setMensaje('No se pudo registrar el riego');
    } finally {
      setGuardando(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 32, padding: '0 8px',
    borderRadius: 'var(--r-sm)', border: '1px solid var(--c-line-strong)',
    fontSize: 12, color: 'var(--c-text)', fontFamily: 'inherit',
    outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 10, fontWeight: 600, color: 'var(--c-text-muted)',
    display: 'block', marginBottom: 3,
  };

  return (
    <div style={{ borderTop: '1px solid var(--c-line)', paddingTop: 10, marginTop: 10 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-faint)', marginBottom: 8 }}>
        {es.riego.registrarRiego}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
        <div>
          <label style={labelStyle}>{es.riego.fechaRiego}</label>
          <input type="date" value={fecha} max={hoy} onChange={(e) => setFecha(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>{es.riego.mmAplicados}</label>
          <input type="number" min="0" step="1" value={mm} placeholder="mm"
            onChange={(e) => setMm(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>{es.riego.horasRiego}</label>
          <input type="number" min="0" step="0.5" value={horas} placeholder="h"
            onChange={(e) => setHoras(e.target.value)} style={inputStyle} />
        </div>
      </div>
      <button
        onClick={guardar}
        disabled={!valido || guardando}
        style={{
          width: '100%', height: 32, borderRadius: 'var(--r-sm)',
          background: valido ? 'var(--accent)' : 'var(--c-bg-muted)',
          color: valido ? '#fff' : 'var(--c-text-faint)',
          border: 'none', cursor: valido ? 'pointer' : 'not-allowed',
          fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
        }}
      >
        {guardando ? '…' : es.riego.guardarRiego}
      </button>
      {mensaje && (
        <p style={{ fontSize: 11, color: 'var(--c-text-muted)', marginTop: 6 }}>{mensaje}</p>
      )}
    </div>
  );
}
