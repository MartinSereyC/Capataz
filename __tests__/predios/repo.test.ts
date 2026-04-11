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
  crearPredio,
  obtenerPredio,
  listarPrediosPorUsuario,
  actualizarPredio,
  crearZona,
  crearFuenteHidrica,
} from "@/lib/predios/repo";

const fakePredio = {
  id: "predio-1",
  usuario_id: "user-1",
  nombre: "Fundo Norte",
  geometria: '{"type":"Polygon","coordinates":[]}',
  region: "Coquimbo",
  comuna: "La Serena",
  creado_en: new Date(),
  actualizado_en: new Date(),
};

const fakeZona = {
  id: "zona-1",
  predio_id: "predio-1",
  nombre: "Zona A",
  geometria: '{"type":"Polygon","coordinates":[]}',
  cultivo: "vid",
  prioridad: "alta" as const,
  fase_fenologica_override: null,
  creado_en: new Date(),
  actualizado_en: new Date(),
};

const fakeFuente = {
  id: "fuente-1",
  predio_id: "predio-1",
  tipo: "pozo" as const,
  caudal_estimado_lh: "100",
  capacidad_estimada_l: null,
  notas: null,
  creado_en: new Date(),
};

beforeEach(() => {
  setMockResult([]);
});

describe("crearPredio", () => {
  it("returns the created predio row", async () => {
    setMockResult([fakePredio]);
    const result = await crearPredio(
      "user-1",
      "Fundo Norte",
      { type: "Polygon", coordinates: [] },
      "Coquimbo",
      "La Serena"
    );
    expect(result.id).toBe("predio-1");
    expect(result.nombre).toBe("Fundo Norte");
  });
});

describe("obtenerPredio", () => {
  it("returns predio when found", async () => {
    setMockResult([fakePredio]);
    const result = await obtenerPredio("predio-1");
    expect(result).not.toBeNull();
    expect(result!.usuario_id).toBe("user-1");
  });

  it("returns null when not found", async () => {
    setMockResult([]);
    const result = await obtenerPredio("nonexistent");
    expect(result).toBeNull();
  });
});

describe("listarPrediosPorUsuario", () => {
  it("returns array of predios for user", async () => {
    setMockResult([fakePredio, { ...fakePredio, id: "predio-2" }]);
    const result = await listarPrediosPorUsuario("user-1");
    expect(result).toHaveLength(2);
    expect(result[0].usuario_id).toBe("user-1");
  });
});

describe("actualizarPredio", () => {
  it("returns updated predio row", async () => {
    setMockResult([{ ...fakePredio, nombre: "Fundo Sur" }]);
    const result = await actualizarPredio("predio-1", { nombre: "Fundo Sur" });
    expect(result.nombre).toBe("Fundo Sur");
  });
});

describe("crearZona", () => {
  it("returns the created zona row", async () => {
    setMockResult([fakeZona]);
    const result = await crearZona(
      "predio-1",
      "Zona A",
      { type: "Polygon", coordinates: [] },
      "vid",
      "alta"
    );
    expect(result.id).toBe("zona-1");
    expect(result.cultivo).toBe("vid");
    expect(result.prioridad).toBe("alta");
  });
});

describe("crearFuenteHidrica", () => {
  it("returns the created fuente row", async () => {
    setMockResult([fakeFuente]);
    const result = await crearFuenteHidrica("predio-1", "pozo", 100, null, null);
    expect(result.id).toBe("fuente-1");
    expect(result.tipo).toBe("pozo");
  });
});
