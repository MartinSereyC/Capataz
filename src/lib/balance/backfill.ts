// Backfill de 14 meses por zona (clima, suelo, S2, S1 → balance → backtest)
// y catch-up incremental (refresh). Jobs idempotentes y reanudables vía
// backfill_jobs.cursor; re-POSTear el backfill retoma donde quedó.
import { getZone } from '../db/repos/zones';
import { upsertWeatherDaily, getUltimaFechaObservada } from '../db/repos/weather';
import { upsertObservations } from '../db/repos/satellite';
import { insertSoilSnapshot, getLatestSoilSnapshot } from '../db/repos/soil';
import { ensureJob, marcarJob, listJobs, type BackfillJob, type TipoJob } from '../db/repos/jobs';
import { obtenerClimaArchivo } from '../clima/open-meteo-archive';
import { obtenerClimaHistoricoYForecast } from '../clima/open-meteo';
import { mockClimaRange } from '../clima/mock';
import { obtenerSuelo } from '../suelo/soilgrids';
import { obtenerSueloMock } from '../suelo/mock';
import { isMockMode } from '../sentinel/mock';
import { getS2StatsHistory, getS1StatsHistory } from '../sentinel/statistical';
import { cultivoSlug, parametrosCultivo } from './cultivos';
import { calcularTawMm } from './taw';
import { ejecutarBalanceZona, ejecutarBacktestZona, hoyISO, sumarDias, sumarMeses } from './run';

const MESES_BACKFILL = 14;
const CHUNK_MESES = 6;

