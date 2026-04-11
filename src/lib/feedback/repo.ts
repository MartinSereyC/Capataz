import { sql } from "@/lib/db/client";
import type { FeedbackAgricultorRow, Valoracion } from "@/lib/db/types";

export type Feedback = FeedbackAgricultorRow;

export async function guardarFeedback(
  recomendacionId: string,
  usuarioId: string,
  valoracion: Valoracion,
  observacion?: string
): Promise<Feedback> {
  // Verify the recomendacion belongs to a zona of a predio owned by the usuario
  const ownership = await sql<{ id: string }[]>`
    SELECT r.id
    FROM recomendaciones_diarias r
    JOIN zonas z ON z.id = r.zona_id
    JOIN predios p ON p.id = z.predio_id
    WHERE r.id = ${recomendacionId}
      AND p.usuario_id = ${usuarioId}
  `;

  if (ownership.length === 0) {
    throw new Error("recomendacion no encontrada o no pertenece al usuario");
  }

  const rows = await sql<Feedback[]>`
    INSERT INTO feedback_agricultor (recomendacion_id, valoracion, observacion_libre)
    VALUES (${recomendacionId}, ${valoracion}, ${observacion ?? null})
    RETURNING *
  `;

  return rows[0];
}

export async function ultimosNFeedbacksDePredio(
  predioId: string,
  n: number
): Promise<Feedback[]> {
  const rows = await sql<Feedback[]>`
    SELECT f.*
    FROM feedback_agricultor f
    JOIN recomendaciones_diarias r ON r.id = f.recomendacion_id
    JOIN zonas z ON z.id = r.zona_id
    JOIN predios p ON p.id = z.predio_id
    WHERE p.id = ${predioId}
    ORDER BY f.creado_en DESC
    LIMIT ${n}
  `;

  return rows;
}
