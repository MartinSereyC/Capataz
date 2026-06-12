// Recomendación cuantificada de riego a partir del estado del balance:
// semáforo, lámina (mm), días hasta estrés (simulación con pronóstico),
// regla de postergación por lluvia y confianza (medida cuando hay hindcast).
import type { EntradaFenologica } from '../fenologia/types';
import { type EstadoBalance, pasoDiario } from './paso';

export type Semaforo = 'verde' | 'amarillo' | 'rojo';
export type Timing = 'hoy' | 'mañana' | '3-4 días' | 'no urgente';
export type Confianza = 'alta' | 'media' | 'baja';
export type FuenteDato = 'sentinel-2' | 'sentinel-1' | 'clima' | 'suelo';

const HORIZONTE_SIM_DIAS = 14;
const FACTOR_LLUVIA_POSTERGA = 0.8;

// Semáforo + timing desde déficit % vs umbrales fenológicos.
// (Lógica movida desde fusion/engine.ts; fuente única para ambos motores.)
export function deficitToRecomendacion(
  deficitPct: number,
  umbralRojo: number,
  umbralAmarillo: number,
): { semaforo: Semaforo; timing: Timing } {
  if (deficitPct >= umbralRojo) {
    return { semaforo: 'rojo', timing: 'hoy' };
  }
  const midpoint = umbralAmarillo + (umbralRojo - umbralAmarillo) * 0.5;
  if (deficitPct >= midpoint) {
    return { semaforo: 'amarillo', timing: 'mañana' };
  }
  if (deficitPct >= umbralAmarillo) {
    return { semaforo: 'amarillo', timing: '3-4 días' };
  }
  return { semaforo: 'verde', timing: 'no urgente' };
}

export interface DiaPronostico {
  fecha: string;
  et0Mm: number;
  precipMm: number;
}

export interface ErrorPorHorizonte {
  // MAE de déficit (%) por bucket de días desde el último anclaje satelital
  [bucket: string]: number; // '0-3d' | '4-7d' | '8-14d'
}

export interface EntradaRecomendacion {
  estado: EstadoBalance;
  deficitPct: number;
  fen: EntradaFenologica;
  pronostico: DiaPronostico[]; // próximos ~7 días
  fuentes: FuenteDato[];
  diasDesdeS2: number | null;
  diasDesdeS1: number | null;
  riegoAsumido: boolean; // hubo días sin registro de riego en la ventana reciente
  errorPorHorizonte?: ErrorPorHorizonte | null; // del hindcast, si existe
}

export interface RecomendacionRiego {
  semaforo: Semaforo;
  timing: Timing;
  laminaMm: number | null; // lámina neta sugerida (rellenar Dr); null en verde
  diasHastaEstres: number | null; // null si > horizonte de simulación
  lluviaProximaMm: number | null;
  lluviaProximaDias: number | null;
  postergar: boolean;
  confianza: Confianza;
  deficitPct: number;
  supuestos: string[];
}

// Simula el balance hacia adelante con el pronóstico (sin riego) y devuelve
// en cuántos días el déficit cruza el umbral rojo. null si no cruza.
export function simularDiasHastaEstres(
  estado: EstadoBalance,
  kc: number,
  umbralRojoPct: number,
  pronostico: DiaPronostico[],
): number | null {
  if ((estado.agotamientoMm / estado.tawMm) * 100 >= umbralRojoPct) return 0;

  let current = estado;
  const ultimoEt0 = pronostico.length > 0 ? pronostico[pronostico.length - 1].et0Mm : 4;

  for (let d = 0; d < HORIZONTE_SIM_DIAS; d++) {
    const dia = pronostico[d] ?? { fecha: `+${d}`, et0Mm: ultimoEt0, precipMm: 0 };
    const paso = pasoDiario(current, {
      fecha: dia.fecha,
      et0Mm: dia.et0Mm,
      kc,
      precipMm: dia.precipMm,
      riegoMm: 0,
      riegoAsumido: false,
    });
    if (paso.deficitPct >= umbralRojoPct) return d + 1;
    current = { ...current, agotamientoMm: paso.agotamientoMm };
  }
  return null;
}

function bucketHorizonte(dias: number): string {
  if (dias <= 3) return '0-3d';
  if (dias <= 7) return '4-7d';
  return '8-14d';
}

