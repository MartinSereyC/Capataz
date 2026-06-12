// Hindcast y calibración por zona, sobre arreglos ya cargados (sin I/O).
//
// - replayBalance: reproduce el balance diario sobre una ventana histórica,
//   anclando con cada pasada satelital y registrando el error de predicción
//   *antes* de cada anclaje (walk-forward: cada error corresponde a N días
//   "a ciegas" desde el anclaje anterior — la métrica operacionalmente útil).
// - calibrarZona: grid search de 2 parámetros acotados sobre la ventana de
//   entrenamiento, minimizando el MAE de esos errores pre-anclaje.
// - evaluarZona: corre la ventana de validación y resume MAE/bias/error por
//   horizonte. El llamador decide si la calibración supera a los parámetros
//   neutros (guardia anti-sobreajuste).
import {
  type EstadoBalance,
  type ResultadoPaso,
  pasoDiario,
} from './paso';
import {
  anclarConSatelite,
  deficitSatelital,
  type ObservacionAnclaje,
} from './asimilacion';

export interface DiaHistorico {
  fecha: string; // YYYY-MM-DD
  et0Mm: number;
  kc: number; // Kc fenológico del mes (sin calibrar)
  precipMm: number;
  riegoMm: number;
  riegoAsumido: boolean;
}

export interface ObsHistorica extends ObservacionAnclaje {
  fecha: string;
}

export interface ParametrosZona {
  kcFactor: number; // multiplicador de Kc, neutro = 1
  ndmiOffset: number; // corrimiento del mapeo NDMI→déficit, neutro = 0
}

export const PARAMETROS_NEUTROS: ParametrosZona = { kcFactor: 1, ndmiOffset: 0 };

export interface PasoConAnclaje extends ResultadoPaso {
  ajusteSatelitalMm: number | null;
  fuenteAnclaje: 's2' | 's1' | null;
}

export interface ErrorPreAnclaje {
  fecha: string;
  horizonteDias: number; // días desde el anclaje anterior (o inicio de ventana)
  errorPct: number; // deficit modelado − deficit satelital (con signo)
  fuente: 's2' | 's1';
}

export interface ReplayResultado {
  pasos: PasoConAnclaje[];
  errores: ErrorPreAnclaje[];
  estadoFinal: EstadoBalance;
}

export function replayBalance(
  estadoInicial: EstadoBalance,
  dias: DiaHistorico[],
  observaciones: ObsHistorica[],
  params: ParametrosZona = PARAMETROS_NEUTROS,
  conAnclaje = true,
): ReplayResultado {
  const obsPorFecha = new Map<string, ObsHistorica[]>();
  for (const obs of observaciones) {
    const list = obsPorFecha.get(obs.fecha) ?? [];
    list.push(obs);
    obsPorFecha.set(obs.fecha, list);
  }

  let estado: EstadoBalance = { ...estadoInicial };
  const pasos: PasoConAnclaje[] = [];
  const errores: ErrorPreAnclaje[] = [];
  let diasDesdeAnclaje = 0;

  for (const dia of dias) {
    const paso = pasoDiario(estado, {
      fecha: dia.fecha,
      et0Mm: dia.et0Mm,
      kc: dia.kc * params.kcFactor,
      precipMm: dia.precipMm,
      riegoMm: dia.riegoMm,
      riegoAsumido: dia.riegoAsumido,
    });
    estado = { ...estado, agotamientoMm: paso.agotamientoMm };
    diasDesdeAnclaje++;

    let ajusteSatelitalMm: number | null = null;
    let fuenteAnclaje: 's2' | 's1' | null = null;

    const obsDelDia = obsPorFecha.get(dia.fecha) ?? [];
    // S2 primero: si ancla, la pasada S1 del mismo día no aporta
    obsDelDia.sort((a, b) => (a.sensor === 's2' ? -1 : 1) - (b.sensor === 's2' ? -1 : 1));

    for (const obs of obsDelDia) {
      const sat = deficitSatelital(obs, params.ndmiOffset);
      if (!sat) continue;

      errores.push({
        fecha: dia.fecha,
        horizonteDias: diasDesdeAnclaje,
        errorPct: paso.deficitPct - sat.deficitPct,
        fuente: sat.fuente,
      });

      if (conAnclaje && fuenteAnclaje === null) {
        const anclaje = anclarConSatelite(estado, obs, params.ndmiOffset);
        if (anclaje) {
          ajusteSatelitalMm = Math.round(anclaje.ajusteMm * 10) / 10;
          fuenteAnclaje = anclaje.fuente;
          estado = { ...estado, agotamientoMm: anclaje.agotamientoMm };
          diasDesdeAnclaje = 0;
        }
      }
    }

    pasos.push({
      ...paso,
      agotamientoMm: estado.agotamientoMm,
      deficitPct: (estado.agotamientoMm / estado.tawMm) * 100,
      ajusteSatelitalMm,
      fuenteAnclaje,
    });
  }

  return { pasos, errores, estadoFinal: estado };
}

