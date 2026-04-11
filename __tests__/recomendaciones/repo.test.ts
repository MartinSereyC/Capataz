import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSql, setMockResult } = vi.hoisted(() => {
  let _result: unknown[] = [];
  const mockSql = Object.assign(
    (_strings: TemplateStringsArray, ..._values: unknown[]) =>
      Promise.resolve(_result),
    {}
  );
  function setMockResult(rows: unknown[]) {
    _result = rows;
  }
  return { mockSql, setMockResult };
});

vi.mock("@/lib/db/client", () => ({ sql: mockSql }));

import {
  listarRecomendacionesDelDia,
  obtenerRecomendacion,
} from "@/lib/recomendaciones/repo";

const baseRec = {
  id: "rec-1",
  zona_id: "zona-1",
  fecha: "2026-04-10",
  semaforo: "rojo" as const,
  timing_etiqueta: "regar hoy",
  confianza: "alta" as const,
  razon_breve: "déficit crítico",
  postergada_por_escasez: false,
  creado_en: new Date("2026-04-10T05:30:00Z"),
  zonaNombre: "Zona A",
  predioNombre: "Fundo Norte",
  predioId: "predio-1",
  cultivo: "vid",
  prioridad: "alta" as const,
};

beforeEach(() => {
  setMockResult([]);
});

describe("listarRecomendacionesDelDia", () => {
  it("returns recommendations filtered by usuario", async () => {
    setMockResult([baseRec]);
    const result = await listarRecomendacionesDelDia("user-1");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("rec-1");
    expect(result[0].zonaNombre).toBe("Zona A");
  });

  it("returns empty array when no recommendations exist", async () => {
    setMockResult([]);
    const result = await listarRecomendacionesDelDia("user-1");
    expect(result).toHaveLength(0);
  });

  it("groups items with predioId for grouping by predio", async () => {
    const rec2 = {
      ...baseRec,
      id: "rec-2",
      predioId: "predio-2",
      predioNombre: "Fundo Sur",
      zonaNombre: "Zona B",
    };
    setMockResult([baseRec, rec2]);
    const result = await listarRecomendacionesDelDia("user-1");
    const predioIds = result.map((r) => r.predioId);
    expect(predioIds).toContain("predio-1");
    expect(predioIds).toContain("predio-2");
  });
});

describe("obtenerRecomendacion", () => {
  it("returns the recommendation when ownership matches", async () => {
    setMockResult([baseRec]);
    const result = await obtenerRecomendacion("rec-1", "user-1");
    expect(result).not.toBeNull();
    expect(result!.id).toBe("rec-1");
    expect(result!.predioNombre).toBe("Fundo Norte");
  });

  it("returns null when not found or wrong usuario", async () => {
    setMockResult([]);
    const result = await obtenerRecomendacion("rec-1", "user-other");
    expect(result).toBeNull();
  });
});
