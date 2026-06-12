// Orquestación impura del motor: carga insumos desde la DB, reproduce el
// balance, corre el backtest y calcula la recomendación. Todo lo demás en
// src/lib/balance/ son funciones puras.
import { getZone, type ZoneRow } from '../db/repos/zones';
import { getWeatherRange, type WeatherRow } from '../db/repos/weather';
import { getObservationsRange, getUltimaObservacion } from '../db/repos/satellite';
import { getLatestSoilSnapshot, type SoilSnapshotRow } from '../db/repos/soil';
import { upsertBalanceRows, getUltimoEstado } from '../db/repos/balance';
import { riegosPorFecha, listRiegos } from '../db/repos/riego';
import {
  getLatestCalibration,
  insertCalibration,
  insertEvaluation,
  getLatestEvaluation,
} from '../db/repos/calibration';
import { obtenerFenologia } from '../fenologia/lookup';
import type { EntradaFenologica } from '../fenologia/types';
import { calcularEt0Hargreaves } from '../engine/et0';
import { cultivoSlug, parametrosCultivo } from './cultivos';
import { calcularRawMm } from './taw';
import type { EstadoBalance } from './paso';
import {
  replayBalance,
  calibrarZona,
  evaluarZona,
  PARAMETROS_NEUTROS,
  type DiaHistorico,
  type ObsHistorica,
  type ParametrosZona,
} from './backtest';
import {
  calcularRecomendacion,
  type RecomendacionRiego,
  type DiaPronostico,
  type FuenteDato,
} from './recomendacion';
import { ENGINE_VERSION } from './version';

export function hoyISO(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

export function sumarDias(fecha: string, dias: number): string {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().split('T')[0];
}

export function sumarMeses(fecha: string, meses: number): string {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + meses, d)).toISOString().split('T')[0];
}

function dayOfYear(fecha: string): number {
  const [y, m, d] = fecha.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86_400_000) + 1;
}

// Fenología con defaults para cultivos fuera del catálogo (Maíz, Trigo, etc.)
export function fenologiaParaCultivo(cropDisplay: string, mes: number): EntradaFenologica {
  const slug = cultivoSlug(cropDisplay);
  if (slug) {
    try {
      return obtenerFenologia(slug, mes);
    } catch { /* defaults abajo */ }
  }
  return {
    cultivo: 'palto_hass', // marcador; no se usa para mostrar
    mes,
    fase: 'desarrollo_fruto',
    kcReferencia: 0.8,
    umbralRojoDeficitPct: 50,
    umbralAmarilloDeficitPct: 35,
    fuente: 'default',
    notas: 'Cultivo fuera del catálogo fenológico; umbrales genéricos.',
  };
}

interface InsumosBalance {
  zone: ZoneRow;
  suelo: SoilSnapshotRow;
  estadoInicial: EstadoBalance;
  dias: DiaHistorico[];
  observaciones: ObsHistorica[];
}

async function cargarInsumos(zoneId: string, desde: string, hasta: string): Promise<InsumosBalance | null> {
  const zone = await getZone(zoneId);
  if (!zone) return null;
  const suelo = await getLatestSoilSnapshot(zoneId);
  if (!suelo) return null;

  const [clima, obs, riegos] = await Promise.all([
    getWeatherRange(zone.farmId, desde, hasta),
    getObservationsRange(zoneId, desde, hasta),
    riegosPorFecha(zoneId, desde, hasta),
  ]);

  const slug = cultivoSlug(zone.cultivo);
  const p = parametrosCultivo(slug);
  const rawMm = calcularRawMm(suelo.tawMm, p.fraccionAgotamiento);

  const dias: DiaHistorico[] = clima
    .filter((w) => !w.esPronostico)
    .map((w) => ({
      fecha: w.fecha,
      et0Mm: et0DelDia(w, zone.centroidLat),
      kc: fenologiaParaCultivo(zone.cultivo, mesDe(w.fecha)).kcReferencia,
      precipMm: w.precipMm,
      riegoMm: riegos.get(w.fecha) ?? 0,
      riegoAsumido: !riegos.has(w.fecha),
    }));

  const observaciones: ObsHistorica[] = obs.map((o) => ({
    fecha: o.fecha,
    sensor: o.sensor,
    ndmi: o.ndmi,
    vvDb: o.vvDb,
    nubosidadPct: o.nubosidadPct,
  }));

  return {
    zone,
    suelo,
    estadoInicial: { agotamientoMm: 0, tawMm: suelo.tawMm, rawMm },
    dias,
    observaciones,
  };
}

