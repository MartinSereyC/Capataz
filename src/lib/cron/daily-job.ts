// Orquestador del job diario. Una corrida por predio por día.
//
// Flujo por predio:
//   1. obtener clima (histórico + forecast)
//   2. por cada zona: fenología → suelo cached → estado previo DB → motor → upsert DB
//   3. log estructurado + catch por predio
//
// Contrato: las recomendaciones persistidas nunca contienen litros/mm/volumen.

import { sql } from "@/lib/db/client";
import { obtenerClima } from "@/lib/clima";
import { muestrearPredio } from "@/lib/suelo";
import { obtenerFenologia } from "@/lib/fenologia";
import type { Cultivo, Fase } from "@/lib/fenologia";
import { ejecutarMotor } from "@/lib/engine";
import type {
  ClimaDiario as ClimaMotor,
  EstadoHidricoPrevio,
  FaseFenologica,
  Kc,
  Prioridad,
  SueloZona,
} from "@/lib/engine/types";
import { logEvento, logJobCorrida } from "./logger";
import { SentinelBudget } from "./sentinel-budget";

export interface JobResultado {
  prediosProcesados: number;
  recomendacionesCreadas: number;
  errores: Array<{ predioId: string; mensaje: string }>;
  duracionMs: number;
}

export interface JobOpciones {
  fecha?: Date;
  predioIds?: string[];
  sentinelBudget?: SentinelBudget;
}

interface PredioFila {
  id: string;
  lat: number;
  lon: number;
}

interface ZonaFila {
  id: string;
  predio_id: string;
  cultivo: string;
  prioridad: Prioridad;
  fase_fenologica_override: string | null;
  lat: number;
  lon: number;
}

// Mapa de fases del catálogo fenológico → enum del motor.
function mapearFaseMotor(fase: Fase): FaseFenologica {
  switch (fase) {
    case "brotacion":
      return "brotacion";
    case "floracion":
      return "floracion";
    case "cuaje":
      return "cuaja";
    case "desarrollo_fruto":
      return "crecimiento";
    case "maduracion":
      return "maduracion";
    case "cosecha":
      return "cosecha";
    case "post_cosecha":
      return "postcosecha";
    case "reposo":
      return "reposo";
  }
}

function fechaISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function diaDelAno(d: Date): number {
  const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 0));
  const diff = d.getTime() - start.getTime();
  return Math.floor(diff / 86400000);
}

function promediarClima(
  serie: Array<{
    fecha: string;
    tMin: number;
    tMax: number;
    precipitacionMm: number;
  }>,
  fechaObjetivo: string,
): {
  tMin: number;
  tMax: number;
  precipitacion: number;
} {
  const del_dia = serie.find((c) => c.fecha === fechaObjetivo);
  if (del_dia) {
    return {
      tMin: del_dia.tMin,
      tMax: del_dia.tMax,
      precipitacion: del_dia.precipitacionMm,
    };
  }
  // Fallback: primera entrada.
  const primera = serie[0];
  return {
    tMin: primera?.tMin ?? 10,
    tMax: primera?.tMax ?? 25,
    precipitacion: primera?.precipitacionMm ?? 0,
  };
}

async function listarPredios(predioIds?: string[]): Promise<PredioFila[]> {
  if (predioIds && predioIds.length > 0) {
    const rows = await sql<
      Array<{ id: string; lat: string; lon: string }>
    >`SELECT id,
             ST_Y(ST_Centroid(geometria))::text AS lat,
             ST_X(ST_Centroid(geometria))::text AS lon
        FROM predios
        WHERE id = ANY(${predioIds as unknown as string[]}::uuid[])`;
    return rows.map((r) => ({ id: r.id, lat: Number(r.lat), lon: Number(r.lon) }));
  }
  const rows = await sql<
    Array<{ id: string; lat: string; lon: string }>
  >`SELECT id,
           ST_Y(ST_Centroid(geometria))::text AS lat,
           ST_X(ST_Centroid(geometria))::text AS lon
      FROM predios`;
  return rows.map((r) => ({ id: r.id, lat: Number(r.lat), lon: Number(r.lon) }));
}