// Confianza: medida (hindcast) cuando hay evaluación; reglas de frescura si no.
export function derivarConfianza(
  diasDesdeS2: number | null,
  diasDesdeS1: number | null,
  errorPorHorizonte: ErrorPorHorizonte | null | undefined,
): Confianza {
  const diasDesdeAnclaje = diasDesdeS2 ?? diasDesdeS1;
  if (errorPorHorizonte && diasDesdeAnclaje !== null) {
    const mae = errorPorHorizonte[bucketHorizonte(diasDesdeAnclaje)];
    if (mae !== undefined) {
      if (mae < 5) return 'alta';
      if (mae < 10) return 'media';
      return 'baja';
    }
  }
  if (diasDesdeS2 !== null && diasDesdeS2 <= 6) return 'alta';
  if (diasDesdeS1 !== null && diasDesdeS1 <= 14) return 'media';
  return 'baja';
}

export function calcularRecomendacion(e: EntradaRecomendacion): RecomendacionRiego {
  const { estado, deficitPct, fen, pronostico } = e;
  const { semaforo, timing } = deficitToRecomendacion(
    deficitPct,
    fen.umbralRojoDeficitPct,
    fen.umbralAmarilloDeficitPct,
  );

  const laminaMm = semaforo === 'verde' ? null : Math.round(estado.agotamientoMm);

  const diasHastaEstres = simularDiasHastaEstres(
    estado,
    fen.kcReferencia,
    fen.umbralRojoDeficitPct,
    pronostico,
  );

  // Lluvia efectiva acumulada en el pronóstico y día de la primera lluvia relevante
  let lluviaAcum = 0;
  let lluviaProximaDias: number | null = null;
  pronostico.forEach((dia, i) => {
    if (dia.precipMm >= 5) {
      lluviaAcum += dia.precipMm * 0.8;
      if (lluviaProximaDias === null) lluviaProximaDias = i + 1;
    }
  });
  const lluviaProximaMm = lluviaAcum > 0 ? Math.round(lluviaAcum * 10) / 10 : null;

  // Postergar: la lluvia esperada cubre ≥80% de la lámina y llega antes del estrés
  let postergar = false;
  let timingFinal = timing;
  if (
    laminaMm !== null &&
    lluviaProximaMm !== null &&
    lluviaProximaDias !== null &&
    lluviaProximaMm >= laminaMm * FACTOR_LLUVIA_POSTERGA &&
    (diasHastaEstres === null || lluviaProximaDias <= diasHastaEstres)
  ) {
    postergar = true;
    if (timingFinal === 'hoy') timingFinal = 'mañana';
    else if (timingFinal === 'mañana') timingFinal = '3-4 días';
    else if (timingFinal === '3-4 días') timingFinal = 'no urgente';
  }

  const supuestos: string[] = [];
  if (e.riegoAsumido) supuestos.push('sin_registro_riego');

  return {
    semaforo,
    timing: timingFinal,
    laminaMm,
    diasHastaEstres,
    lluviaProximaMm,
    lluviaProximaDias,
    postergar,
    confianza: derivarConfianza(e.diasDesdeS2, e.diasDesdeS1, e.errorPorHorizonte),
    deficitPct: Math.round(deficitPct * 10) / 10,
    supuestos,
  };
}

const ORDEN_SEMAFORO: Record<Semaforo, number> = { rojo: 0, amarillo: 1, verde: 2 };

// Ranking de zonas dentro del predio: rojo primero, luego menos días hasta
// estrés, luego mayor déficit. prioridad 1 = más urgente.
export function priorizarZonas(
  items: Array<{ zoneId: string; rec: RecomendacionRiego }>,
): Array<{ zoneId: string; prioridad: number }> {
  const sorted = [...items].sort((a, b) => {
    const s = ORDEN_SEMAFORO[a.rec.semaforo] - ORDEN_SEMAFORO[b.rec.semaforo];
    if (s !== 0) return s;
    const da = a.rec.diasHastaEstres ?? Infinity;
    const db = b.rec.diasHastaEstres ?? Infinity;
    if (da !== db) return da - db;
    return b.rec.deficitPct - a.rec.deficitPct;
  });
  return sorted.map((item, i) => ({ zoneId: item.zoneId, prioridad: i + 1 }));
}
