import { describe, it, expect } from "vitest";
import {
  isPointInChile,
  validateCoordinates,
  validateBbox,
} from "@/lib/geo/validation";
import type { BboxGeoJSON } from "@/types";

describe("isPointInChile", () => {
  it("returns true for Santiago (inside Chile)", () => {
    expect(isPointInChile(-70.6693, -33.4489)).toBe(true);
  });

  it("returns true for Punta Arenas (southern Chile)", () => {
    expect(isPointInChile(-70.9167, -53.15)).toBe(true);
  });

  it("returns true for Arica (northern Chile)", () => {
    expect(isPointInChile(-70.3126, -18.4783)).toBe(true);
  });

  it("returns false for Buenos Aires (Argentina)", () => {
    expect(isPointInChile(-58.3816, -34.6037)).toBe(false);
  });

  it("returns false for Lima (Peru - north of Chile bounds)", () => {
    expect(isPointInChile(-77.0428, -12.0464)).toBe(false);
  });

  it("returns false for point in Atlantic Ocean", () => {
    expect(isPointInChile(-30.0, -33.0)).toBe(false);
  });
});

describe("validateCoordinates", () => {
  const validChileCoords: [number, number][] = [
    [-70.65, -33.45],
    [-70.64, -33.45],
    [-70.64, -33.46],
  ];

  it("validates a set of coordinates inside Chile", () => {
    const result = validateCoordinates(validChileCoords);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects fewer than 3 points", () => {
    const result = validateCoordinates([[-70.65, -33.45], [-70.64, -33.45]]);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("rejects coordinates outside Chile", () => {
    const outside: [number, number][] = [
      [-58.38, -34.60], // Buenos Aires
      [-58.37, -34.61],
      [-58.36, -34.62],
    ];
    const result = validateCoordinates(outside);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("fuera"))).toBe(true);
  });

  it("detects duplicate consecutive points", () => {
    const withDups: [number, number][] = [
      [-70.65, -33.45],
      [-70.65, -33.45], // duplicate
      [-70.64, -33.46],
    ];
    const result = validateCoordinates(withDups);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("duplicado"))).toBe(true);
  });
});

describe("validateBbox", () => {
  it("validates a bbox within Chile", () => {
    const bbox: BboxGeoJSON = [-70.65, -33.46, -70.64, -33.45];
    const result = validateBbox(bbox);
    expect(result.valid).toBe(true);
  });

  it("rejects a bbox outside Chile", () => {
    const bbox: BboxGeoJSON = [-58.40, -34.65, -58.30, -34.55]; // Argentina
    const result = validateBbox(bbox);
    expect(result.valid).toBe(false);
  });

  it("rejects a bbox with invalid dimensions (min >= max)", () => {
    const bbox: BboxGeoJSON = [-70.64, -33.45, -70.65, -33.46]; // inverted
    const result = validateBbox(bbox);
    expect(result.valid).toBe(false);
  });
});