async function listarZonas(predioId: string): Promise<ZonaFila[]> {
  const rows = await sql<
    Array<{
      id: string;
      predio_id: string;
      cultivo: string;
      prioridad: Prioridad;
      fase_fenologica_override: string | null;
      lat: string;
      lon: string;
    }>
  >`SELECT id,
           predio_id,
           cultivo,
           prioridad,
           fase_fenologica_override,
           ST_Y(ST_Centroid(geometria))::text AS lat,
           ST_X(ST_Centroid(geometria))::text AS lon
      FROM zonas
      WHERE predio_id = ${predioId}`;
  return rows.map((r) => ({
    id: r.id,
    predio_id: r.predio_id,
    cultivo: r.cultivo,
    prioridad: r.prioridad,
    fase_fenologica_override: r.fase_fenologica_override,
    lat: Number(r.lat),
    lon: Number(r.lon),
  }));
}

async function cargarPrevio(
  zonaId: string,
  fechaObjetivo: string,
): Promise<EstadoHidricoPrevio> {
  const rows = await sql<
    Array<{ deficit_pct: string | null; creado_en: Date }>
  >`SELECT deficit_pct, creado_en
      FROM estado_hidrico_interno
      WHERE zona_id = ${zonaId}
        AND fecha < ${fechaObjetivo}::date
      ORDER BY fecha DESC
      LIMIT 1`;
  const row = rows[0];
  const deficit = row?.deficit_pct ? Number(row.deficit_pct) : 0;
  return {
    zonaId,
    deficit,
    diasDesdeAlta: 30,
    erroresReconciliacion: [],
  };
}

async function upsertEstadoHidrico(
  zonaId: string,
  fecha: string,
  deficit: number,
  inputs: unknown,
): Promise<void> {
  await sql`
    INSERT INTO estado_hidrico_interno (zona_id, fecha, deficit_pct, proyectado, inputs)
    VALUES (${zonaId}, ${fecha}::date, ${deficit}, true, ${sql.json(
      inputs as Parameters<typeof sql.json>[0],
    )})
    ON CONFLICT (zona_id, fecha) DO UPDATE
      SET deficit_pct = EXCLUDED.deficit_pct,
          proyectado = EXCLUDED.proyectado,
          inputs = EXCLUDED.inputs
  `;
}

async function upsertRecomendacion(
  zonaId: string,
  fecha: string,
  semaforo: string,
  timing: string,
  confianza: string,
  razon: string,
  postergada: boolean,
): Promise<void> {
  await sql`
    INSERT INTO recomendaciones_diarias
      (zona_id, fecha, semaforo, timing_etiqueta, confianza, razon_breve, postergada_por_escasez)
    VALUES
      (${zonaId}, ${fecha}::date, ${semaforo}, ${timing}, ${confianza}, ${razon}, ${postergada})
    ON CONFLICT (zona_id, fecha) DO UPDATE
      SET semaforo = EXCLUDED.semaforo,
          timing_etiqueta = EXCLUDED.timing_etiqueta,
          confianza = EXCLUDED.confianza,
          razon_breve = EXCLUDED.razon_breve,
          postergada_por_escasez = EXCLUDED.postergada_por_escasez
  `;
}

