import { describe, it, expect } from "vitest";
import { buildPolygon, toBboxLeaflet } from "@/lib/geo/polygon-builder";
import type { BboxGeoJSON } from "@/types";

describe("buildPolygon", () => {
  const validCoords: [number, number][] = [
    [-70.65, -33.45],
    [-70.64, -33.45],
    [-70.64, -33.46],
    [-70.65, -33.46],
  ];

  it("builds a valid GeoJSON polygon from 4 points", () => {
    const { polygon } = buildPolygon(validCoords);
    expect(polygon.type).toBe("Polygon");
    expect(polygon.coordinates).toHaveLength(1);
    // Ring is closed: first == last
    const ring = polygon.coordinates[0];
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    // Should have 5 points (4 input + closing point)
    expect(ring).toHaveLength(5);
  });

  it("returns bboxGeoJSON in [minLng, minLat, maxLng, maxLat] format", () => {
    const { bboxGeoJSON } = buildPolygon(validCoords);
    const [minLng, minLat, maxLng, maxLat] = bboxGeoJSON;
    expect(minLng).toBeLessThan(maxLng);
    expect(minLat).toBeLessThan(maxLat);
    // minLng should be the smallest longitude
    expect(minLng).toBe(-70.65);
    expect(maxLng).toBe(-70.64);
    expect(minLat).toBe(-33.46);
    expect(maxLat).toBe(-33.45);
  });

  it("bbox follows GeoJSON standard [minLng, minLat, maxLng, maxLat]", () => {
    const { bboxGeoJSON } = buildPolygon(validCoords);
    // GeoJSON bbox: [minLng, minLat, maxLng, maxLat]
    // Index 0 and 2 are longitudes, index 1 and 3 are latitudes
    expect(bboxGeoJSON[0]).toBeLessThan(bboxGeoJSON[2]); // minLng < maxLng
    expect(bboxGeoJSON[1]).toBeLessThan(bboxGeoJSON[3]); // minLat < maxLat
  });

  it("calculates a positive area in hectares", () => {
    const { area_hectares } = buildPolygon(validCoords);
    expect(area_hectares).toBeGreaterThan(0);
  });

  it("throws an error for fewer than 3 points", () => {
    expect(() => buildPolygon([[-70.65, -33.45], [-70.64, -33.45]])).toThrow();
  });

  it("automatically closes an open ring", () => {
    // Input 4 points, not closed
    const { polygon } = buildPolygon(validCoords);
    const ring = polygon.coordinates[0];
    expect(ring[0][0]).toBe(ring[ring.length - 1][0]);
    expect(ring[0][1]).toBe(ring[ring.length - 1][1]);
  });

  it("does not double-close an already-closed ring", () => {
    const closed: [number, number][] = [
      ...validCoords,
      validCoords[0], // already closed
    ];
    const { polygon } = buildPolygon(closed);
    const ring = polygon.coordinates[0];
    // Should still have exactly 5 points (4 unique + 1 closing)
    expect(ring).toHaveLength(5);
  });
});

describe("toBboxLeaflet", () => {
  it("converts GeoJSON bbox to Leaflet LatLngBounds format", () => {
    const bboxGeoJSON: BboxGeoJSON = [-70.65, -33.46, -70.64, -33.45];
    const leaflet = toBboxLeaflet(bboxGeoJSON);
    // Leaflet: [[minLat, minLng], [maxLat, maxLng]]
    expect(leaflet[0][0]).toBe(-33.46); // minLat
    expect(leaflet[0][1]).toBe(-70.65); // minLng
    expect(leaflet[1][0]).toBe(-33.45); // maxLat
    expect(leaflet[1][1]).toBe(-70.64); // maxLng
  });
});
