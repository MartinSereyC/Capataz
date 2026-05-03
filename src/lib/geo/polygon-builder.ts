/**
 * GeoJSON polygon builder.
 * Takes WGS84 [lng, lat] coordinate pairs and builds:
 *   - GeoJSON Polygon geometry
 *   - BboxGeoJSON [minLng, minLat, maxLng, maxLat]
 *   - Leaflet-compatible bbox [[minLat, minLng], [maxLat, maxLng]]
 *
 * BBOX CONVENTION: All bboxes follow GeoJSON standard [minLng, minLat, maxLng, maxLat].
 */

import type { BboxGeoJSON, GeoJSONPolygon } from "@/types";

export type LeafletBounds = [[number, number], [number, number]];

export interface BuiltPolygon {
  polygon: GeoJSONPolygon;
  bboxGeoJSON: BboxGeoJSON;
  area_hectares: number;
}

/**
 * Convert a GeoJSON bbox to Leaflet LatLngBounds format.
 * GeoJSON:  [minLng, minLat, maxLng, maxLat]
 * Leaflet:  [[minLat, minLng], [maxLat, maxLng]]
 */
export function toBboxLeaflet(bbox: BboxGeoJSON): LeafletBounds {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ];
}

/**
 * Compute approximate area in hectares using the Shoelace formula.
 * Coordinates must be in decimal degrees; uses a flat-Earth approximation
 * adequate for parcels < 100 km².
 */
function computeAreaHectares(coords: [number, number][]): number {
  // Use average latitude for metre-per-degree scaling
  const avgLat =
    coords.reduce((sum, [, lat]) => sum + lat, 0) / coords.length;
  const metersPerDegLat = 111_320;
  const metersPerDegLng = 111_320 * Math.cos((avgLat * Math.PI) / 180);

  // Shoelace on projected coords
  let area = 0;
  const n = coords.length;
  for (let i = 0; i < n; i++) {
    const [lng1, lat1] = coords[i];
    const [lng2, lat2] = coords[(i + 1) % n];
    const x1 = lng1 * metersPerDegLng;
    const y1 = lat1 * metersPerDegLat;
    const x2 = lng2 * metersPerDegLng;
    const y2 = lat2 * metersPerDegLat;
    area += x1 * y2 - x2 * y1;
  }
  const areaM2 = Math.abs(area) / 2;
  return areaM2 / 10_000; // m² → hectares
}

/**
 * Build a GeoJSON polygon and bounding box from an array of [lng, lat] pairs.
 * The ring is automatically closed (first point appended at end if needed).
 * Throws if fewer than 3 points are provided.
 *
 * @param coordinates - Array of [lng, lat] pairs (WGS84)
 * @returns BuiltPolygon containing polygon geometry, bboxGeoJSON, and area_hectares
 */
export function buildPolygon(coordinates: [number, number][]): BuiltPolygon {
  if (coordinates.length < 3) {
    throw new Error(
      `Se necesitan al menos 3 puntos para construir un polígono (recibidos: ${coordinates.length})`
    );
  }

  // Close the ring if not already closed
  const ring: [number, number][] = [...coordinates];
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push([first[0], first[1]]);
  }

  const polygon: GeoJSONPolygon = {
    type: "Polygon",
    coordinates: [ring.map(([lng, lat]) => [lng, lat])],
  };

  // Compute bbox — use open ring (exclude closing duplicate)
  const open = ring.slice(0, -1);
  const lngs = open.map(([lng]) => lng);
  const lats = open.map(([, lat]) => lat);

  const bboxGeoJSON: BboxGeoJSON = [
    Math.min(...lngs),
    Math.min(...lats),
    Math.max(...lngs),
    Math.max(...lats),
  ];

  const area_hectares = computeAreaHectares(open);

  return { polygon, bboxGeoJSON, area_hectares };
}

/**
 * Ray-casting point-in-polygon test on a GeoJSON ring.
 * `ring` is a list of [lng, lat] pairs (closed or open both work).
 */
export function pointInRing(
  point: [number, number],
  ring: [number, number][],
): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi || Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * True when every vertex of `inner` lies inside `outer`.
 * Both arguments are GeoJSON polygons (uses the outer ring only).
 */
export function polygonInsidePolygon(
  inner: GeoJSONPolygon,
  outer: GeoJSONPolygon,
): boolean {
  const outerRing = outer.coordinates[0] as [number, number][];
  const innerRing = inner.coordinates[0] as [number, number][];
  return innerRing.every((p) => pointInRing(p, outerRing));
}

/** Minimum distance from a point to a line segment (in degrees). */
function distanceToSegment(
  point: [number, number],
  a: [number, number],
  b: [number, number],
): number {
  const [px, py] = point;
  const [ax, ay] = a;
  const [bx, by] = b;
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * True when the point is strictly inside the ring OR within `toleranceDeg`
 * of any edge (~5 m at Chile's latitude with the default 0.00005°).
 * Use this instead of `pointInRing` when boundary/edge clicks should be allowed.
 */
export function pointOnOrInsideRing(
  point: [number, number],
  ring: [number, number][],
  toleranceDeg = 0.00005,
): boolean {
  if (pointInRing(point, ring)) return true;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    if (distanceToSegment(point, ring[j], ring[i]) <= toleranceDeg) return true;
  }
  return false;
}

/**
 * Like `polygonInsidePolygon` but allows vertices that lie exactly on or
 * very close to the outer boundary. Use this when zones are allowed to share
 * edges with the farm boundary or with each other.
 */
export function polygonOnOrInsidePolygon(
  inner: GeoJSONPolygon,
  outer: GeoJSONPolygon,
): boolean {
  const outerRing = outer.coordinates[0] as [number, number][];
  const innerRing = inner.coordinates[0] as [number, number][];
  return innerRing.every((p) => pointOnOrInsideRing(p, outerRing));
}
