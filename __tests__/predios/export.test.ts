import { describe, it, expect, vi } from "vitest";

const { mockSql, resetResponses } = vi.hoisted(() => {
  const responses: unknown[][] = [];
  let callIndex = 0;

  const mockSql = (_strings: TemplateStringsArray, ..._values: unknown[]) => {
    const result = responses[callIndex] ?? [];
    callIndex++;
    return Promise.resolve(result);
  };

  function resetResponses(list: unknown[][]) {
    responses.length = 0;
    list.forEach((r) => responses.push(r));
    callIndex = 0;
  }

  return { mockSql, resetResponses };
});

vi.mock("@/lib/db/client", () => ({ sql: mockSql }));

import { exportarPredioJSON } from "@/lib/predios/export";

const fakePredio = {
  id: "predio-1",
  usuario_id: "user-1",
  nombre: "Fundo Norte",
  geometria: { type: "Polygon", coordinates: [] },
  region: "Coquimbo",
  comuna: "La Serena",
  creado_en: new Date(),
  actualizado_en: new Date(),
};

const fakeZona = {
  id: "zona-1",
  predio_id: "predio-1",
  nombre: "Zona A",
  geometria: { type: "Polygon", coordinates: [] },
  cultivo: "vid",
  prioridad: "alta",
  fase_fenologica_override: null,
  creado_en: new Date(),
  actualizado_en: new Date(),
};

// Order matches Promise.all in export.ts:
// [predio, zonas, fuentes, fuente_zona, clima, suelo] then [obs, hidrico, recom] then [feedback]
const fullResponses = [
  [fakePredio],
  [fakeZona],
  [],
  [],
  [{ id: "c1", fecha: "2026-04-01", t_min: 5, t_max: 20 }],
  [],
  [{ id: "o1", zona_id: "zona-1", fecha: "2026-04-01" }],
  [{ id: "h1", zona_id: "zona-1", fecha: "2026-04-01" }],
  [{ id: "r1", zona_id: "zona-1", fecha: "2026-04-01" }],
  [],
];

describe("exportarPredioJSON", () => {
  it("returns all 9 top-level sections", async () => {
    resetResponses(fullResponses);
    const result = (await exportarPredioJSON("predio-1")) as Record<string, unknown>;

    expect(result).toHaveProperty("predio");
    expect(result).toHaveProperty("zonas");
    expect(result).toHaveProperty("fuentes_hidricas");
    expect(result).toHaveProperty("clima_diario");
    expect(result).toHaveProperty("suelo_estimado");
    expect(result).toHaveProperty("observaciones_satelitales");
    expect(result).toHaveProperty("estado_hidrico_interno");
    expect(result).toHaveProperty("recomendaciones_diarias");
    expect(result).toHaveProperty("feedback_agricultor");
  });

  it("strips forbidden volume keys even if DB somehow returns them", async () => {
    const contaminatedPredio = {
      ...fakePredio,
      litros_totales: 999,
      et0_mm: 3.5,
      volumen_riego: 100,
    };
    const contaminatedZona = {
      ...fakeZona,
      riego_mm: 5,
    };
    resetResponses([
      [contaminatedPredio],
      [contaminatedZona],
      [],
      [],
      [],
      [],
      [],
      [],
      [],
      [],
    ]);

    const result = (await exportarPredioJSON("predio-1")) as Record<string, unknown>;
    const json = JSON.stringify(result);

    expect(json).not.toContain("litros_totales");
    expect(json).not.toContain("volumen_riego");
    expect(json).not.toContain("et0_mm");
    expect(json).not.toContain("riego_mm");
  });

  it("returns empty arrays (not null) for an empty predio with no zonas", async () => {
    // No zonas — second batch (obs, hidrico, recom) is skipped, feedback also skipped
    resetResponses([
      [fakePredio],
      [],
      [],
      [],
      [],
      [],
    ]);

    const result = (await exportarPredioJSON("predio-1")) as Record<string, unknown>;

    expect(Array.isArray(result.zonas)).toBe(true);
    expect((result.zonas as unknown[]).length).toBe(0);
    expect(Array.isArray(result.fuentes_hidricas)).toBe(true);
    expect(Array.isArray(result.clima_diario)).toBe(true);
    expect(Array.isArray(result.observaciones_satelitales)).toBe(true);
    expect(Array.isArray(result.estado_hidrico_interno)).toBe(true);
    expect(Array.isArray(result.recomendaciones_diarias)).toBe(true);
    expect(Array.isArray(result.feedback_agricultor)).toBe(true);
  });
});
