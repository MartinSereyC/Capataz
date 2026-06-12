import { getSql } from '../client';

export interface SatObsInput {
  zoneId: string;
  fecha: string;
  sensor: 's2' | 's1';
  ndvi?: number | null;
  ndmi?: number | null;
  vvDb?: number | null;
  vhDb?: number | null;
  orbit?: string | null;
  nubosidadPct?: number | null;
  origen: string;
}

export interface SatObsRow {
  zoneId: string;
  fecha: string;
  sensor: 's2' | 's1';
  ndvi: number | null;
  ndmi: number | null;
  vvDb: number | null;
  vhDb: number | null;
  orbit: string | null;
  nubosidadPct: number | null;
  origen: string;
}

export async function upsertObservations(obs: SatObsInput[]): Promise<void> {
  if (obs.length === 0) return;
  const sql = getSql();
  for (const o of obs) {
    await sql`
      insert into satellite_observations (zone_id, fecha, sensor, ndvi, ndmi, vv_db, vh_db, orbit, nubosidad_pct, origen)
      values (${o.zoneId}, ${o.fecha}, ${o.sensor}, ${o.ndvi ?? null}, ${o.ndmi ?? null},
              ${o.vvDb ?? null}, ${o.vhDb ?? null}, ${o.orbit ?? null}, ${o.nubosidadPct ?? null}, ${o.origen})
      on conflict (zone_id, fecha, sensor) do update set
        ndvi = excluded.ndvi,
        ndmi = excluded.ndmi,
        vv_db = excluded.vv_db,
        vh_db = excluded.vh_db,
        orbit = excluded.orbit,
        nubosidad_pct = excluded.nubosidad_pct,
        origen = excluded.origen,
        fetched_at = now()
    `;
  }
}

function rowToObs(r: Record<string, unknown>): SatObsRow {
  return {
    zoneId: r.zone_id as string,
    fecha: r.fecha instanceof Date ? r.fecha.toISOString().split('T')[0] : String(r.fecha),
    sensor: r.sensor as 's2' | 's1',
    ndvi: r.ndvi !== null ? Number(r.ndvi) : null,
    ndmi: r.ndmi !== null ? Number(r.ndmi) : null,
    vvDb: r.vv_db !== null ? Number(r.vv_db) : null,
    vhDb: r.vh_db !== null ? Number(r.vh_db) : null,
    orbit: r.orbit as string | null,
    nubosidadPct: r.nubosidad_pct !== null ? Number(r.nubosidad_pct) : null,
    origen: r.origen as string,
  };
}

export async function getObservationsRange(
  zoneId: string,
  desde: string,
  hasta: string,
): Promise<SatObsRow[]> {
  const sql = getSql();
  const rows = await sql`
    select * from satellite_observations
    where zone_id = ${zoneId} and fecha >= ${desde} and fecha <= ${hasta}
    order by fecha
  `;
  return rows.map(rowToObs);
}

export async function getUltimaObservacion(zoneId: string, sensor: 's2' | 's1'): Promise<SatObsRow | null> {
  const sql = getSql();
  const rows = await sql`
    select * from satellite_observations
    where zone_id = ${zoneId} and sensor = ${sensor}
    order by fecha desc limit 1
  `;
  return rows.length > 0 ? rowToObs(rows[0]) : null;
}

export interface MonthlyNdviStats {
  mes: number;
  n: number;
  ndviP20: number | null;
  ndviP50: number | null;
  ndviP80: number | null;
  ndmiP50: number | null;
}

export async function getMonthlyNdviPercentiles(zoneId: string): Promise<MonthlyNdviStats[]> {
  const sql = getSql();
  const rows = await sql`
    select mes, n, ndvi_p20, ndvi_p50, ndvi_p80, ndmi_p50
    from satellite_monthly_stats where zone_id = ${zoneId} order by mes
  `;
  return rows.map((r) => ({
    mes: Number(r.mes),
    n: Number(r.n),
    ndviP20: r.ndvi_p20 !== null ? Number(r.ndvi_p20) : null,
    ndviP50: r.ndvi_p50 !== null ? Number(r.ndvi_p50) : null,
    ndviP80: r.ndvi_p80 !== null ? Number(r.ndvi_p80) : null,
    ndmiP50: r.ndmi_p50 !== null ? Number(r.ndmi_p50) : null,
  }));
}
