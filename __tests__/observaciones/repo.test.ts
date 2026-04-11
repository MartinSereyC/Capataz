import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the DB client so no real connection is needed
vi.mock("@/lib/db/client", () => {
  const sqlMock = vi.fn();
  // Make sqlMock behave as a tagged template literal function
  // and also support chaining (postgres returns the array directly)
  const handler = (...args: unknown[]) => sqlMock(...args);
  return { sql: handler, _sqlMock: sqlMock };
});

// We need a way to control what sql returns per test — re-import after mock
import * as dbClient from "@/lib/db/client";

import {
  obtenerUltimaObservacion,
  insertarObservacion,
  listarObservaciones,
} from "../../src/lib/observaciones/repo";
import type { ObservacionSatelital } from "../../src/lib/observaciones/types";

const ROW = {
  zona_id: "zona-1",
  fecha: "2025-04-05",
  ndvi: "0.61",
  ndmi: "0.22",
  fuente: "sentinel-2",
  payload: { mock: false },
};

const OBS: ObservacionSatelital = {
  zonaId: "zona-1",
  fecha: "2025-04-05",
  ndvi: 0.61,
  ndmi: 0.22,
  fuente: "sentinel-2",
  payloadRaw: { mock: false },
};

// Helper: make sql tagged template literal return a value
function mockSql(returnValue: unknown[]) {
  // The repo calls: sql`...` which returns a Promise-like (postgres returns array)
  // We stub the entire module's sql export
  const fakeTag = Object.assign(
    vi.fn().mockReturnValue(Promise.resolve(returnValue)),
    { // postgres sql also has unsafe etc — not needed here
    }
  );
  // Replace the named export — vitest mocks are mutable
  vi.spyOn(dbClient, "sql" as never).mockImplementation(fakeTag as never);
  return fakeTag;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("obtenerUltimaObservacion", () => {
  it("devuelve null cuando no hay filas", async () => {
    mockSql([]);
    const result = await obtenerUltimaObservacion("zona-1");
    expect(result).toBeNull();
  });

  it("mapea la fila correctamente", async () => {
    mockSql([ROW]);
    const result = await obtenerUltimaObservacion("zona-1");
    expect(result).toEqual(OBS);
  });
});

describe("insertarObservacion", () => {
  it("inserta y devuelve la observación mapeada", async () => {
    mockSql([ROW]);
    const result = await insertarObservacion(OBS);
    expect(result).toEqual(OBS);
  });
});

describe("listarObservaciones", () => {
  it("devuelve lista vacía cuando no hay resultados", async () => {
    mockSql([]);
    const result = await listarObservaciones("zona-1", "2025-01-01");
    expect(result).toEqual([]);
  });

  it("mapea múltiples filas", async () => {
    const row2 = { ...ROW, fecha: "2025-04-20", ndvi: "0.55", ndmi: "0.10" };
    mockSql([ROW, row2]);
    const result = await listarObservaciones("zona-1", "2025-01-01");
    expect(result).toHaveLength(2);
    expect(result[0].fecha).toBe("2025-04-05");
    expect(result[1].fecha).toBe("2025-04-20");
    expect(result[1].ndvi).toBe(0.55);
  });
});