export async function ejecutarJobDiario(
  opts: JobOpciones = {},
): Promise<JobResultado> {
  const t0 = Date.now();
  const fecha = opts.fecha ?? new Date();
  const fechaStr = fechaISO(fecha);
  const budget = opts.sentinelBudget ?? new SentinelBudget();

  const resultado: JobResultado = {
    prediosProcesados: 0,
    recomendacionesCreadas: 0,
    errores: [],
    duracionMs: 0,
  };

  logEvento("info", "job_diario_inicio", { fecha: fechaStr });

  let predios: PredioFila[] = [];
  try {
    predios = await listarPredios(opts.predioIds);
  } catch (e) {
    logEvento("error", "job_diario_listar_predios_fallo", {
      mensaje: String((e as Error)?.message ?? e),
    });
    resultado.duracionMs = Date.now() - t0;
    return resultado;
  }

  for (const predio of predios) {
    try {
      if (budget.debePausar()) {
        logEvento("warn", "job_diario_predio_pausado_sentinel", {
          predioId: predio.id,
        });
      }
      budget.incrementar();

      const climaSerie = await obtenerClima(predio.lat, predio.lon, 7, 7);
      const climaDia = promediarClima(climaSerie, fechaStr);

      const zonas = await listarZonas(predio.id);
      if (zonas.length === 0) {
        resultado.prediosProcesados += 1;
        continue;
      }

      const muestreo = await muestrearPredio(
        predio.lat,
        predio.lon,
        zonas.map((z) => ({ id: z.id, lat: z.lat, lon: z.lon })),
      );
      const sueloPorZona = new Map(
        muestreo.centroidesZonas.map((c) => [c.zonaId, c.suelo]),
      );

      const zonasMotor: SueloZona[] = [];
      const previos: EstadoHidricoPrevio[] = [];
      const kcPorZona: Record<string, Kc> = {};
      const inputsLog: Record<string, unknown> = {};

      for (const zona of zonas) {
        const fen = obtenerFenologia(
          zona.cultivo as Cultivo,
          fecha.getUTCMonth() + 1,
          zona.fase_fenologica_override ?? undefined,
        );
        const previo = await cargarPrevio(zona.id, fechaStr);
        previos.push(previo);

        zonasMotor.push({
          id: zona.id,
          umbralRojo: fen.umbralRojoDeficitPct,
          umbralAmarillo: fen.umbralAmarilloDeficitPct,
          prioridad: zona.prioridad,
          demandaEstimada: 30,
        });
        kcPorZona[zona.id] = {
          fase: mapearFaseMotor(fen.fase),
          valor: fen.kcReferencia,
        };
        inputsLog[zona.id] = {
          cultivo: zona.cultivo,
          fase: fen.fase,
          kc: fen.kcReferencia,
          suelo: sueloPorZona.get(zona.id)?.textura ?? null,
          deficitPrevio: previo.deficit,
        };
      }

      const climaMotor: ClimaMotor = {
        fecha: fechaStr,
        tMin: climaDia.tMin,
        tMax: climaDia.tMax,
        precipitacion: climaDia.precipitacion,
        latitudDeg: predio.lat,
        diaDelAno: diaDelAno(fecha),
      };

      const recomendaciones = ejecutarMotor({
        zonas: zonasMotor,
        previos,
        clima: climaMotor,
        kcPorZona,
        riegos: [],
        capacidadFuente: 1000,
      });

      for (const rec of recomendaciones) {
        const t1 = Date.now();
        try {
          const previo = previos.find((p) => p.zonaId === rec.zonaId);
          await upsertEstadoHidrico(
            rec.zonaId,
            fechaStr,
            previo?.deficit ?? 0,
            inputsLog[rec.zonaId],
          );
          await upsertRecomendacion(
            rec.zonaId,
            fechaStr,
            rec.semaforo,
            rec.timing,
            rec.confianza,
            rec.razon,
            rec.postergada,
          );
          resultado.recomendacionesCreadas += 1;
          logJobCorrida(
            predio.id,
            rec.zonaId,
            inputsLog[rec.zonaId],
            {
              semaforo: rec.semaforo,
              timing: rec.timing,
              confianza: rec.confianza,
              postergada: rec.postergada,
            },
            Date.now() - t1,
          );
        } catch (zonaErr) {
          logJobCorrida(
            predio.id,
            rec.zonaId,
            inputsLog[rec.zonaId],
            null,
            Date.now() - t1,
            zonaErr,
          );
        }
      }

      resultado.prediosProcesados += 1;
    } catch (err) {
      const mensaje = String((err as Error)?.message ?? err);
      resultado.errores.push({ predioId: predio.id, mensaje });
      logEvento("error", "job_diario_predio_fallo", {
        predioId: predio.id,
        mensaje,
      });
    }
  }

  resultado.duracionMs = Date.now() - t0;
  logEvento("info", "job_diario_fin", {
    prediosProcesados: resultado.prediosProcesados,
    recomendacionesCreadas: resultado.recomendacionesCreadas,
    errores: resultado.errores.length,
    duracionMs: resultado.duracionMs,
  });
  return resultado;
}
