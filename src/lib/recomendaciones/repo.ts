import { sql } from "@/lib/db/client";
import { ejecutarJobDiario } from "@/lib/cron/daily-job";
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

/**
 * Garantiza que el usuario tenga recomendaciones para hoy.
 * Si a algún predio del usuario le faltan filas para la fecha de hoy (Santiago),
 * corre el motor on-demand solo para esos predios. Los predios que ya tienen
 * recomendaciones se omiten. Upsert en DB hace la llamada idempotente.
 * Silencia errores: la página mostrará el fallback si todo falla.
 */
export async function asegurarRecomendacionesDelDia(
  usuarioId: string
): Promise<void> {
  const fechaSantiago = fechaHoySantiago();

  const rows = await sql<Array<{ predio_id: string }>>`
    SELECT DISTINCT p.id AS predio_id
    FROM predios p
    JOIN zonas z ON z.predio_id = p.id
    WHERE p.usuario_id = ${usuarioId}
      AND NOT EXISTS (
        SELECT 1 FROM recomendaciones_diarias r
        WHERE r.zona_id = z.id AND r.fecha = ${fechaSantiago}::date
      )
  `;

  if (rows.length === 0) return;

  const predioIds = rows.map((r) => r.predio_id);
  const fecha = new Date(`${fechaSantiago}T12:00:00Z`);

  try {
    await ejecutarJobDiario({ predioIds, fecha });
  } catch {
    // noop — la página renderiza el fallback.
  }
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
