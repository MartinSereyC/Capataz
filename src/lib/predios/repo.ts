import { sql } from "@/lib/db/client";
import type {
  PredioRow,
  ZonaRow,
  FuenteHidricaRow,
} from "@/lib/db/types";

export type Predio = PredioRow;
export type Zona = ZonaRow;
export type FuenteHidrica = FuenteHidricaRow;

export async function crearPredio(
  usuarioId: string,
  nombre: string,
  geometriaGeoJSON: object,
  region: string,
  comuna: string
): Promise<Predio> {
  const [row] = await sql<Predio[]>`
    INSERT INTO predios (usuario_id, nombre, geometria, region, comuna)
    VALUES (
      ${usuarioId},
      ${nombre},
      ST_GeomFromGeoJSON(${JSON.stringify(geometriaGeoJSON)})::geometry,
      ${region},
      ${comuna}
    )
    RETURNING id, usuario_id, nombre, region, comuna, creado_en, actualizado_en,
              ST_AsGeoJSON(geometria) AS geometria
  `;
  return row;
}

export async function obtenerPredio(id: string): Promise<Predio | null> {
  const rows = await sql<Predio[]>`
    SELECT id, usuario_id, nombre, region, comuna, creado_en, actualizado_en,
           ST_AsGeoJSON(geometria) AS geometria
    FROM predios
    WHERE id = ${id}
  `;
  return rows[0] ?? null;
}

export async function listarPrediosPorUsuario(
  usuarioId: string
): Promise<Predio[]> {
  return sql<Predio[]>`
    SELECT id, usuario_id, nombre, region, comuna, creado_en, actualizado_en,
           ST_AsGeoJSON(geometria) AS geometria
    FROM predios
    WHERE usuario_id = ${usuarioId}
    ORDER BY creado_en DESC
  `;
}

export async function actualizarPredio(
  id: string,
  parcial: Partial<Pick<Predio, "nombre" | "region" | "comuna">> & {
    geometriaGeoJSON?: object;
  }
): Promise<Predio> {
  const { nombre, region, comuna, geometriaGeoJSON } = parcial;
  const [row] = await sql<Predio[]>`
    UPDATE predios SET
      nombre = COALESCE(${nombre ?? null}, nombre),
      region = COALESCE(${region ?? null}, region),
      comuna = COALESCE(${comuna ?? null}, comuna),
      geometria = CASE
        WHEN ${geometriaGeoJSON ? JSON.stringify(geometriaGeoJSON) : null}::text IS NOT NULL
        THEN ST_GeomFromGeoJSON(${geometriaGeoJSON ? JSON.stringify(geometriaGeoJSON) : null}::text)::geometry
        ELSE geometria
      END,
      actualizado_en = now()
    WHERE id = ${id}
    RETURNING id, usuario_id, nombre, region, comuna, creado_en, actualizado_en,
              ST_AsGeoJSON(geometria) AS geometria
  `;
  return row;
}

export async function crearZona(
  predioId: string,
  nombre: string,
  geometriaGeoJSON: object,
  cultivo: string,
  prioridad: Zona["prioridad"]
): Promise<Zona> {
  const [row] = await sql<Zona[]>`
    INSERT INTO zonas (predio_id, nombre, geometria, cultivo, prioridad)
    VALUES (
      ${predioId},
      ${nombre},
      ST_GeomFromGeoJSON(${JSON.stringify(geometriaGeoJSON)})::geometry,
      ${cultivo},
      ${prioridad}
    )
    RETURNING id, predio_id, nombre, cultivo, prioridad, fase_fenologica_override,
              creado_en, actualizado_en,
              ST_AsGeoJSON(geometria) AS geometria
  `;
  return row;
}

export async function listarZonasPorPredio(predioId: string): Promise<Zona[]> {
  return sql<Zona[]>`
    SELECT id, predio_id, nombre, cultivo, prioridad, fase_fenologica_override,
           creado_en, actualizado_en,
           ST_AsGeoJSON(geometria) AS geometria
    FROM zonas
    WHERE predio_id = ${predioId}
    ORDER BY creado_en ASC
  `;
}

export async function actualizarZona(
  id: string,
  parcial: Partial<
    Pick<Zona, "nombre" | "cultivo" | "prioridad" | "fase_fenologica_override">
  > & { geometriaGeoJSON?: object }
): Promise<Zona> {
  const { nombre, cultivo, prioridad, fase_fenologica_override, geometriaGeoJSON } =
    parcial;
  const [row] = await sql<Zona[]>`
    UPDATE zonas SET
      nombre = COALESCE(${nombre ?? null}, nombre),
      cultivo = COALESCE(${cultivo ?? null}, cultivo),
      prioridad = COALESCE(${prioridad ?? null}, prioridad),
      fase_fenologica_override = CASE
        WHEN ${fase_fenologica_override !== undefined ? "set" : null}::text = 'set'
        THEN ${fase_fenologica_override ?? null}
        ELSE fase_fenologica_override
      END,
      geometria = CASE
        WHEN ${geometriaGeoJSON ? JSON.stringify(geometriaGeoJSON) : null}::text IS NOT NULL
        THEN ST_GeomFromGeoJSON(${geometriaGeoJSON ? JSON.stringify(geometriaGeoJSON) : null}::text)::geometry
        ELSE geometria
      END,
      actualizado_en = now()
    WHERE id = ${id}
    RETURNING id, predio_id, nombre, cultivo, prioridad, fase_fenologica_override,
              creado_en, actualizado_en,
              ST_AsGeoJSON(geometria) AS geometria
  `;
  return row;
}

export async function crearFuenteHidrica(
  predioId: string,
  tipo: FuenteHidrica["tipo"],
  caudal: number | null,
  capacidad: number | null,
  notas: string | null
): Promise<FuenteHidrica> {
  const [row] = await sql<FuenteHidrica[]>`
    INSERT INTO fuentes_hidricas (predio_id, tipo, caudal_estimado_lh, capacidad_estimada_l, notas)
    VALUES (${predioId}, ${tipo}, ${caudal}, ${capacidad}, ${notas})
    RETURNING id, predio_id, tipo, caudal_estimado_lh, capacidad_estimada_l, notas, creado_en
  `;
  return row;
}

export async function asignarFuenteAZonas(
  fuenteId: string,
  zonaIds: string[]
): Promise<void> {
  if (zonaIds.length === 0) return;
  await sql`
    INSERT INTO fuente_zona (fuente_id, zona_id)
    SELECT ${fuenteId}, unnest(${zonaIds}::uuid[])
    ON CONFLICT DO NOTHING
  `;
}

export async function listarFuentesPorPredio(
  predioId: string
): Promise<FuenteHidrica[]> {
  return sql<FuenteHidrica[]>`
    SELECT id, predio_id, tipo, caudal_estimado_lh, capacidad_estimada_l, notas, creado_en
    FROM fuentes_hidricas
    WHERE predio_id = ${predioId}
    ORDER BY creado_en ASC
  `;
}
