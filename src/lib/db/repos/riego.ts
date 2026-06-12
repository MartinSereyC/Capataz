import { getSql } from '../client';

export interface RiegoEvento {
  id?: string;
  zoneId: string;
  fecha: string;
  mmAplicados: number | null;
  horas: number | null;
  nota: string | null;
}

export async function insertRiego(e: RiegoEvento): Promise<string> {
  const sql = getSql();
  const rows = await sql`
    insert into irrigation_events (zone_id, fecha, mm_aplicados, horas, nota)
    values (${e.zoneId}, ${e.fecha}, ${e.mmAplicados}, ${e.horas}, ${e.nota})
    returning id
  `;
  return rows[0].id as string;
}

export async function listRiegos(zoneId: string, desde?: string): Promise<RiegoEvento[]> {
  const sql = getSql();
  const rows = desde
    ? await sql`select * from irrigation_events where zone_id = ${zoneId} and fecha >= ${desde} order by fecha`
    : await sql`select * from irrigation_events where zone_id = ${zoneId} order by fecha`;
  return rows.map((r) => ({
    id: r.id as string,
    zoneId: r.zone_id as string,
    fecha: r.fecha instanceof Date ? r.fecha.toISOString().split('T')[0] : String(r.fecha),
    mmAplicados: r.mm_aplicados !== null ? Number(r.mm_aplicados) : null,
    horas: r.horas !== null ? Number(r.horas) : null,
    nota: r.nota as string | null,
  }));
}

// mm por fecha para alimentar el balance. Si solo hay horas registradas se
// omite (sin caudal conocido no se puede convertir a lámina — el balance lo
// trata como día sin registro).
export async function riegosPorFecha(zoneId: string, desde: string, hasta: string): Promise<Map<string, number>> {
  const eventos = await listRiegos(zoneId, desde);
  const porFecha = new Map<string, number>();
  for (const e of eventos) {
    if (e.fecha > hasta || e.mmAplicados === null) continue;
    porFecha.set(e.fecha, (porFecha.get(e.fecha) ?? 0) + e.mmAplicados);
  }
  return porFecha;
}
