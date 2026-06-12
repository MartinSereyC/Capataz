// Historial satelital por zona vía CDSE Statistical API: una llamada por
// ventana devuelve medias por adquisición (vs ~70 llamadas Process por año).
// Fallback: iterar fechas del catálogo con el Process API por fecha.
// En MOCK: series sintéticas deterministas por pasada.
import { getSentinelToken } from './auth';
import { isMockMode } from './mock';
import { getZoneStats, bboxFromPolygon, mockNdviForPolygon, mockNdmiForPolygon } from './zone-stats';
import { getAvailableDates } from './dates';
import { getSarDates } from '../sentinel1/query';
import { getSarStats } from '../sentinel1/stats';
import type { GeoJSONPolygon } from '@/types';

const STATISTICAL_URL = 'https://sh.dataspace.copernicus.eu/api/v1/statistics';

export interface S2HistoryEntry {
  fecha: string;
  ndvi: number | null;
  ndmi: number | null;
  nubosidadPct: number | null; // fracción nubosa sobre la zona (SCL), no de la escena
  origen: 'cdse_statistical' | 'cdse_process' | 'mock';
}

export interface S1HistoryEntry {
  fecha: string;
  vvDb: number | null;
  vhDb: number | null;
  orbit: string | null;
  origen: 'cdse_statistical' | 'cdse_process' | 'mock';
}

// NDVI + NDMI + fracción de nubes (SCL 3/8/9/10) con dataMask, por adquisición.
const S2_STATS_EVALSCRIPT = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B04", "B08", "B11", "SCL", "dataMask"] }],
    output: [
      { id: "indices", bands: 2, sampleType: "FLOAT32" },
      { id: "clouds", bands: 1, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1 }
    ]
  };
}
function evaluatePixel(s) {
  var d1 = s.B08 + s.B04, d2 = s.B08 + s.B11;
  var ndvi = d1 > 0 ? (s.B08 - s.B04) / d1 : 0;
  var ndmi = d2 > 0 ? (s.B08 - s.B11) / d2 : 0;
  var cloud = (s.SCL === 3 || s.SCL === 8 || s.SCL === 9 || s.SCL === 10) ? 1 : 0;
  return { indices: [ndvi, ndmi], clouds: [cloud], dataMask: [s.dataMask] };
}`;

// VV/VH en dB por pixel (media de dB sobre la zona).
const S1_STATS_EVALSCRIPT = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["VV", "VH", "dataMask"] }],
    output: [
      { id: "db", bands: 2, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1 }
    ]
  };
}
function toDb(v) { return v > 0 ? 10 * Math.log(v) / Math.LN10 : -30; }
function evaluatePixel(s) {
  return { db: [toDb(s.VV), toDb(s.VH)], dataMask: [s.dataMask] };
}`;

interface StatisticalInterval {
  interval: { from: string; to: string };
  outputs?: Record<string, {
    bands: Record<string, { stats: { mean: number | null; sampleCount?: number; noDataCount?: number } }>;
  }>;
}

async function callStatisticalApi(
  polygon: GeoJSONPolygon,
  collection: 'sentinel-2-l2a' | 'sentinel-1-grd',
  evalscript: string,
  desde: string,
  hasta: string,
): Promise<StatisticalInterval[]> {
  const { token } = await getSentinelToken();

  const body = {
    input: {
      bounds: {
        geometry: polygon,
        properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/4326' },
      },
      data: [{ type: collection, dataFilter: {} }],
    },
    aggregation: {
      timeRange: {
        from: `${desde}T00:00:00Z`,
        to: `${hasta}T23:59:59Z`,
      },
      aggregationInterval: { of: 'P1D' },
      width: 32,
      height: 32,
      evalscript,
    },
    calculations: { default: {} },
  };

  const res = await fetch(STATISTICAL_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Statistical API error ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = (await res.json()) as { data?: StatisticalInterval[] };
  return data.data ?? [];
}

// ── Mocks deterministas ──────────────────────────────────────────────
function hash01(...vals: number[]): number {
  let h = 0;
  for (const v of vals) h = Math.sin(h * 12.9898 + v * 78.233) * 43758.5453;
  return Math.abs(h - Math.floor(h));
}

function dayOfYear(fecha: string): number {
  const [y, m, d] = fecha.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86_400_000) + 1;
}

function* fechasCadaN(desde: string, hasta: string, n: number): Generator<string> {
  const [y1, m1, d1] = desde.split('-').map(Number);
  const [y2, m2, d2] = hasta.split('-').map(Number);
  const fin = Date.UTC(y2, m2 - 1, d2);
  let t = Date.UTC(y1, m1 - 1, d1);
  while (t <= fin) {
    yield new Date(t).toISOString().split('T')[0];
    t += n * 86_400_000;
  }
}

export function mockS2History(polygon: GeoJSONPolygon, desde: string, hasta: string): S2HistoryEntry[] {
  const [lng, lat] = polygon.coordinates[0][0];
  const baseNdvi = mockNdviForPolygon(polygon);
  const baseNdmi = mockNdmiForPolygon(polygon);
  const out: S2HistoryEntry[] = [];

  for (const fecha of fechasCadaN(desde, hasta, 5)) {
    const doy = dayOfYear(fecha);
    // Canopia mayor en verano (hemisferio sur)
    const estacional = 0.12 * Math.cos((2 * Math.PI * (doy - 15)) / 365);
    const ruido = (hash01(lat, lng, doy) - 0.5) * 0.08;
    const nubosidad = hash01(doy, lng, lat) < 0.25
      ? 60 + hash01(doy * 2, lat, lng) * 40 // pasada nublada inutilizable
      : hash01(doy * 3, lng, lat) * 40;

    out.push({
      fecha,
      ndvi: Math.round(Math.max(-0.2, Math.min(0.95, baseNdvi + estacional + ruido)) * 1000) / 1000,
      ndmi: Math.round(Math.max(-0.6, Math.min(0.6, baseNdmi + estacional * 0.8 + ruido)) * 1000) / 1000,
      nubosidadPct: Math.round(nubosidad * 10) / 10,
      origen: 'mock',
    });
  }
  return out;
}

