import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---- Mock DB client antes de importar el job ----
type FakeRow = Record<string, unknown>;

interface FakeState {
  predios: Array<{ id: string; lat: number; lon: number }>;
  zonas: Array<{
    id: string;
    predio_id: string;
    cultivo: string;
    prioridad: "alta" | "media" | "baja";
    fase_fenologica_override: string | null;
    lat: number;
    lon: number;
  }>;
  estadoPrevio: Map<string, number>;
  estadoUpserts: Array<{ zonaId: string; fecha: string; inputs: unknown }>;
  recomendacionesUpserts: Array<{
    zonaId: string;
    fecha: string;
    semaforo: string;
    timing: string;
    confianza: string;
    razon: string;
    postergada: boolean;
    columnas: string[];
  }>;
}

const state: FakeState = {
  predios: [],
  zonas: [],
  estadoPrevio: new Map(),
  estadoUpserts: [],
  recomendacionesUpserts: [],
};

function resetState(): void {
  state.predios = [];
  state.zonas = [];
  state.estadoPrevio.clear();
  state.estadoUpserts = [];
  state.recomendacionesUpserts = [];
}

// Tagged template fake: interpreta la consulta por keywords.
function fakeSql(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<FakeRow[]> {
  const q = strings.join(" ").toLowerCase();
  if (q.includes("from predios")) {
    // listar predios
    if (q.includes("= any(")) {
      const ids = values[0] as string[];
      return Promise.resolve(
        state.predios
          .filter((p) => ids.includes(p.id))
          .map((p) => ({ id: p.id, lat: String(p.lat), lon: String(p.lon) })),
      );
    }
    return Promise.resolve(
      state.predios.map((p) => ({
        id: p.id,
        lat: String(p.lat),
        lon: String(p.lon),
      })),
    );
  }
  if (q.includes("from zonas") && q.includes("where predio_id")) {
    const predioId = values[0] as string;
    return Promise.resolve(
      state.zonas
        .filter((z) => z.predio_id === predioId)
        .map((z) => ({
          id: z.id,
          predio_id: z.predio_id,
          cultivo: z.cultivo,
          prioridad: z.prioridad,
          fase_fenologica_override: z.fase_fenologica_override,
          lat: String(z.lat),
          lon: String(z.lon),
        })),
    );
  }
  if (q.includes("from estado_hidrico_interno") && q.includes("where zona_id")) {
    const zonaId = values[0] as string;
    const d = state.estadoPrevio.get(zonaId);
    return Promise.resolve(
      d !== undefined ? [{ deficit_pct: String(d), creado_en: new Date() }] : [],
    );
  }
  if (q.includes("insert into estado_hidrico_interno")) {
    const [zonaId, fecha, , , inputs] = values;
    state.estadoUpserts.push({
      zonaId: zonaId as string,
      fecha: fecha as string,
      inputs,
    });
    return Promise.resolve([]);
  }
  if (q.includes("insert into recomendaciones_diarias")) {
    const [zonaId, fecha, semaforo, timing, confianza, razon, postergada] =
      values;
    // Extraer nombres de columnas listadas en el INSERT
    const match = strings
      .join("")
      .match(/recomendaciones_diarias\s*([\s\S]*?)\)/i);
    const col_list = match ? match[1] : "";
    const columnas = col_list
      .replace(/[()]/g, "")
      .split(",")
      .map((c) => c.trim().toLowerCase())
      .filter((c) => c.length > 0);
    state.recomendacionesUpserts.push({
      zonaId: zonaId as string,
      fecha: fecha as string,
      semaforo: semaforo as string,
      timing: timing as string,
      confianza: confianza as string,
      razon: razon as string,
      postergada: postergada as boolean,
      columnas,
    });
    return Promise.resolve([]);
  }
  return Promise.resolve([]);
}

// postgres.js expose sql.json - shim
(fakeSql as unknown as { json: (v: unknown) => unknown }).json = (v) => v;

vi.mock("@/lib/db/client", () => ({
  sql: fakeSql,
}));

// Mock clima: devolvemos serie fija
vi.mock("@/lib/clima", () => ({
  obtenerClima: vi.fn(async (_lat: number, _lon: number) => [
    { fecha: "2026-04-10", tMin: 10, tMax: 25, precipitacionMm: 0, origen: "mock" },
  ]),
}));

// Mock suelo
vi.mock("@/lib/suelo", () => ({
  muestrearPredio: vi.fn(
    async (
      _lat: number,
      _lon: number,
      zonas: Array<{ id: string; lat: number; lon: number }>,
    ) => ({
      centroidePredio: {
        lat: 0,
        lon: 0,
        textura: "franco",
        capacidadCampoPct: 30,
        puntoMarchitezPct: 10,
        origen: "mock",
      },
      centroidesZonas: zonas.map((z) => ({
        zonaId: z.id,
        suelo: {
          lat: z.lat,
          lon: z.lon,
          textura: "franco",
          capacidadCampoPct: 30,
          puntoMarchitezPct: 10,
          origen: "mock",
        },
      })),
      heterogeneo: false,
      divergenciaMaxPct: 0,
    }),
  ),
}));

