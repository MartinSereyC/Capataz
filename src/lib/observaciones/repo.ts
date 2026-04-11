import { sql } from "@/lib/db/client";
import type { ObservacionSatelital } from "./types";

interface ObsRow {
  zona_id: string;
  fecha: string;
  ndvi: string | null;
  ndmi: string | null;
  fuente: string;
  payload: unknown;
}

function rowToObs(row: ObsRow): ObservacionSatelital {
  return {
    zonaId: row.zona_id,
    fecha: typeof row.fecha === "string" ? row.fecha.split("T")[0] : String(row.fecha),
    ndvi: row.ndvi !== null && row.ndvi !== undefined ? Number(row.ndvi) : null,
    ndmi: row.ndmi !== null && row.ndmi !== undefined ? Number(row.ndmi) : null,
    fuente: row.fuente,
    payloadRaw: row.payload ?? null,
  };
}

export async function obtenerUltimaObservacion(
  zonaId: string,
): Promise<ObservacionSatelital | null> {
  const rows = await sql<ObsRow[]>`
    SELECT zona_id, fecha, ndvi, ndmi, fuente, payload
    FROM observaciones_satelitales
    WHERE zona_id = ${zonaId}
    ORDER BY fecha DESC
    LIMIT 1
  `;
  return rows[0] ? rowToObs(rows[0]) : null;
}

export async function insertarObservacion(
  obs: ObservacionSatelital,
): Promise<ObservacionSatelital> {
  const [row] = await sql<ObsRow[]>`
    INSERT INTO observaciones_satelitales (zona_id, fecha, ndvi, ndmi, fuente, payload)
    VALUES (
      ${obs.zonaId},
      ${obs.fecha},
      ${obs.ndvi},
      ${obs.ndmi},
      ${obs.fuente},
      ${obs.payloadRaw ? JSON.stringify(obs.payloadRaw) : null}
    )
    ON CONFLICT (zona_id, fecha) DO UPDATE SET
      ndvi = EXCLUDED.ndvi,
      ndmi = EXCLUDED.ndmi,
      fuente = EXCLUDED.fuente,
      payload = EXCLUDED.payload
    RETURNING zona_id, fecha, ndvi, ndmi, fuente, payload
  `;
  return rowToObs(row);
}

export async function listarObservaciones(
  zonaId: string,
  desdeFecha: string,
): Promise<ObservacionSatelital[]> {
  const rows = await sql<ObsRow[]>`
    SELECT zona_id, fecha, ndvi, ndmi, fuente, payload
    FROM observaciones_satelitales
    WHERE zona_id = ${zonaId}
      AND fecha >= ${desdeFecha}
    ORDER BY fecha ASC
  `;
  return rows.map(rowToObs);
}
