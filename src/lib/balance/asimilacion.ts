// Anclaje satelital: corrige el Dr modelado con la lectura satelital del día
// (asimilación simple por promedio ponderado). Aplicado en cada pasada durante
// el replay histórico, el estado actual hereda todas las correcciones.
import type { EstadoBalance } from './paso';

export interface ObservacionAnclaje {
  sensor: 's2' | 's1';
  ndmi?: number | null;
  vvDb?: number | null;
  nubosidadPct?: number | null;
}

export interface ResultadoAnclaje {
  agotamientoMm: number;
  ajusteMm: number;
  fuente: 's2' | 's1';
}

const NUBOSIDAD_MAX_PCT = 60;
const PESO_S2 = 0.5;
const PESO_S1 = 0.25;

// Mapeos índice → déficit estimado (%). Misma calibración que fusion/engine.ts;
// exportados aquí como fuente única.
export function ndmiToDeficit(ndmi: number): number {
  if (ndmi > 0.3) return 10;
  if (ndmi > 0.1) return 25;
  if (ndmi > -0.1) return 45;
  if (ndmi > -0.3) return 65;
  return 80;
}

export function sarVvToDeficit(vvDb: number): number {
  if (vvDb > -10) return 15;
  if (vvDb > -15) return 40;
  if (vvDb > -20) return 60;
  return 80;
}

// Déficit (%) implicado por una observación satelital, o null si no es usable
// (S2 nublado, índices faltantes). Lo usa tanto el anclaje como el hindcast.
export function deficitSatelital(
  obs: ObservacionAnclaje,
  ndmiOffset = 0,
): { deficitPct: number; fuente: 's2' | 's1' } | null {
  if (obs.sensor === 's2') {
    if (obs.ndmi == null) return null;
    if (obs.nubosidadPct != null && obs.nubosidadPct >= NUBOSIDAD_MAX_PCT) return null;
    return { deficitPct: ndmiToDeficit(obs.ndmi + ndmiOffset), fuente: 's2' };
  }
  if (obs.vvDb == null) return null;
  return { deficitPct: sarVvToDeficit(obs.vvDb), fuente: 's1' };
}

export function anclarConSatelite(
  estado: EstadoBalance,
  obs: ObservacionAnclaje,
  ndmiOffset = 0,
): ResultadoAnclaje | null {
  const sat = deficitSatelital(obs, ndmiOffset);
  if (!sat) return null;
  const peso = sat.fuente === 's2' ? PESO_S2 : PESO_S1;

  const drSat = (sat.deficitPct / 100) * estado.tawMm;
  const drNuevo = (1 - peso) * estado.agotamientoMm + peso * drSat;
  const clamped = Math.max(0, Math.min(estado.tawMm, drNuevo));

  return {
    agotamientoMm: clamped,
    ajusteMm: clamped - estado.agotamientoMm,
    fuente: sat.fuente,
  };
}