// Mock fenología
vi.mock("@/lib/fenologia", () => ({
  obtenerFenologia: vi.fn(() => ({
    cultivo: "palto_hass",
    mes: 4,
    fase: "desarrollo_fruto",
    kcReferencia: 1.0,
    umbralRojoDeficitPct: 60,
    umbralAmarilloDeficitPct: 40,
    fuente: "test",
    notas: "",
  })),
}));

import { ejecutarJobDiario } from "@/lib/cron/daily-job";
import { SentinelBudget } from "@/lib/cron/sentinel-budget";
import { _setEscritor, _resetEscritor } from "@/lib/cron/logger";

describe("ejecutarJobDiario", () => {
  const logLines: string[] = [];

  beforeEach(() => {
    resetState();
    logLines.length = 0;
    _setEscritor((l) => {
      logLines.push(l);
    });
  });

  afterEach(() => {
    _resetEscritor();
    vi.clearAllMocks();
  });

  function sembrarPrediosYZonas(
    nPredios: number,
    nZonasPorPredio: number,
  ): void {
    for (let i = 0; i < nPredios; i++) {
      const pid = `predio-${i}`;
      state.predios.push({ id: pid, lat: -33 - i * 0.1, lon: -70 - i * 0.1 });
      for (let j = 0; j < nZonasPorPredio; j++) {
        state.zonas.push({
          id: `zona-${i}-${j}`,
          predio_id: pid,
          cultivo: "palto_hass",
          prioridad: "alta",
          fase_fenologica_override: null,
          lat: -33 - i * 0.1,
          lon: -70 - i * 0.1,
        });
      }
    }
  }

  it("procesa 2 predios con 3 zonas cada uno y escribe 6 recomendaciones", async () => {
    sembrarPrediosYZonas(2, 3);
    const r = await ejecutarJobDiario({ fecha: new Date("2026-04-10T12:00:00Z") });
    expect(r.prediosProcesados).toBe(2);
    expect(r.recomendacionesCreadas).toBe(6);
    expect(state.recomendacionesUpserts.length).toBe(6);
    expect(state.estadoUpserts.length).toBe(6);
    expect(r.errores.length).toBe(0);
  });

  it("circuit breaker del sentinel pausa tras 25 llamadas pero sigue procesando", async () => {
    sembrarPrediosYZonas(30, 1);
    const budget = new SentinelBudget();
    const r = await ejecutarJobDiario({
      fecha: new Date("2026-04-10T12:00:00Z"),
      sentinelBudget: budget,
    });
    // Todos los predios se procesan (pausa no es skip en Fase 1), pero se emite evento.
    expect(r.prediosProcesados).toBe(30);
    const breaker = logLines.find((l) =>
      l.includes("CIRCUIT_BREAKER_SENTINEL_ACTIVO"),
    );
    expect(breaker).toBeDefined();
    const pausa = logLines.find((l) =>
      l.includes("job_diario_predio_pausado_sentinel"),
    );
    expect(pausa).toBeDefined();
  });

  it("error en un predio no detiene los otros", async () => {
    sembrarPrediosYZonas(3, 2);
    // Forzar que la 2a llamada a obtenerClima falle:
    const { obtenerClima } = await import("@/lib/clima");
    let count = 0;
    (obtenerClima as unknown as { mockImplementation: Function }).mockImplementation(
      async () => {
        count += 1;
        if (count === 2) throw new Error("clima_caido");
        return [
          {
            fecha: "2026-04-10",
            tMin: 10,
            tMax: 25,
            precipitacionMm: 0,
            origen: "mock",
          },
        ];
      },
    );
    const r = await ejecutarJobDiario({ fecha: new Date("2026-04-10T12:00:00Z") });
    expect(r.errores.length).toBe(1);
    expect(r.prediosProcesados).toBe(2);
    expect(r.recomendacionesCreadas).toBe(4);
  });

  it("emite una línea de log por zona procesada", async () => {
    sembrarPrediosYZonas(1, 3);
    await ejecutarJobDiario({ fecha: new Date("2026-04-10T12:00:00Z") });
    const porZona = logLines.filter((l) => l.includes("job_corrida_zona"));
    expect(porZona.length).toBe(3);
  });

  it("ninguna recomendación persistida contiene columnas litros/mm/volumen", async () => {
    sembrarPrediosYZonas(1, 2);
    await ejecutarJobDiario({ fecha: new Date("2026-04-10T12:00:00Z") });
    for (const up of state.recomendacionesUpserts) {
      for (const col of up.columnas) {
        expect(col).not.toMatch(/litros|mm|volumen|caudal|m3/);
      }
    }
  });
});
