import { NextRequest, NextResponse } from 'next/server';
import { runFusion } from '@/lib/fusion/engine';
import { obtenerClimaHistoricoYForecast } from '@/lib/clima/open-meteo';
import { obtenerSuelo } from '@/lib/suelo/soilgrids';
import { obtenerSueloMock } from '@/lib/suelo/mock';
import { getMostRecentSarDate } from '@/lib/sentinel1/query';
import { getSarStats } from '@/lib/sentinel1/stats';
import { isMockMode } from '@/lib/sentinel/mock';
import type { GeoJSONPolygon, BboxGeoJSON } from '@/types';

function centroide(polygon: GeoJSONPolygon): { lat: number; lng: number } {
  const coords = polygon.coordinates[0];
  const lat = coords.reduce((s: number, c: number[]) => s + c[1], 0) / coords.length;
  const lng = coords.reduce((s: number, c: number[]) => s + c[0], 0) / coords.length;
  return { lat, lng };
}

function bboxFromPolygon(polygon: GeoJSONPolygon): BboxGeoJSON {
  const coords = polygon.coordinates[0];
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  }
  return [minLng, minLat, maxLng, maxLat];
}

export async function POST(req: NextRequest) {
  let polygon: GeoJSONPolygon;
  let crop: string;
  let date: string;
  let ndmi: number | null;
  let cloudCoverage: number | null;

  try {
    ({ polygon, crop, date, ndmi, cloudCoverage } = await req.json() as {
      polygon: GeoJSONPolygon;
      crop: string;
      date: string;
      ndmi: number | null;
      cloudCoverage: number | null;
    });
    if (!polygon || !crop) throw new Error('missing fields');
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  try {
    const { lat, lng } = centroide(polygon);
    const bbox = bboxFromPolygon(polygon);

    // Fetch weather and soil in parallel; try SAR if optical is old/cloudy
    const diasDesdeS2 = date ? Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000) : null;
    const s2Clear = cloudCoverage === null || cloudCoverage < 60;
    const s2Usable = diasDesdeS2 !== null && diasDesdeS2 <= 6 && s2Clear && ndmi !== null;

    const [weather, suelo] = await Promise.all([
      obtenerClimaHistoricoYForecast(lat, lng, 14, 7),
      isMockMode() ? Promise.resolve(obtenerSueloMock(lat, lng)) : obtenerSuelo(lat, lng),
    ]);

    // Try SAR only when optical is not usable
    let sarVv: number | null = null;
    let sarDate: string | null = null;

    if (!s2Usable) {
      try {
        const sarEntry = await getMostRecentSarDate(bbox, 14);
        if (sarEntry) {
          const sarStats = await getSarStats(polygon, sarEntry.date);
          sarVv = sarStats.vv;
          sarDate = sarEntry.date;
        }
      } catch {
        // SAR failure is non-fatal; fusion degrades gracefully to baja confianza
      }
    }

    const result = runFusion({
      polygon,
      cropDisplay: crop,
      date,
      ndmi,
      cloudCoverage,
      weather,
      suelo,
      sarVv,
      sarDate,
    });

    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[fusion] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