function mesDe(fecha: string): number {
  return Number(fecha.split('-')[1]);
}

function et0DelDia(w: WeatherRow, lat: number): number {
  if (w.et0Mm != null) return w.et0Mm;
  if (w.tMinC != null && w.tMaxC != null && w.tMaxC >= w.tMinC) {
    return calcularEt0Hargreaves(w.tMinC, w.tMaxC, lat, dayOfYear(w.fecha));
  }
  return 3; // sin datos térmicos: valor conservador
}

// Reproduce el balance completo de la ventana y persiste las filas diarias.
export async function ejecutarBalanceZona(zoneId: string, desde: string, hasta: string): Promise<number> {
  const insumos = await cargarInsumos(zoneId, desde, hasta);
  if (!insumos) throw new Error(`Zona ${zoneId} sin datos de zona o suelo`);

  const calib = await getLatestCalibration(zoneId);
  const params: ParametrosZona = calib?.fitted
    ? { kcFactor: calib.kcFactor, ndmiOffset: calib.ndmiOffset }
    : PARAMETROS_NEUTROS;

  const replay = replayBalance(insumos.estadoInicial, insumos.dias, insumos.observaciones, params, true);
  await upsertBalanceRows(zoneId, replay.pasos, ENGINE_VERSION);
  return replay.pasos.length;
}

export interface ResultadoBacktest {
  fitted: boolean;
  params: ParametrosZona;
  maeTrain: number | null;
  evaluacion: {
    nObservaciones: number;
    maeDeficitPct: number | null;
    biasDeficitPct: number | null;
    errorPorHorizonte: Record<string, number>;
  };
}

// Calibra en (hoy−14m, hoy−3m], valida a ciegas en (hoy−3m, hoy] y persiste
// calibración + evaluación. La calibración solo se adopta si también supera
// a los parámetros neutros en la ventana de validación (guardia
// anti-sobreajuste). Luego recalcula el balance completo con lo adoptado.
export async function ejecutarBacktestZona(zoneId: string): Promise<ResultadoBacktest> {
  const hoy = hoyISO();
  const desde = sumarMeses(hoy, -14);
  const corte = sumarMeses(hoy, -3);

  const insumos = await cargarInsumos(zoneId, desde, hoy);
  if (!insumos) throw new Error(`Zona ${zoneId} sin datos de zona o suelo`);

  const diasTrain = insumos.dias.filter((d) => d.fecha <= corte);
  const diasTest = insumos.dias.filter((d) => d.fecha > corte);
  const obsTrain = insumos.observaciones.filter((o) => o.fecha <= corte);
  const obsTest = insumos.observaciones.filter((o) => o.fecha > corte);

  const cal = calibrarZona(insumos.estadoInicial, diasTrain, obsTrain);

  // Estado al final del train con cada juego de parámetros
  const replayTrainFitted = replayBalance(insumos.estadoInicial, diasTrain, obsTrain, cal.params, true);
  const replayTrainNeutral = replayBalance(insumos.estadoInicial, diasTrain, obsTrain, PARAMETROS_NEUTROS, true);

  const evFitted = evaluarZona(replayTrainFitted.estadoFinal, diasTest, obsTest, cal.params);
  const evNeutral = evaluarZona(replayTrainNeutral.estadoFinal, diasTest, obsTest, PARAMETROS_NEUTROS);

  const adoptarFitted =
    cal.maeTrain !== null &&
    evFitted.maeDeficitPct !== null &&
    evNeutral.maeDeficitPct !== null &&
    evFitted.maeDeficitPct <= evNeutral.maeDeficitPct;

  const params = adoptarFitted ? cal.params : PARAMETROS_NEUTROS;
  const evaluacion = adoptarFitted ? evFitted : evNeutral;

  await insertCalibration(zoneId, params, adoptarFitted, desde, corte, ENGINE_VERSION);
  await insertEvaluation(zoneId, evaluacion, {
    trainDesde: desde, trainHasta: corte, testDesde: corte, testHasta: hoy,
  }, params, ENGINE_VERSION);

  await ejecutarBalanceZona(zoneId, desde, hoy);

  return { fitted: adoptarFitted, params, maeTrain: cal.maeTrain, evaluacion };
}