export function mockS1History(polygon: GeoJSONPolygon, desde: string, hasta: string): S1HistoryEntry[] {
  const [lng, lat] = polygon.coordinates[0][0];
  const baseVv = -25 + Math.abs(Math.sin(lng * 91.3 + lat * 257.8)) * 15;
  const out: S1HistoryEntry[] = [];

  for (const fecha of fechasCadaN(desde, hasta, 6)) {
    const doy = dayOfYear(fecha);
    const ruido = (hash01(lng, doy, lat) - 0.5) * 3;
    const vv = Math.round((baseVv + ruido) * 10) / 10;
    out.push({
      fecha,
      vvDb: vv,
      vhDb: Math.round((vv - 7) * 10) / 10,
      orbit: doy % 2 === 0 ? 'descending' : 'ascending',
      origen: 'mock',
    });
  }
  return out;
}

// ── Historia S2 ──────────────────────────────────────────────────────
export async function getS2StatsHistory(
  polygon: GeoJSONPolygon,
  desde: string,
  hasta: string,
): Promise<S2HistoryEntry[]> {
  if (isMockMode()) return mockS2History(polygon, desde, hasta);

  try {
    const intervals = await callStatisticalApi(polygon, 'sentinel-2-l2a', S2_STATS_EVALSCRIPT, desde, hasta);
    return intervals
      .map((iv): S2HistoryEntry | null => {
        const indices = iv.outputs?.indices?.bands;
        const clouds = iv.outputs?.clouds?.bands?.B0?.stats.mean;
        if (!indices) return null;
        const ndvi = indices.B0?.stats.mean ?? null;
        const ndmi = indices.B1?.stats.mean ?? null;
        if (ndvi === null && ndmi === null) return null;
        return {
          fecha: iv.interval.from.split('T')[0],
          ndvi: ndvi !== null ? Math.round(ndvi * 1000) / 1000 : null,
          ndmi: ndmi !== null ? Math.round(ndmi * 1000) / 1000 : null,
          nubosidadPct: clouds != null ? Math.round(clouds * 1000) / 10 : null,
          origen: 'cdse_statistical',
        };
      })
      .filter((e): e is S2HistoryEntry => e !== null);
  } catch (err) {
    console.warn('[statistical] S2 Statistical API falló, usando fallback por fecha:',
      err instanceof Error ? err.message : err);
    return s2HistoryViaProcess(polygon, desde, hasta);
  }
}

async function s2HistoryViaProcess(
  polygon: GeoJSONPolygon,
  desde: string,
  hasta: string,
): Promise<S2HistoryEntry[]> {
  const bbox = bboxFromPolygon(polygon);
  const { dates, cloud_coverage } = await getAvailableDates(bbox, desde, hasta, 'sentinel-2-l2a');
  const out: S2HistoryEntry[] = [];
  for (const fecha of dates) {
    const stats = await getZoneStats(polygon, fecha);
    out.push({
      fecha,
      ndvi: stats.ndvi,
      ndmi: stats.ndmi,
      nubosidadPct: cloud_coverage[fecha] ?? null,
      origen: 'cdse_process',
    });
  }
  return out;
}

// ── Historia S1 ──────────────────────────────────────────────────────
export async function getS1StatsHistory(
  polygon: GeoJSONPolygon,
  desde: string,
  hasta: string,
): Promise<S1HistoryEntry[]> {
  if (isMockMode()) return mockS1History(polygon, desde, hasta);

  try {
    const intervals = await callStatisticalApi(polygon, 'sentinel-1-grd', S1_STATS_EVALSCRIPT, desde, hasta);
    return intervals
      .map((iv): S1HistoryEntry | null => {
        const db = iv.outputs?.db?.bands;
        if (!db) return null;
        const vv = db.B0?.stats.mean ?? null;
        const vh = db.B1?.stats.mean ?? null;
        if (vv === null) return null;
        return {
          fecha: iv.interval.from.split('T')[0],
          vvDb: Math.round(vv * 10) / 10,
          vhDb: vh !== null ? Math.round(vh * 10) / 10 : null,
          orbit: null, // el Statistical API no expone la dirección de órbita
          origen: 'cdse_statistical',
        };
      })
      .filter((e): e is S1HistoryEntry => e !== null);
  } catch (err) {
    console.warn('[statistical] S1 Statistical API falló, usando fallback por fecha:',
      err instanceof Error ? err.message : err);
    return s1HistoryViaProcess(polygon, desde, hasta);
  }
}

async function s1HistoryViaProcess(
  polygon: GeoJSONPolygon,
  desde: string,
  hasta: string,
): Promise<S1HistoryEntry[]> {
  const bbox = bboxFromPolygon(polygon);
  const sarDates = await getSarDates(bbox, desde, hasta);
  const out: S1HistoryEntry[] = [];
  for (const { date, orbitDirection } of sarDates) {
    try {
      const stats = await getSarStats(polygon, date);
      out.push({ fecha: date, vvDb: stats.vv, vhDb: stats.vh, orbit: orbitDirection, origen: 'cdse_process' });
    } catch {
      // pasada sin cobertura sobre la zona: omitir
    }
  }
  return out;
}
