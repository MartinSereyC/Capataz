import { getSql } from '../client';
import type { PasoConAnclaje } from '../../balance/backtest';

export interface BalanceRow {
  zoneId: string;
  fecha: string;
  agotamientoMm: number;
  deficitPct: number;
  tawMm: number;
  rawMm: number;
  riegoAsumido: boolean;
  fuenteAnclaje: string | null;
}

export async function upsertBalanceRows(
  zoneId: string,
  pasos: PasoConAnclaje[],
  engineVersion: string,
): Promise<void> {
  if (pasos.length === 0) return;
  const sql = getSql();

  // Lote por filas para mantener el upsert idempotente sobre (zone_id, fecha)
  for (const p of pasos) {
    await sql`
      insert into water_balance_daily (zone_id, fecha, et0_mm, kc, ks, etc_mm, precip_mm,
        precip_efectiva_mm, riego_mm, riego_asumido, taw_mm, raw_mm, agotamiento_mm,
        deficit_pct, ajuste_satelital_mm, fuente_anclaje, engine_version)
      values (${zoneId}, ${p.fecha}, ${r2(p.et0Mm)}, ${r2(p.kc)}, ${r3(p.ks)}, ${r2(p.etcMm)},
        ${r2(p.precipMm)}, ${r2(p.precipEfectivaMm)}, ${r2(p.riegoMm)}, ${p.riegoAsumido},
        ${r1(p.tawMm)}, ${r1(p.rawMm)}, ${r1(p.agotamientoMm)}, ${r1(p.deficitPct)},
        ${p.ajusteSatelitalMm}, ${p.fuenteAnclaje}, ${engineVersion})
      on conflict (zone_id, fecha) do update set
        et0_mm = excluded.et0_mm,
        kc = excluded.kc,
        ks = excluded.ks,
        etc_mm = excluded.etc_mm,
        precip_mm = excluded.precip_mm,
        precip_efectiva_mm = excluded.precip_efectiva_mm,
        riego_mm = excluded.riego_mm,
        riego_asumido = excluded.riego_asumido,
        taw_mm = excluded.taw_mm,
        raw_mm = excluded.raw_mm,
        agotamiento_mm = excluded.agotamiento_mm,
        deficit_pct = excluded.deficit_pct,
        ajuste_satelital_mm = excluded.ajuste_satelital_mm,
        fuente_anclaje = excluded.fuente_anclaje,
        engine_version = excluded.engine_version,
        computed_at = now()
    `;
  }
}

function r1(v: number): number { return Math.round(v * 10) / 10; }
function r2(v: number): number { return Math.round(v * 100) / 100; }
function r3(v: number): number { return Math.round(v * 1000) / 1000; }

export async function getUltimoEstado(zoneId: string): Promise<BalanceRow | null> {
  const sql = getSql();
  const rows = await sql`
    select * from water_balance_daily where zone_id = ${zoneId}
    order by fecha desc limit 1
  `;
  return rows.length > 0 ? rowToBalance(rows[0]) : null;
}

export async function getBalanceRange(zoneId: string, desde: string, hasta: string): Promise<BalanceRow[]> {
  const sql = getSql();
  const rows = await sql`
    select * from water_balance_daily
    where zone_id = ${zoneId} and fecha >= ${desde} and fecha <= ${hasta}
    order by fecha
  `;
  return rows.map(rowToBalance);
}

export async function deleteBalanceDesde(zoneId: string, desde: string): Promise<void> {
  const sql = getSql();
  await sql`delete from water_balance_daily where zone_id = ${zoneId} and fecha >= ${desde}`;
}

function rowToBalance(r: Record<string, unknown>): BalanceRow {
  return {
    zoneId: r.zone_id as string,
    fecha: r.fecha instanceof Date ? r.fecha.toISOString().split('T')[0] : String(r.fecha),
    agotamientoMm: Number(r.agotamiento_mm),
    deficitPct: Number(r.deficit_pct),
    tawMm: Number(r.taw_mm),
    rawMm: Number(r.raw_mm),
    riegoAsumido: r.riego_asumido as boolean,
    fuenteAnclaje: r.fuente_anclaje as string | null,
  };
}
