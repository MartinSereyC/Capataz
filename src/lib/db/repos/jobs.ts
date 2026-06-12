import { getSql } from '../client';

export type TipoJob = 'clima' | 'suelo' | 's2' | 's1' | 'balance' | 'backtest';
export type EstadoJob = 'pendiente' | 'en_progreso' | 'completado' | 'error';

export interface BackfillJob {
  id: string;
  zoneId: string;
  tipo: TipoJob;
  estado: EstadoJob;
  desde: string;
  hasta: string;
  cursor: string | null;
  error: string | null;
}

function rowToJob(r: Record<string, unknown>): BackfillJob {
  const f = (v: unknown) => (v instanceof Date ? v.toISOString().split('T')[0] : v ? String(v) : null);
  return {
    id: r.id as string,
    zoneId: r.zone_id as string,
    tipo: r.tipo as TipoJob,
    estado: r.estado as EstadoJob,
    desde: f(r.desde)!,
    hasta: f(r.hasta)!,
    cursor: f(r.cursor),
    error: r.error as string | null,
  };
}

// Crea el job si no existe (idempotente sobre zone+tipo+ventana).
export async function ensureJob(zoneId: string, tipo: TipoJob, desde: string, hasta: string): Promise<BackfillJob> {
  const sql = getSql();
  const rows = await sql`
    insert into backfill_jobs (zone_id, tipo, desde, hasta)
    values (${zoneId}, ${tipo}, ${desde}, ${hasta})
    on conflict (zone_id, tipo, desde, hasta) do update set zone_id = excluded.zone_id
    returning *
  `;
  return rowToJob(rows[0]);
}

export async function marcarJob(
  id: string,
  estado: EstadoJob,
  opts: { cursor?: string | null; error?: string | null } = {},
): Promise<void> {
  const sql = getSql();
  await sql`
    update backfill_jobs set
      estado = ${estado},
      cursor = coalesce(${opts.cursor ?? null}, cursor),
      error = ${opts.error ?? null},
      started_at = case when ${estado} = 'en_progreso' and started_at is null then now() else started_at end,
      finished_at = case when ${estado} in ('completado', 'error') then now() else finished_at end
    where id = ${id}
  `;
}

export async function listJobs(zoneId: string): Promise<BackfillJob[]> {
  const sql = getSql();
  const rows = await sql`
    select * from backfill_jobs where zone_id = ${zoneId} order by created_at
  `;
  return rows.map(rowToJob);
}
