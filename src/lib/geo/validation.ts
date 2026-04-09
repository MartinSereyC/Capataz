/**
 * Geographic validation for Chilean land deeds.
 * Validates coordinates fall within Chile's bounding box and polygon sanity checks.
 */

import { CHILE_BOUNDS } from "@/lib/constants";
import type { BboxGeoJSON } from "@/types";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Check if a single WGS84 point falls within Chile's bounding box.
 * Chile bounds: lat -56 to -17, lng -76 to -66
 */
export function isPointInChile(lng: number, lat: number): boolean {
  return (
    lat >= CHILE_BOUNDS.minLat &&
    lat <= CHILE_BOUNDS.maxLat &&
    lng >= CHILE_BOUNDS.minLng &&
    lng <= CHILE_BOUNDS.maxLng
  );
}

/**
 * Validate an array of [lng, lat] coordinate pairs for use in Chile.
 * Checks:
 *   - At least 3 points
 *   - All points within Chile bounding box
 *   - No duplicate consecutive points
 */
export function validateCoordinates(
  coordinates: [number, number][]
): ValidationResult {
  const errors: string[] = [];

  if (coordinates.length < 3) {
    errors.push(
      `Se necesitan al menos 3 puntos para definir un terreno (recibidos: ${coordinates.length})`
    );
    return { valid: false, errors };
  }

  const outsideChile = coordinates.filter(
    ([lng, lat]) => !isPointInChile(lng, lat)
  );
  if (outsideChile.length > 0) {
    errors.push(
      `${outsideChile.length} punto(s) están fuera de los límites de Chile`
    );
  }

  // Check for duplicate consecutive points (degenerate polygon)
  let duplicateCount = 0;
  for (let i = 1; i < coordinates.length; i++) {
    const [lng1, lat1] = coordinates[i - 1];
    const [lng2, lat2] = coordinates[i];
    if (lng1 === lng2 && lat1 === lat2) {
      duplicateCount++;
    }
  }
  if (duplicateCount > 0) {
    errors.push(`Se detectaron ${duplicateCount} punto(s) duplicado(s) consecutivos`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a GeoJSON bounding box falls within Chile.
 */
export function validateBbox(bbox: BboxGeoJSON): ValidationResult {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const errors: string[] = [];

  if (
    !isPointInChile(minLng, minLat) ||
    !isPointInChile(maxLng, maxLat)
  ) {
    errors.push("El bounding box está fuera de los límites de Chile");
  }

  if (minLng >= maxLng || minLat >= maxLat) {
    errors.push("El bounding box tiene dimensiones inválidas");
  }

  return { valid: errors.length === 0, errors };
}
