import { sql } from "@/lib/db/client";
import type {
  RecomendacionDiariaRow,
  Semaforo,
  Confianza,
  Prioridad,
} from "@/lib/db/types";

export interface RecomendacionConZona extends RecomendacionDiariaRow {
  zonaNombre: string;
  predioNombre: string;
  predioId: string;
  cultivo: string;
  prioridad: Prioridad;
}

function fechaHoySantiago(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function listarRecomendacionesDelDia(
  usuarioId: string,
  fecha?: string
): Promise<RecomendacionConZona[]> {
  const fechaFiltro = fecha ?? fechaHoySantiago();

  const rows = await sql<RecomendacionConZona[]>`
    SELECT
      r.id,
      r.zona_id,
      r.fecha,
      r.semaforo,
      r.timing_etiqueta,
      r.confianza,
      r.razon_breve,
      r.postergada_por_escasez,
      r.creado_en,
      z.nombre AS "zonaNombre",
      z.cultivo,
      z.prioridad,
      p.nombre AS "predioNombre",
      p.id AS "predioId"
    FROM recomendaciones_diarias r
    JOIN zonas z ON z.id = r.zona_id
    JOIN predios p ON p.id = z.predio_id
    WHERE p.usuario_id = ${usuarioId}
      AND r.fecha = ${fechaFiltro}
    ORDER BY
      CASE r.semaforo WHEN 'rojo' THEN 1 WHEN 'amarillo' THEN 2 WHEN 'verde' THEN 3 END ASC,
      p.nombre ASC,
      z.nombre ASC
  `;

  return rows;
}

export async function obtenerRecomendacion(
  recomendacionId: string,
  usuarioId: string
): Promise<RecomendacionConZona | null> {
  const rows = await sql<RecomendacionConZona[]>`
    SELECT
      r.id,
      r.zona_id,
      r.fecha,
      r.semaforo,
      r.timing_etiqueta,
      r.confianza,
      r.razon_breve,
      r.postergada_por_escasez,
      r.creado_en,
      z.nombre AS "zonaNombre",
      z.cultivo,
      z.prioridad,
      p.nombre AS "predioNombre",
      p.id AS "predioId"
    FROM recomendaciones_diarias r
    JOIN zonas z ON z.id = r.zona_id
    JOIN predios p ON p.id = z.predio_id
    WHERE r.id = ${recomendacionId}
      AND p.usuario_id = ${usuarioId}
  `;

  return rows[0] ?? null;
}
