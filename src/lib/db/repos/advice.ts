import { getSql } from '../client';
import type { RecomendacionRiego, FuenteDato } from '../../balance/recomendacion';

export interface AdviceSnapshotRow {
  zoneId: string;
  fecha: string;
  semaforo: string;
  timing: string;
  laminaMm: number | null;
  diasHastaEstres: number | null;
  prioridad: number | null;
  deficitPct: number;
  lluviaProximaMm: number | null;
  lluviaProximaDias: number | null;
  postergar: boolean;
  confianza: string;
  fuentes: FuenteDato[];
  supuestos: string[];
  createdAt: string;
}

export async function insertAdviceSnapshot(
  zoneId: string,
  fecha: string,
  rec: RecomendacionRiego,
  fuentes: FuenteDato[],
  prioridad: number | null,
  engineVersion: string,
): Promise<void> {
  const sql = getSql();
  await sql`
    insert into advice_snapshots (zone_id, fecha, semaforo, timing, lamina_mm, dias_hasta_estres,
      prioridad, deficit_pct, lluvia_proxima_mm, lluvia_proxima_dias, postergar, confianza,
      fuentes, supuestos, engine_version)
    values (${zoneId}, ${fecha}, ${rec.semaforo}, ${rec.timing}, ${rec.laminaMm},
      ${rec.diasHastaEstres}, ${prioridad}, ${rec.deficitPct}, ${rec.lluviaProximaMm},
      ${rec.lluviaProximaDias}, ${rec.postergar}, ${rec.confianza},
      ${sql.json(fuentes as never)}, ${sql.json(rec.supuestos as never)}, ${engineVersion})
  `;
}

export async function getLatestAdvice(zoneId: string): Promise<AdviceSnapshotRow | null> {
  const sql = getSql();
  const rows = await sql`
    select * from advice_snapshots where zone_id = ${zoneId}
    order by created_at desc limit 1
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    zoneId: r.zone_id as string,
    fecha: r.fecha instanceof Date ? r.fecha.toISOString().split('T')[0] : String(r.fecha),
    semaforo: r.semaforo as string,
    timing: r.timing as string,
    laminaMm: r.lamina_mm !== null ? Number(r.lamina_mm) : null,
    diasHastaEstres: r.dias_hasta_estres !== null ? Number(r.dias_hasta_estres) : null,
    prioridad: r.prioridad !== null ? Number(r.prioridad) : null,
    deficitPct: Number(r.deficit_pct),
    lluviaProximaMm: r.lluvia_proxima_mm !== null ? Number(r.lluvia_proxima_mm) : null,
    lluviaProximaDias: r.lluvia_proxima_dias !== null ? Number(r.lluvia_proxima_dias) : null,
    postergar: r.postergar as boolean,
    confianza: r.confianza as string,
    fuentes: r.fuentes as FuenteDato[],
    supuestos: r.supuestos as string[],
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  };
}
