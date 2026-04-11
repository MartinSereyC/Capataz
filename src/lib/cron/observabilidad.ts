// Métricas del dashboard del solo-builder (§10 del plan).
// Lecturas directas de DB, sin caché. Llamadas puntuales.

import { sql } from "@/lib/db/client";

export async function contarRecomendacionesHoy(): Promise<{
  generadas: number;
  esperadas: number;
}> {
  const generadasRows = await sql<Array<{ count: string }>>`
    SELECT COUNT(*)::text AS count
      FROM recomendaciones_diarias
      WHERE fecha = CURRENT_DATE
  `;
  const esperadasRows = await sql<Array<{ count: string }>>`
    SELECT COUNT(*)::text AS count FROM zonas
  `;
  return {
    generadas: Number(generadasRows[0]?.count ?? 0),
    esperadas: Number(esperadasRows[0]?.count ?? 0),
  };
}

export async function contarErroresUltimas24h(): Promise<number> {
  // Proxy: zonas sin estado hídrico en las últimas 24h respecto de
  // cuántas se esperan tener. Aproximación defendible en Fase 1.
  const rows = await sql<Array<{ count: string }>>`
    SELECT COUNT(*)::text AS count
      FROM zonas z
      WHERE NOT EXISTS (
        SELECT 1 FROM estado_hidrico_interno e
          WHERE e.zona_id = z.id
            AND e.creado_en >= now() - interval '24 hours'
      )
  `;
  return Number(rows[0]?.count ?? 0);
}

export async function agruparFeedbackUltimas24h(): Promise<{
  razonable: number;
  mas_o_menos: number;
  no_acerto: number;
}> {
  const rows = await sql<Array<{ valoracion: string; count: string }>>`
    SELECT valoracion::text AS valoracion, COUNT(*)::text AS count
      FROM feedback_agricultor
      WHERE creado_en >= now() - interval '24 hours'
      GROUP BY valoracion
  `;
  const out = { razonable: 0, mas_o_menos: 0, no_acerto: 0 };
  for (const r of rows) {
    if (r.valoracion === "razonable") out.razonable = Number(r.count);
    else if (r.valoracion === "mas_o_menos") out.mas_o_menos = Number(r.count);
    else if (r.valoracion === "no_acerto") out.no_acerto = Number(r.count);
  }
  return out;
}

export async function errorReconciliacionUltimaImagen(): Promise<
  Record<string, number>
> {
  // Error promedio por predio a partir de observaciones satelitales
  // más recientes vs estado interno. Placeholder agregando nulls a 0.
  const rows = await sql<Array<{ predio_id: string; error_prom: string | null }>>`
    SELECT z.predio_id AS predio_id,
           AVG(COALESCE(o.ndmi::numeric, 0) - COALESCE(e.deficit_pct::numeric, 0))::text AS error_prom
      FROM zonas z
      LEFT JOIN observaciones_satelitales o ON o.zona_id = z.id
      LEFT JOIN estado_hidrico_interno e ON e.zona_id = z.id AND e.fecha = o.fecha
      GROUP BY z.predio_id
  `;
  const out: Record<string, number> = {};
  for (const r of rows) {
    out[r.predio_id] = r.error_prom ? Number(r.error_prom) : 0;
  }
  return out;
}

export async function estadoQuotas(): Promise<{
  sentinelRequestsHoy: number;
  keepaliveUltimo: string | null;
}> {
  const rows = await sql<Array<{ count: string }>>`
    SELECT COUNT(*)::text AS count
      FROM observaciones_satelitales
      WHERE creado_en >= CURRENT_DATE
  `;
  return {
    sentinelRequestsHoy: Number(rows[0]?.count ?? 0),
    keepaliveUltimo: null,
  };
}
