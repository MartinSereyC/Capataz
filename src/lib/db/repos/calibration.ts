import { getSql } from '../client';
import type { ParametrosZona } from '../../balance/backtest';
import type { EvaluacionModelo } from '../../balance/backtest';

export interface ZoneCalibrationRow extends ParametrosZona {
  fitted: boolean;
  trainDesde: string;
  trainHasta: string;
}

export async function insertCalibration(
  zoneId: string,
  params: ParametrosZona,
  fitted: boolean,
  trainDesde: string,
  trainHasta: string,
  engineVersion: string,
): Promise<void> {
  const sql = getSql();
  await sql`
    insert into zone_calibrations (zone_id, kc_factor, ndmi_offset, train_desde, train_hasta, fitted, engine_version)
    values (${zoneId}, ${params.kcFactor}, ${params.ndmiOffset}, ${trainDesde}, ${trainHasta}, ${fitted}, ${engineVersion})
  `;
}

export async function getLatestCalibration(zoneId: string): Promise<ZoneCalibrationRow | null> {
  const sql = getSql();
  const rows = await sql`
    select * from zone_calibrations where zone_id = ${zoneId}
    order by created_at desc limit 1
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  const f = (v: unknown) => (v instanceof Date ? v.toISOString().split('T')[0] : String(v));
  return {
    kcFactor: Number(r.kc_factor),
    ndmiOffset: Number(r.ndmi_offset),
    fitted: r.fitted as boolean,
    trainDesde: f(r.train_desde),
    trainHasta: f(r.train_hasta),
  };
}

export interface ModelEvaluationRow extends EvaluacionModelo {
  trainDesde: string;
  trainHasta: string;
  testDesde: string;
  testHasta: string;
}

export async function insertEvaluation(
  zoneId: string,
  ev: EvaluacionModelo,
  ventanas: { trainDesde: string; trainHasta: string; testDesde: string; testHasta: string },
  parametros: ParametrosZona,
  engineVersion: string,
): Promise<void> {
  const sql = getSql();
  await sql`
    insert into model_evaluations (zone_id, train_desde, train_hasta, test_desde, test_hasta,
      n_observaciones, mae_deficit_pct, bias_deficit_pct, error_por_horizonte, parametros, engine_version)
    values (${zoneId}, ${ventanas.trainDesde}, ${ventanas.trainHasta}, ${ventanas.testDesde},
      ${ventanas.testHasta}, ${ev.nObservaciones}, ${ev.maeDeficitPct}, ${ev.biasDeficitPct},
      ${sql.json(ev.errorPorHorizonte as never)}, ${sql.json(parametros as never)}, ${engineVersion})
  `;
}

export async function getLatestEvaluation(zoneId: string): Promise<ModelEvaluationRow | null> {
  const sql = getSql();
  const rows = await sql`
    select * from model_evaluations where zone_id = ${zoneId}
    order by created_at desc limit 1
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  const f = (v: unknown) => (v instanceof Date ? v.toISOString().split('T')[0] : String(v));
  return {
    trainDesde: f(r.train_desde),
    trainHasta: f(r.train_hasta),
    testDesde: f(r.test_desde),
    testHasta: f(r.test_hasta),
    nObservaciones: Number(r.n_observaciones),
    maeDeficitPct: r.mae_deficit_pct !== null ? Number(r.mae_deficit_pct) : null,
    biasDeficitPct: r.bias_deficit_pct !== null ? Number(r.bias_deficit_pct) : null,
    errorPorHorizonte: r.error_por_horizonte as Record<string, number>,
  };
}
