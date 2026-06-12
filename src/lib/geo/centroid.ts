import type { GeoJSONPolygon } from '@/types';

// Centroide simple (promedio de vértices del anillo exterior).
// Extraído de fusion/engine.ts para uso compartido.
export function centroide(polygon: GeoJSONPolygon): { lat: number; lng: number } {
  const coords = polygon.coordinates[0];
  const lat = coords.reduce((s, c) => s + c[1], 0) / coords.length;
  const lng = coords.reduce((s, c) => s + c[0], 0) / coords.length;
  return { lat, lng };
}
