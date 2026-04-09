import { describe, it, expect } from "vitest";
import { utmToWGS84, utmPairsToWGS84 } from "@/lib/geo/utm-converter";

describe("utmToWGS84", () => {
  // Known point: Santiago, Chile — approximately -33.45°, -70.65°
  // Zone 19S: Easting ~344 600, Northing ~6 296 800
  it("converts a known Santiago point from Zone 19S to WGS84", () => {
    const { lng, lat } = utmToWGS84(344600, 6296800, 19);
    expect(lat).toBeCloseTo(-33.45, 1);
    expect(lng).toBeCloseTo(-70.65, 1);
  });

  // Known point in Zone 18S
  // Zone 18S central meridian = 75°W, easting 500000 = central meridian
  // Northing 7067000 ≈ lat -26.5° (Atacama latitude)
  // E=500000, N=7067000, Zone 18S → lng ≈ -75°, lat ≈ -26.5°
  it("converts a known Zone 18S point to WGS84", () => {
    const { lng, lat } = utmToWGS84(500000, 7067000, 18);
    // Central meridian of Zone 18S is 75°W, so easting 500000 → lng ≈ -75
    expect(lng).toBeCloseTo(-75, 0);
    expect(lat).toBeCloseTo(-26.5, 1);
  });

  // Same Easting/Northing in different zones MUST produce different longitudes
  // Zone 18 spans ~72°W–66°W; Zone 19 spans ~78°W–72°W
  // Same easting/northing numbers → very different geographic coordinates
  it("produces different lng for same numbers in Zone 18S vs 19S", () => {
    const result18 = utmToWGS84(500000, 6300000, 18);
    const result19 = utmToWGS84(500000, 6300000, 19);
    // Zone 18 central meridian is 75°W, Zone 19 is 69°W — same easting 500000
    // means different real-world longitudes (~6 degrees apart)
    expect(Math.abs(result18.lng - result19.lng)).toBeGreaterThan(5);
  });
});

describe("utmPairsToWGS84", () => {
  it("converts an array of UTM pairs to WGS84 [lng, lat] pairs", () => {
    const pairs: [number, number][] = [
      [344600, 6296800],
      [344700, 6296900],
      [344800, 6296700],
    ];
    const result = utmPairsToWGS84(pairs, 19);
    expect(result).toHaveLength(3);
    result.forEach(([lng, lat]) => {
      expect(typeof lng).toBe("number");
      expect(typeof lat).toBe("number");
      // All should be in Chile's ballpark
      expect(lat).toBeLessThan(-30);
      expect(lng).toBeLessThan(-65);
    });
  });
});
