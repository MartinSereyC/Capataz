import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the sentinel modules before importing the module under test
vi.mock("@/lib/sentinel/auth", () => ({
  getSentinelToken: vi.fn().mockResolvedValue({ token: "test-token", expires_in: 3600 }),
}));

vi.mock("@/lib/sentinel/mock", () => ({
  isMockMode: vi.fn().mockReturnValue(false),
  getMockDates: vi.fn().mockReturnValue(["2025-03-01", "2025-03-15", "2025-04-01"]),
}));

vi.mock("@/lib/sentinel/dates", () => ({
  getAvailableDates: vi.fn(),
}));

vi.mock("@/lib/observaciones/repo", () => ({
  obtenerUltimaObservacion: vi.fn(),
  insertarObservacion: vi.fn(),
}));

import { ingestarUltimaObservacion } from "../../src/lib/observaciones/ingestor";
import { obtenerUltimaObservacion, insertarObservacion } from "../../src/lib/observaciones/repo";
import { isMockMode, getMockDates } from "@/lib/sentinel/mock";

const ZONA_ID = "zona-abc-123";
const GEOM = { type: "Polygon", coordinates: [[[-70.6, -33.4], [-70.5, -33.4], [-70.5, -33.3], [-70.6, -33.3], [-70.6, -33.4]]] };
const FECHA_DESDE = "2025-03-01";

beforeEach(() => {
  vi.clearAllMocks();
  // Default: not mock mode
  vi.mocked(isMockMode).mockReturnValue(false);
});

describe("ingestarUltimaObservacion", () => {
  it("(a) nueva imagen más reciente → inserta y devuelve la observación", async () => {
    // No existing observation
    vi.mocked(obtenerUltimaObservacion).mockResolvedValue(null);

    // Stub global fetch to return a valid statistics response
    const statsPayload = {
      data: [
        {
          interval: { from: "2025-04-05T00:00:00Z", to: "2025-04-05T23:59:59Z" },
          outputs: {
            ndvi: { bands: { B0: { mean: 0.61 } } },
            ndmi: { bands: { B0: { mean: 0.22 } } },
          },
        },
      ],
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => statsPayload,
    } as Response);

    const expected = {
      zonaId: ZONA_ID,
      fecha: "2025-04-05",
      ndvi: 0.61,
      ndmi: 0.22,
      fuente: "sentinel-2",
      payloadRaw: statsPayload.data[0],
    };
    vi.mocked(insertarObservacion).mockResolvedValue(expected);

    const result = await ingestarUltimaObservacion(ZONA_ID, GEOM, FECHA_DESDE);

    expect(insertarObservacion).toHaveBeenCalledOnce();
    expect(result).toEqual(expected);
  });

  it("(b) fecha igual a la existente → no inserta, devuelve null", async () => {
    vi.mocked(obtenerUltimaObservacion).mockResolvedValue({
      zonaId: ZONA_ID,
      fecha: "2025-04-05",
      ndvi: 0.58,
      ndmi: 0.19,
      fuente: "sentinel-2",
      payloadRaw: null,
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            interval: { from: "2025-04-05T00:00:00Z" },
            outputs: {
              ndvi: { bands: { B0: { mean: 0.61 } } },
              ndmi: { bands: { B0: { mean: 0.22 } } },
            },
          },
        ],
      }),
    } as Response);

    const result = await ingestarUltimaObservacion(ZONA_ID, GEOM, FECHA_DESDE);

    expect(insertarObservacion).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it("(c) budget.debePausar() true → no llama a sentinel ni inserta", async () => {
    const budget = {
      debePausar: vi.fn().mockReturnValue(true),
      incrementar: vi.fn(),
    };

    global.fetch = vi.fn();

    const result = await ingestarUltimaObservacion(ZONA_ID, GEOM, FECHA_DESDE, budget);

    expect(budget.incrementar).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(obtenerUltimaObservacion).not.toHaveBeenCalled();
    expect(insertarObservacion).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it("(d) sentinel lanza error → no inserta y propaga el error", async () => {
    vi.mocked(obtenerUltimaObservacion).mockResolvedValue(null);

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    } as Response);

    await expect(
      ingestarUltimaObservacion(ZONA_ID, GEOM, FECHA_DESDE),
    ).rejects.toThrow("Sentinel Statistics request failed");

    expect(insertarObservacion).not.toHaveBeenCalled();
  });
});