function mae(errores: ErrorPreAnclaje[]): number | null {
  if (errores.length === 0) return null;
  return errores.reduce((s, e) => s + Math.abs(e.errorPct), 0) / errores.length;
}

export interface ResultadoCalibracion {
  params: ParametrosZona;
  maeTrain: number | null;
  nObservaciones: number;
}

const GRID_KC_FACTOR = [0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1, 1.05, 1.1, 1.15, 1.2, 1.25, 1.3];
const GRID_NDMI_OFFSET = [-0.1, -0.05, 0, 0.05, 0.1];

export function calibrarZona(
  estadoInicial: EstadoBalance,
  dias: DiaHistorico[],
  observaciones: ObsHistorica[],
): ResultadoCalibracion {
  let best: ResultadoCalibracion = {
    params: PARAMETROS_NEUTROS,
    maeTrain: null,
    nObservaciones: 0,
  };

  for (const kcFactor of GRID_KC_FACTOR) {
    for (const ndmiOffset of GRID_NDMI_OFFSET) {
      const params = { kcFactor, ndmiOffset };
      const replay = replayBalance(estadoInicial, dias, observaciones, params, true);
      const m = mae(replay.errores);
      if (m === null) continue;
      if (best.maeTrain === null || m < best.maeTrain) {
        best = { params, maeTrain: m, nObservaciones: replay.errores.length };
      }
    }
  }
  return best;
}

export interface EvaluacionModelo {
  nObservaciones: number;
  maeDeficitPct: number | null;
  biasDeficitPct: number | null;
  errorPorHorizonte: Record<string, number>; // bucket → MAE
}

function bucketHorizonte(dias: number): string {
  if (dias <= 3) return '0-3d';
  if (dias <= 7) return '4-7d';
  return '8-14d';
}

export function evaluarZona(
  estadoInicial: EstadoBalance,
  dias: DiaHistorico[],
  observaciones: ObsHistorica[],
  params: ParametrosZona,
): EvaluacionModelo {
  const replay = replayBalance(estadoInicial, dias, observaciones, params, true);
  const errores = replay.errores;

  if (errores.length === 0) {
    return { nObservaciones: 0, maeDeficitPct: null, biasDeficitPct: null, errorPorHorizonte: {} };
  }

  const porBucket = new Map<string, ErrorPreAnclaje[]>();
  for (const e of errores) {
    const b = bucketHorizonte(e.horizonteDias);
    const list = porBucket.get(b) ?? [];
    list.push(e);
    porBucket.set(b, list);
  }

  const errorPorHorizonte: Record<string, number> = {};
  for (const [bucket, list] of porBucket) {
    const m = mae(list);
    if (m !== null) errorPorHorizonte[bucket] = Math.round(m * 10) / 10;
  }

  const bias = errores.reduce((s, e) => s + e.errorPct, 0) / errores.length;

  return {
    nObservaciones: errores.length,
    maeDeficitPct: Math.round(mae(errores)! * 10) / 10,
    biasDeficitPct: Math.round(bias * 10) / 10,
    errorPorHorizonte,
  };
}
