import { getSql } from '../client';
import type { ClimaDiario } from '../../clima/types';

export interface WeatherRow {
  fecha: string;
  tMinC: number | null;
  tMaxC: number | null;
  precipMm: number;
  et0Mm: number | null;
  et0Metodo: string;
  esPronostico: boolean;
  origen: string;
}

// Upsert idempotente: el dato observado (es_pronostico=false) gana siempre
// sobre un pronóstico previo; un pronóstico nunca pisa un observado.
export async function upsertWeatherDaily(farmId: string, dias: ClimaDiario[]): Promise<void> {
  if (dias.length === 0) return;
  const sql = getSql();

  for (const d of dias) {
    const esPronostico = d.esPronostico ?? false;
    const et0Metodo = d.et0Mm != null
      ? (d.origen === 'mock' ? 'mock' : 'open_meteo_fao')
      : 'sin_et0';
    await sql`
      insert into weather_daily (farm_id, fecha, t_min_c, t_max_c, precip_mm, et0_mm, et0_metodo, es_pronostico, origen)
      values (${farmId}, ${d.fecha}, ${d.tMin}, ${d.tMax}, ${d.precipitacionMm},
              ${d.et0Mm ?? null}, ${et0Metodo}, ${esPronostico}, ${d.origen})
      on conflict (farm_id, fecha) do update set
        t_min_c = excluded.t_min_c,
        t_max_c = excluded.t_max_c,
        precip_mm = excluded.precip_mm,
        et0_mm = excluded.et0_mm,
        et0_metodo = excluded.et0_metodo,
        es_pronostico = excluded.es_pronostico,
        origen = excluded.origen,
        fetched_at = now()
      where weather_daily.es_pronostico or not excluded.es_pronostico
    `;
  }
}

function rowToWeather(r: Record<string, unknown>): WeatherRow {
  return {
    fecha: (r.fecha as Date | string) instanceof Date
      ? (r.fecha as Date).toISOString().split('T')[0]
      : String(r.fecha),
    tMinC: r.t_min_c !== null ? Number(r.t_min_c) : null,
    tMaxC: r.t_max_c !== null ? Number(r.t_max_c) : null,
    precipMm: Number(r.precip_mm),
    et0Mm: r.et0_mm !== null ? Number(r.et0_mm) : null,
    et0Metodo: r.et0_metodo as string,
    esPronostico: r.es_pronostico as boolean,
    origen: r.origen as string,
  };
}

export async function getWeatherRange(farmId: string, desde: string, hasta: string): Promise<WeatherRow[]> {
  const sql = getSql();
  const rows = await sql`
    select * from weather_daily
    where farm_id = ${farmId} and fecha >= ${desde} and fecha <= ${hasta}
    order by fecha
  `;
  return rows.map(rowToWeather);
}

// Última fecha con dato observado (no pronóstico), para retomar el catch-up.
export async function getUltimaFechaObservada(farmId: string): Promise<string | null> {
  const sql = getSql();
  const rows = await sql`
    select max(fecha) as ultima from weather_daily
    where farm_id = ${farmId} and not es_pronostico
  `;
  const v = rows[0]?.ultima;
  if (!v) return null;
  return v instanceof Date ? v.toISOString().split('T')[0] : String(v);
}
