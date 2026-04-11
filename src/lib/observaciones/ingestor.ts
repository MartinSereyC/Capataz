/**
 * Thin adapter that fetches numeric NDVI + NDMI means for a polygon
 * via the Sentinel Hub Process API (Statistics endpoint), then persists
 * a new row in observaciones_satelitales if the image date is newer than
 * anything already stored for this zona.
 *
 * The existing src/lib/sentinel/ module only handles tile rendering; it does
 * not expose numeric index values. This file composes what is there
 * (auth token, mock flag, config) without modifying those files.
 */

import { SENTINEL_CONFIG } from "@/lib/constants";
import { getSentinelToken } from "@/lib/sentinel/auth";
import { isMockMode, getMockDates } from "@/lib/sentinel/mock";
import { getAvailableDates } from "@/lib/sentinel/dates";
import { obtenerUltimaObservacion, insertarObservacion } from "./repo";
import type { ObservacionSatelital } from "./types";

// ---------------------------------------------------------------------------
// Optional budget import — the cron agent may not have created this yet.
// We type it locally so the build always succeeds.
// ---------------------------------------------------------------------------
// TODO: replace with a real import once cron agent ships sentinel-budget:
//   import { SentinelBudget } from "@/lib/cron/sentinel-budget";
interface BudgetLike {
  debePausar(): boolean;
  incrementar(): void;
}

// ---------------------------------------------------------------------------
// Evalscript that returns per-band mean values (no image output needed).
// Sentinel Hub Statistical API format v3.
// ---------------------------------------------------------------------------
const EVALSCRIPT_ESTADISTICAS = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B08", "B04", "B11"], units: "REFLECTANCE" }],
    output: [
      { id: "ndvi", bands: 1, sampleType: "FLOAT32" },
      { id: "ndmi", bands: 1, sampleType: "FLOAT32" }
    ]
  };
}
function evaluatePixel(sample) {
  var ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04 + 1e-10);
  var ndmi = (sample.B08 - sample.B11) / (sample.B08 + sample.B11 + 1e-10);
  return { ndvi: [ndvi], ndmi: [ndmi] };
}`;

interface StatOutputBand {
  mean: number | null;
}

interface StatOutput {
  ndvi?: { bands?: { B0?: StatOutputBand } };
  ndmi?: { bands?: { B0?: StatOutputBand } };
}

interface StatFeature {
  interval?: { from: string };
  outputs?: StatOutput;
}

interface StatResponse {
  data?: StatFeature[];
}

/**
 * Fetches the mean NDVI and NDMI for a polygon over a date range using
 * the Sentinel Hub Statistical API. Returns null when no scene is found.
 */
async function fetchNdviNdmi(
  geometriaGeoJSON: object,
  fechaDesde: string,
  fechaHasta: string,
): Promise<{ fecha: string; ndvi: number | null; ndmi: number | null; payload: unknown } | null> {
  const { token } = await getSentinelToken();

  const body = {
    input: {
      bounds: { geometry: geometriaGeoJSON },
      data: [
        {
          type: SENTINEL_CONFIG.collection,
          dataFilter: {
            timeRange: {
              from: `${fechaDesde}T00:00:00Z`,
              to: `${fechaHasta}T23:59:59Z`,
            },
            maxCloudCoverage: 30,
          },
        },
      ],
    },
    aggregation: {
      timeRange: {
        from: `${fechaDesde}T00:00:00Z`,
        to: `${fechaHasta}T23:59:59Z`,
      },
      aggregationInterval: { of: "P1D" },
      evalscript: EVALSCRIPT_ESTADISTICAS,
      resx: 20,
      resy: 20,
    },
    calculations: { default: {} },
  };

  const statsUrl = "https://services.sentinel-hub.com/api/v1/statistics";

  const res = await fetch(statsUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Sentinel Statistics request failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json() as StatResponse;
  const features = data.data ?? [];

  // Find the most recent day with actual data (mean !== null)
  for (let i = features.length - 1; i >= 0; i--) {
    const f = features[i];
    const ndvi = f.outputs?.ndvi?.bands?.B0?.mean ?? null;
    const ndmi = f.outputs?.ndmi?.bands?.B0?.mean ?? null;
    if (ndvi !== null || ndmi !== null) {
      const fecha = (f.interval?.from ?? "").split("T")[0];
      return { fecha, ndvi, ndmi, payload: f };
    }
  }

  return null;
}

/**
 * Mock path: returns a synthetic observation for the latest mock date
 * relative to fechaDesde, or null if no mock date qualifies.
 */
function mockObservacion(
  fechaDesde: string,
): { fecha: string; ndvi: number | null; ndmi: number | null; payload: unknown } | null {
  const dates = getMockDates().filter((d) => d >= fechaDesde);
  if (dates.length === 0) return null;
  const fecha = dates[dates.length - 1];
  return {
    fecha,
    ndvi: 0.52,
    ndmi: 0.18,
    payload: { mock: true, fecha },
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function ingestarUltimaObservacion(
  zonaId: string,
  geometriaGeoJSON: object,
  fechaDesde: string,
  budget?: BudgetLike,
): Promise<ObservacionSatelital | null> {
  // Circuit-breaker: skip if over budget
  if (budget && budget.debePausar()) {
    return null;
  }

  // Signal intent to consume one request unit before fetching
  budget?.incrementar();

  let resultado: { fecha: string; ndvi: number | null; ndmi: number | null; payload: unknown } | null;

  if (isMockMode()) {
    resultado = mockObservacion(fechaDesde);
  } else {
    const hoy = new Date().toISOString().split("T")[0];
    // Use available dates to find the bbox; we rely on the geometry centroid
    // as a cheap proxy bbox for the catalog check, then call statistics API.
    resultado = await fetchNdviNdmi(geometriaGeoJSON, fechaDesde, hoy);
  }

  if (!resultado) return null;

  // Skip if we already have a row for this zona on this date
  const existente = await obtenerUltimaObservacion(zonaId);
  if (existente && existente.fecha >= resultado.fecha) {
    return null;
  }

  const nueva: ObservacionSatelital = {
    zonaId,
    fecha: resultado.fecha,
    ndvi: resultado.ndvi,
    ndmi: resultado.ndmi,
    fuente: "sentinel-2",
    payloadRaw: resultado.payload,
  };

  return insertarObservacion(nueva);
}
