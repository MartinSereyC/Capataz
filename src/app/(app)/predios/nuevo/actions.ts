"use server";

import { z } from "zod";
import { sql } from "@/lib/db/client";
import {
  crearPredio,
  crearZona,
  crearFuenteHidrica,
  asignarFuenteAZonas,
} from "@/lib/predios/repo";
import { requerirSesion } from "@/lib/auth/server-helpers";
import type { Prioridad, FuenteTipo } from "@/lib/db/types";

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const GeoJSONPolygonSchema = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))).min(1),
});

const ZonaPayloadSchema = z.object({
  nombre: z.string().min(1, "El nombre de la zona es requerido"),
  geometria: GeoJSONPolygonSchema,
  cultivo: z.enum([
    "palto_hass",
    "citricos",
    "ciruela_dagen",
    "nogales",
    "uva_mesa",
    "uva_vinifera",
    "manzano",
    "cerezo",
    "arandano",
    "duraznero",
    "almendro",
    "olivo",
    "kiwi",
  ]),
  prioridad: z.enum(["alta", "media", "baja"]),
});

const FuentePayloadSchema = z.object({
  tipo: z.enum(["pozo", "canal", "acumulador"]),
  caudal_estimado_lh: z.number().nullable().optional(),
  capacidad_estimada_l: z.number().nullable().optional(),
  notas: z.string().nullable().optional(),
  zonaIndices: z.array(z.number()).default([]),
});

const GuardarPredioSchema = z.object({
  nombre: z.string().min(1, "El nombre del predio es requerido"),
  region: z.string().default(""),
  comuna: z.string().default(""),
  geometriaPredio: GeoJSONPolygonSchema,
  zonas: z.array(ZonaPayloadSchema).min(1, "Se requiere al menos una zona"),
  fuentes: z.array(FuentePayloadSchema).default([]),
});

export type GuardarPredioPayload = z.infer<typeof GuardarPredioSchema>;

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

export async function guardarPredioCompleto(
  payload: GuardarPredioPayload
): Promise<{ ok: boolean; predioId?: string; error?: string }> {
  // Auth check
  let sesion;
  try {
    sesion = await requerirSesion();
  } catch {
    return { ok: false, error: "No autenticado" };
  }

  // Validate
  const parsed = GuardarPredioSchema.safeParse(payload);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join(", ");
    return { ok: false, error: msg };
  }

  const { nombre, region, comuna, geometriaPredio, zonas, fuentes } =
    parsed.data;

  // Single DB transaction
  try {
    let predioId: string | undefined;

    await sql.begin(async (tx) => {
      // 1. Create predio
      const [predioRow] = await tx<{ id: string }[]>`
        INSERT INTO predios (usuario_id, nombre, geometria, region, comuna)
        VALUES (
          ${sesion.usuarioId},
          ${nombre},
          ST_GeomFromGeoJSON(${JSON.stringify(geometriaPredio)})::geometry,
          ${region},
          ${comuna}
        )
        RETURNING id
      `;
      predioId = predioRow.id;

      // 2. Create zones and collect their IDs in order
      const zonaIds: string[] = [];
      for (const z of zonas) {
        const [zonaRow] = await tx<{ id: string }[]>`
          INSERT INTO zonas (predio_id, nombre, geometria, cultivo, prioridad)
          VALUES (
            ${predioId},
            ${z.nombre},
            ST_GeomFromGeoJSON(${JSON.stringify(z.geometria)})::geometry,
            ${z.cultivo},
            ${z.prioridad as Prioridad}
          )
          RETURNING id
        `;
        zonaIds.push(zonaRow.id);
      }

      // 3. Create fuentes and assign to zones
      for (const f of fuentes) {
        const [fuenteRow] = await tx<{ id: string }[]>`
          INSERT INTO fuentes_hidricas (predio_id, tipo, caudal_estimado_lh, capacidad_estimada_l, notas)
          VALUES (
            ${predioId},
            ${f.tipo as FuenteTipo},
            ${f.caudal_estimado_lh ?? null},
            ${f.capacidad_estimada_l ?? null},
            ${f.notas ?? null}
          )
          RETURNING id
        `;
        const assignedZonaIds = f.zonaIndices
          .filter((idx) => idx >= 0 && idx < zonaIds.length)
          .map((idx) => zonaIds[idx]);
        if (assignedZonaIds.length > 0) {
          await tx`
            INSERT INTO fuente_zona (fuente_id, zona_id)
            SELECT ${fuenteRow.id}, unnest(${assignedZonaIds}::uuid[])
            ON CONFLICT DO NOTHING
          `;
        }
      }
    });

    return { ok: true, predioId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return { ok: false, error: msg };
  }
}

// ---------------------------------------------------------------------------
// Additional action for zona config update (used in [id]/page.tsx)
// ---------------------------------------------------------------------------

const ActualizarZonaSchema = z.object({
  zonaId: z.string().uuid(),
  prioridad: z.enum(["alta", "media", "baja"]).optional(),
  fase_fenologica_override: z.string().nullable().optional(),
});

export type ActualizarZonaPayload = z.infer<typeof ActualizarZonaSchema>;

export async function actualizarZonaConfig(
  payload: ActualizarZonaPayload
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requerirSesion();
  } catch {
    return { ok: false, error: "No autenticado" };
  }

  const parsed = ActualizarZonaSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const { zonaId, prioridad, fase_fenologica_override } = parsed.data;

  await sql`
    UPDATE zonas SET
      prioridad = COALESCE(${prioridad ?? null}, prioridad),
      fase_fenologica_override = CASE
        WHEN ${fase_fenologica_override !== undefined ? "set" : null}::text = 'set'
        THEN ${fase_fenologica_override ?? null}
        ELSE fase_fenologica_override
      END,
      actualizado_en = now()
    WHERE id = ${zonaId}
  `;

  return { ok: true };
}
