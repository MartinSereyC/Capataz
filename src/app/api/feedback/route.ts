import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guardarFeedback } from "@/lib/feedback/repo";
import { emitirAlertaSiCorresponde } from "@/lib/feedback/alertas";

const bodySchema = z.object({
  recomendacionId: z.string().uuid(),
  valoracion: z.enum(["razonable", "mas_o_menos", "no_acerto"]),
  observacion: z.string().optional(),
});

// In-memory rate limit: 20 feedback/day per usuario
const rateLimitMap = new Map<string, { count: number; fecha: string }>();

function fechaHoy(): string {
  return new Date().toISOString().slice(0, 10);
}

function checkRateLimit(usuarioId: string): boolean {
  const hoy = fechaHoy();
  const entry = rateLimitMap.get(usuarioId);

  if (!entry || entry.fecha !== hoy) {
    rateLimitMap.set(usuarioId, { count: 1, fecha: hoy });
    return true;
  }

  if (entry.count >= 20) {
    return false;
  }

  entry.count += 1;
  return true;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Auth: dynamic import fallback with try/catch as specified
  let sesion: { usuarioId: string } | null = null;
  try {
    const { obtenerSesionActual } = await import(
      "@/lib/auth/server-helpers"
    );
    sesion = await obtenerSesionActual();
  } catch {
    sesion = null;
  }

  if (!sesion) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }

  const { usuarioId } = sesion;

  // Rate limit
  if (!checkRateLimit(usuarioId)) {
    return NextResponse.json(
      { error: "límite de feedback diario alcanzado" },
      { status: 429 }
    );
  }

  // Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "body inválido" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "datos inválidos", detalles: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { recomendacionId, valoracion, observacion } = parsed.data;

  try {
    const feedback = await guardarFeedback(
      recomendacionId,
      usuarioId,
      valoracion,
      observacion
    );

    // Look up predioId via recomendacion ownership — re-use the same sql
    const { sql } = await import("@/lib/db/client");
    const rows = await sql<{ predio_id: string }[]>`
      SELECT p.id AS predio_id
      FROM recomendaciones_diarias r
      JOIN zonas z ON z.id = r.zona_id
      JOIN predios p ON p.id = z.predio_id
      WHERE r.id = ${recomendacionId}
    `;
    const predioId = rows[0]?.predio_id;

    if (predioId) {
      await emitirAlertaSiCorresponde(predioId);
    }

    return NextResponse.json({ ok: true, id: feedback.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "error desconocido";
    if (
      message === "recomendacion no encontrada o no pertenece al usuario"
    ) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json({ error: "error interno" }, { status: 500 });
  }
}
