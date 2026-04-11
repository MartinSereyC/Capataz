import { sql } from "@/lib/db/client";

const FORBIDDEN_KEYS = /litros|_mm$|^mm_|volumen/i;

function scrubForbiddenKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(scrubForbiddenKeys);
  if (obj !== null && typeof obj === "object") {
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (!FORBIDDEN_KEYS.test(k)) {
        cleaned[k] = scrubForbiddenKeys(v);
      }
    }
    return cleaned;
  }
  return obj;
}

export async function exportarPredioJSON(predioId: string): Promise<object> {
  const [predioRows, zonaRows, fuenteRows, fuenteZonaRows, climaRows, sueloRows] =
    await Promise.all([
      sql`
        SELECT id, usuario_id, nombre, region, comuna, creado_en, actualizado_en,
               ST_AsGeoJSON(geometria)::json AS geometria
        FROM predios WHERE id = ${predioId}
      `,
      sql`
        SELECT id, predio_id, nombre, cultivo, prioridad, fase_fenologica_override,
               creado_en, actualizado_en,
               ST_AsGeoJSON(geometria)::json AS geometria
        FROM zonas WHERE predio_id = ${predioId} ORDER BY creado_en ASC
      `,
      sql`
        SELECT id, predio_id, tipo, notas, creado_en
        FROM fuentes_hidricas WHERE predio_id = ${predioId} ORDER BY creado_en ASC
      `,
      sql`
        SELECT fz.fuente_id, fz.zona_id
        FROM fuente_zona fz
        JOIN zonas z ON z.id = fz.zona_id
        WHERE z.predio_id = ${predioId}
      `,
      sql`
        SELECT id, predio_id, fecha, origen, t_min, t_max, payload, creado_en
        FROM clima_diario
        WHERE predio_id = ${predioId}
          AND fecha >= CURRENT_DATE - INTERVAL '30 days'
        ORDER BY fecha DESC
      `,
      sql`
        SELECT id, predio_id, zona_id, origen, textura, capacidad_campo_pct,
               punto_marchitez_pct, heterogeneo, payload, creado_en
        FROM suelo_estimado WHERE predio_id = ${predioId} ORDER BY creado_en ASC
      `,
    ]);

  const zonaIds: string[] = zonaRows.map((z) => z.id as string);

  const [obsRows, hidricoRows, recomRows] = await (zonaIds.length > 0
    ? Promise.all([
        sql`
          SELECT id, zona_id, fecha, ndvi, ndmi, fuente, payload, creado_en
          FROM observaciones_satelitales
          WHERE zona_id = ANY(${zonaIds}::uuid[])
            AND fecha >= CURRENT_DATE - INTERVAL '30 days'
          ORDER BY fecha DESC
        `,
        sql`
          SELECT id, zona_id, fecha, deficit_pct, proyectado, inputs, creado_en
          FROM estado_hidrico_interno
          WHERE zona_id = ANY(${zonaIds}::uuid[])
            AND fecha >= CURRENT_DATE - INTERVAL '30 days'
          ORDER BY fecha DESC
        `,
        sql`
          SELECT id, zona_id, fecha, semaforo, timing_etiqueta, confianza,
                 razon_breve, postergada_por_escasez, creado_en
          FROM recomendaciones_diarias
          WHERE zona_id = ANY(${zonaIds}::uuid[])
            AND fecha >= CURRENT_DATE - INTERVAL '30 days'
          ORDER BY fecha DESC
        `,
      ])
    : Promise.resolve([[], [], []]));

  const recomIds: string[] = recomRows.map((r) => r.id as string);
  const feedbackRows =
    recomIds.length > 0
      ? await sql`
          SELECT id, recomendacion_id, valoracion, observacion_libre, creado_en
          FROM feedback_agricultor
          WHERE recomendacion_id = ANY(${recomIds}::uuid[])
          ORDER BY creado_en DESC
        `
      : [];

  const fuentesConZonas = fuenteRows.map((f) => ({
    ...f,
    zonas_asignadas: fuenteZonaRows
      .filter((fz) => fz.fuente_id === f.id)
      .map((fz) => fz.zona_id),
  }));

  const resultado = {
    predio: predioRows[0] ?? null,
    zonas: zonaRows,
    fuentes_hidricas: fuentesConZonas,
    clima_diario: climaRows,
    suelo_estimado: sueloRows,
    observaciones_satelitales: obsRows,
    estado_hidrico_interno: hidricoRows,
    recomendaciones_diarias: recomRows,
    feedback_agricultor: feedbackRows,
  };

  return scrubForbiddenKeys(resultado) as object;
}
