import { describe, it, expect } from "vitest";
import {
  zonaDentroDePredio,
  sinTraslapesEntreZonas,
} from "@/lib/onboarding/validador";
import type { GeoJSONPolygon } from "@/types";

// Helper: build a square polygon from [minLng, minLat, maxLng, maxLat]
function square(
  minLng: number,
  minLat: number,
  maxLng: number,
  maxLat: number
): GeoJSONPolygon {
  return {
    type: "Polygon",
    coordinates: [
      [
        [minLng, minLat],
        [maxLng, minLat],
        [maxLng, maxLat],
        [minLng, maxLat],
        [minLng, minLat], // closed
      ],
    ],
  };
}

// Predio: large square
const predio = square(0, 0, 10, 10);

describe("zonaDentroDePredio", () => {
  it("returns true when zone is fully inside the predio", () => {
    const zona = square(2, 2, 5, 5);
    expect(zonaDentroDePredio(zona, predio)).toBe(true);
  });

  it("returns false when zone is fully outside the predio", () => {
    const zona = square(20, 20, 25, 25);
    expect(zonaDentroDePredio(zona, predio)).toBe(false);
  });
});

describe("sinTraslapesEntreZonas", () => {
  it("returns true when zones do not overlap (adjacent)", () => {
    const zonaA = square(0, 0, 4, 10);
    const zonaB = square(6, 0, 10, 10); // gap between 4 and 6
    expect(sinTraslapesEntreZonas([zonaA, zonaB])).toBe(true);
  });

  it("returns false when zones overlap", () => {
    const zonaA = square(0, 0, 6, 10);
    const zonaB = square(4, 0, 10, 10); // overlaps 4-6
    expect(sinTraslapesEntreZonas([zonaA, zonaB])).toBe(false);
  });
});