async function correrJob(
  zoneId: string,
  tipo: TipoJob,
  desde: string,
  hasta: string,
  fn: (job: BackfillJob) => Promise<void>,
): Promise<BackfillJob> {
  const job = await ensureJob(zoneId, tipo, desde, hasta);
  if (job.estado === 'completado') return job;
  await marcarJob(job.id, 'en_progreso');
  try {
    await fn(job);
    await marcarJob(job.id, 'completado');
    return { ...job, estado: 'completado' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await marcarJob(job.id, 'error', { error: msg });
    throw err;
  }
}

async function backfillClima(zoneId: string, desde: string, hasta: string): Promise<void> {
  const zone = await getZone(zoneId);
  if (!zone) throw new Error('zona no encontrada');

  await correrJob(zoneId, 'clima', desde, hasta, async () => {
    const serie = isMockMode()
      ? mockClimaRange(zone.centroidLat, zone.centroidLng, desde, hasta)
      : await obtenerClimaArchivo(zone.centroidLat, zone.centroidLng, desde, hasta);
    await upsertWeatherDaily(zone.farmId, serie);

    // Puente del rezago del archivo (~5 días) + pronóstico de 7 días
    const extra = isMockMode()
      ? [
          ...mockClimaRange(zone.centroidLat, zone.centroidLng, sumarDias(hoyISO(), -13), hoyISO()),
          ...mockClimaRange(zone.centroidLat, zone.centroidLng, sumarDias(hoyISO(), 1), sumarDias(hoyISO(), 7), true),
        ]
      : await obtenerClimaHistoricoYForecast(zone.centroidLat, zone.centroidLng, 14, 7);
    await upsertWeatherDaily(zone.farmId, extra);
  });
}

async function backfillSuelo(zoneId: string, desde: string, hasta: string): Promise<void> {
  const zone = await getZone(zoneId);
  if (!zone) throw new Error('zona no encontrada');

  await correrJob(zoneId, 'suelo', desde, hasta, async () => {
    if (await getLatestSoilSnapshot(zoneId)) return; // snapshot vigente
    const suelo = isMockMode()
      ? obtenerSueloMock(zone.centroidLat, zone.centroidLng)
      : await obtenerSuelo(zone.centroidLat, zone.centroidLng);
    const p = parametrosCultivo(cultivoSlug(zone.cultivo));
    const taw = calcularTawMm(suelo, p.profundidadRaizM);
    await insertSoilSnapshot(zoneId, suelo, p.profundidadRaizM, Math.round(taw * 10) / 10);
  });
}

async function backfillSensor(zoneId: string, sensor: 's2' | 's1', desde: string, hasta: string): Promise<void> {
  const zone = await getZone(zoneId);
  if (!zone) throw new Error('zona no encontrada');

  await correrJob(zoneId, sensor, desde, hasta, async (job) => {
    // Reanudar desde el cursor si un intento previo quedó a medias
    let inicio = job.cursor ? sumarDias(job.cursor, 1) : desde;
    while (inicio <= hasta) {
      const finChunk = sumarMeses(inicio, CHUNK_MESES) < hasta ? sumarMeses(inicio, CHUNK_MESES) : hasta;
      if (sensor === 's2') {
        const entries = await getS2StatsHistory(zone.polygon, inicio, finChunk);
        await upsertObservations(entries.map((e) => ({
          zoneId, fecha: e.fecha, sensor: 's2' as const,
          ndvi: e.ndvi, ndmi: e.ndmi, nubosidadPct: e.nubosidadPct, origen: e.origen,
        })));
      } else {
        const entries = await getS1StatsHistory(zone.polygon, inicio, finChunk);
        await upsertObservations(entries.map((e) => ({
          zoneId, fecha: e.fecha, sensor: 's1' as const,
          vvDb: e.vvDb, vhDb: e.vhDb, orbit: e.orbit, origen: e.origen,
        })));
      }
      await marcarJob(job.id, 'en_progreso', { cursor: finChunk });
      inicio = sumarDias(finChunk, 1);
    }
  });
}

export interface ResumenBackfill {
  jobs: BackfillJob[];
  backtest?: {
    fitted: boolean;
    maeDeficitPct: number | null;
    nObservaciones: number;
    errorPorHorizonte: Record<string, number>;
  };
}

// Corre (o reanuda) la secuencia completa de backfill para una zona.
export async function ejecutarBackfillZona(zoneId: string): Promise<ResumenBackfill> {
  const hoy = hoyISO();
  const desde = sumarMeses(hoy, -MESES_BACKFILL);

  await backfillClima(zoneId, desde, hoy);
  await backfillSuelo(zoneId, desde, hoy);
  await backfillSensor(zoneId, 's2', desde, hoy);
  await backfillSensor(zoneId, 's1', desde, hoy);

  await correrJob(zoneId, 'balance', desde, hoy, async () => {
    await ejecutarBalanceZona(zoneId, desde, hoy);
  });

  let backtest: ResumenBackfill['backtest'];
  await correrJob(zoneId, 'backtest', desde, hoy, async () => {
    const r = await ejecutarBacktestZona(zoneId);
    backtest = {
      fitted: r.fitted,
      maeDeficitPct: r.evaluacion.maeDeficitPct,
      nObservaciones: r.evaluacion.nObservaciones,
      errorPorHorizonte: r.evaluacion.errorPorHorizonte,
    };
  });

  return { jobs: await listJobs(zoneId), backtest };
}

export async function estadoBackfillZona(zoneId: string): Promise<BackfillJob[]> {
  return listJobs(zoneId);
}

// Catch-up incremental: clima desde el último observado, pasadas satelitales
// nuevas y rebalance de la ventana completa (replay barato en memoria).
export async function refreshZona(zoneId: string): Promise<void> {
  const zone = await getZone(zoneId);
  if (!zone) throw new Error('zona no encontrada');
  const hoy = hoyISO();
  const desde = sumarMeses(hoy, -MESES_BACKFILL);

  const ultimaClima = await getUltimaFechaObservada(zone.farmId);
  if (isMockMode()) {
    const inicio = ultimaClima ? sumarDias(ultimaClima, 1) : sumarDias(hoy, -14);
    if (inicio <= hoy) {
      await upsertWeatherDaily(zone.farmId, mockClimaRange(zone.centroidLat, zone.centroidLng, inicio, hoy));
    }
    await upsertWeatherDaily(
      zone.farmId,
      mockClimaRange(zone.centroidLat, zone.centroidLng, sumarDias(hoy, 1), sumarDias(hoy, 7), true),
    );
  } else {
    const gapDias = ultimaClima
      ? Math.min(92, Math.max(1, Math.round((Date.parse(hoy) - Date.parse(ultimaClima)) / 86_400_000)))
      : 14;
    if (ultimaClima && gapDias >= 80) {
      // Ausencia larga: rellenar con el archivo antes del puente del forecast
      await upsertWeatherDaily(zone.farmId, await obtenerClimaArchivo(
        zone.centroidLat, zone.centroidLng, sumarDias(ultimaClima, 1), hoy,
      ));
    }
    await upsertWeatherDaily(zone.farmId, await obtenerClimaHistoricoYForecast(
      zone.centroidLat, zone.centroidLng, gapDias, 7,
    ));
  }

  // Pasadas satelitales nuevas (ventana corta hacia atrás por solapamiento)
  const inicioSat = sumarDias(hoy, -21);
  const [s2, s1] = await Promise.all([
    getS2StatsHistory(zone.polygon, inicioSat, hoy),
    getS1StatsHistory(zone.polygon, inicioSat, hoy),
  ]);
  await upsertObservations(s2.map((e) => ({
    zoneId, fecha: e.fecha, sensor: 's2' as const,
    ndvi: e.ndvi, ndmi: e.ndmi, nubosidadPct: e.nubosidadPct, origen: e.origen,
  })));
  await upsertObservations(s1.map((e) => ({
    zoneId, fecha: e.fecha, sensor: 's1' as const,
    vvDb: e.vvDb, vhDb: e.vhDb, orbit: e.orbit, origen: e.origen,
  })));

  await ejecutarBalanceZona(zoneId, desde, hoy);
}
