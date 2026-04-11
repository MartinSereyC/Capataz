/**
 * Validation helpers for the predio onboarding flow.
 * Pure functions — no DB, no side effects.
 */

import type { GeoJSONPolygon } from "@/types";

/**
 * Check whether a point [lng, lat] is inside a simple GeoJSON polygon ring
 * using the ray-casting algorithm.
 */
function puntoDentroDeAnillo(
  lng: number,
  lat: number,
  ring: number[][]
): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Squared distance from point (px,py) to segment (ax,ay)-(bx,by).
 */
function distanciaCuadradaPuntoSegmento(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lenSq;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  const ex = px - cx;
  const ey = py - cy;
  return ex * ex + ey * ey;
}

function puntoSobreAnillo(
  lng: number,
  lat: number,
  ring: number[][],
  epsilon: number
): boolean {
  const epsSq = epsilon * epsilon;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    if (
      distanciaCuadradaPuntoSegmento(
        lng,
        lat,
        ring[j][0],
        ring[j][1],
        ring[i][0],
        ring[i][1]
      ) <= epsSq
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Returns true when every vertex of zonaGeom lies inside predioGeom OR
 * sits on (within epsilon of) its border. Geoman snaps zone vertices to
 * the predio edge, so a strict "inside" check would reject shared borders.
 * Epsilon ≈ 1e-5 degrees ≈ ~1 meter, tolerating snap/float drift.
 */
export function zonaDentroDePredio(
  zonaGeom: GeoJSONPolygon,
  predioGeom: GeoJSONPolygon
): boolean {
  const predioRing = predioGeom.coordinates[0];
  const zonaRing = zonaGeom.coordinates[0];
  const open = zonaRing[0][0] === zonaRing[zonaRing.length - 1][0] &&
    zonaRing[0][1] === zonaRing[zonaRing.length - 1][1]
    ? zonaRing.slice(0, -1)
    : zonaRing;
  const EPS = 1e-5;
  return open.every(
    ([lng, lat]) =>
      puntoDentroDeAnillo(lng, lat, predioRing) ||
      puntoSobreAnillo(lng, lat, predioRing, EPS)
  );
}

/**
 * Check if two line segments (p1→p2) and (p3→p4) intersect.
 */
function segmentosSeIntersectan(
  p1: number[],
  p2: number[],
  p3: number[],
  p4: number[]
): boolean {
  const d1x = p2[0] - p1[0];
  const d1y = p2[1] - p1[1];
  const d2x = p4[0] - p3[0];
  const d2y = p4[1] - p3[1];
  const denom = d1x * d2y - d1y * d2x;
  if (denom === 0) return false; // parallel
  const dx = p3[0] - p1[0];
  const dy = p3[1] - p1[1];
  const t = (dx * d2y - dy * d2x) / denom;
  const u = (dx * d1y - dy * d1x) / denom;
  return t > 0 && t < 1 && u > 0 && u < 1;
}

/**
 * Returns true when no two zones have overlapping areas.
 * Detects overlaps by:
 *   1. Checking whether any vertex of zone A is inside zone B (or vice versa).
 *   2. Checking whether any edges of the two rings cross each other.
 */
export function sinTraslapesEntreZonas(zonas: GeoJSONPolygon[]): boolean {
  for (let i = 0; i < zonas.length; i++) {
    for (let j = i + 1; j < zonas.length; j++) {
      const ringA = zonas[i].coordinates[0];
      const ringB = zonas[j].coordinates[0];

      // 1. Any vertex of A inside B?
      for (const pt of ringA) {
        if (puntoDentroDeAnillo(pt[0], pt[1], ringB)) return false;
      }
      // 2. Any vertex of B inside A?
      for (const pt of ringB) {
        if (puntoDentroDeAnillo(pt[0], pt[1], ringA)) return false;
      }
      // 3. Any edges cross?
      for (let a = 0; a < ringA.length - 1; a++) {
        for (let b = 0; b < ringB.length - 1; b++) {
          if (
            segmentosSeIntersectan(ringA[a], ringA[a + 1], ringB[b], ringB[b + 1])
          ) {
            return false;
          }
        }
      }
    }
  }
  return true;
}