export interface AdviceZona {
  zoneId: string;
  legacyId: number | null;
  nombre: string | null;
  cultivo: string;
  rec: RecomendacionRiego;
  fuentes: FuenteDato[];
  ultimaImagenDias: number | null;
  fechaBalance: string;
  origenMock: boolean;
  evaluacion: {
    nObservaciones: number;
    maeDeficitPct: number | null;
  } | null;
}

// Recomendación cuantificada desde el estado persistido (sin red).
export async function calcularAdviceZona(zoneId: string): Promise<AdviceZona | null> {
  const zone = await getZone(zoneId);
  if (!zone) return null;
  const ultimo = await getUltimoEstado(zoneId);
  const suelo = await getLatestSoilSnapshot(zoneId);
  if (!ultimo || !suelo) return null;

  const hoy = hoyISO();
  const fen = fenologiaParaCultivo(zone.cultivo, mesDe(hoy));

  // Pronóstico desde weather_daily (filas es_pronostico)
  const climaFuturo = await getWeatherRange(zone.farmId, sumarDias(hoy, 1), sumarDias(hoy, 7));
  const pronostico: DiaPronostico[] = climaFuturo.map((w) => ({
    fecha: w.fecha,
    et0Mm: et0DelDia(w, zone.centroidLat),
    precipMm: w.precipMm,
  }));

  const [s2, s1, evaluacion, riegosRecientes] = await Promise.all([
    getUltimaObservacion(zoneId, 's2'),
    getUltimaObservacion(zoneId, 's1'),
    getLatestEvaluation(zoneId),
    listRiegos(zoneId, sumarDias(hoy, -30)),
  ]);

  const diasDesde = (fecha: string | null): number | null => {
    if (!fecha) return null;
    const [y1, m1, d1] = fecha.split('-').map(Number);
    const [y2, m2, d2] = hoy.split('-').map(Number);
    return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
  };

  const diasDesdeS2 = diasDesde(s2?.fecha ?? null);
  const diasDesdeS1 = diasDesde(s1?.fecha ?? null);

  const fuentes: FuenteDato[] = ['clima', 'suelo'];
  if (s2) fuentes.unshift('sentinel-2');
  if (s1) fuentes.splice(s2 ? 1 : 0, 0, 'sentinel-1');

  const estado: EstadoBalance = {
    agotamientoMm: ultimo.agotamientoMm,
    tawMm: ultimo.tawMm,
    rawMm: ultimo.rawMm,
  };

  const rec = calcularRecomendacion({
    estado,
    deficitPct: ultimo.deficitPct,
    fen,
    pronostico,
    fuentes,
    diasDesdeS2,
    diasDesdeS1,
    riegoAsumido: riegosRecientes.length === 0,
    errorPorHorizonte: evaluacion?.errorPorHorizonte ?? null,
  });

  // Procedencia simulada si cualquier insumo es mock (la UI debe etiquetarlo)
  const origenMock =
    suelo.origen === 'mock' || s2?.origen === 'mock' || s1?.origen === 'mock';

  return {
    zoneId,
    legacyId: zone.legacyId,
    nombre: zone.nombre,
    cultivo: zone.cultivo,
    rec,
    fuentes,
    ultimaImagenDias: diasDesdeS2,
    fechaBalance: ultimo.fecha,
    origenMock,
    evaluacion: evaluacion
      ? { nObservaciones: evaluacion.nObservaciones, maeDeficitPct: evaluacion.maeDeficitPct }
      : null,
  };
}
