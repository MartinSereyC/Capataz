import { describe, it, expect } from "vitest";
import { mockS2History, mockS1History } from "@/lib/sentinel/statistical";
import type { GeoJSONPolygon } from "@/types";

const polygon: GeoJSONPolygon = {
  type: "Polygon",
  coordinates: [[
    [-70.75, -34.05],
    [-70.74, -34.05],
    [-70.74, -34.04],
    [-70.75, -34.04],
    [-70.75, -34.05],
  ]],
};

describe("mockS2History", () => {
  it("is deterministic", () => {
    const a = mockS2History(polygon, '2025-04-01', '2026-06-01');
    const b = mockS2History(polygon, '2025-04-01', '2026-06-01');
    expect(a).toEqual(b);
  });

  it("produces ~5-day cadence over the window", () => {
    const serie = mockS2History(polygon, '2026-01-01', '2026-03-01');
    expect(serie.length).toBe(12); // 60 días / 5
    expect(serie[0].fecha).toBe('2026-01-01');
  });

  it("includes cloudy passes (>60%) and clear ones", () => {
    const serie = mockS2History(polygon, '2025-04-01', '2026-06-01');
    expect(serie.some((e) => e.nubosidadPct! >= 60)).toBe(true);
    expect(serie.some((e) => e.nubosidadPct! < 60)).toBe(true);
  });

  it("keeps indices in physical range with mock provenance", () => {
    for (const e of mockS2History(polygon, '2025-06-01', '2026-06-01')) {
      expect(e.ndvi).toBeGreaterThanOrEqual(-0.2);
      expect(e.ndvi).toBeLessThanOrEqual(0.95);
      expect(e.ndmi).toBeGreaterThanOrEqual(-0.6);
      expect(e.ndmi).toBeLessThanOrEqual(0.6);
      expect(e.origen).toBe('mock');
    }
  });

  it("shows a seasonal NDVI cycle (summer canopy > winter)", () => {
    const serie = mockS2History(polygon, '2025-06-01', '2026-05-30');
    const verano = serie.filter((e) => e.fecha.startsWith('2026-01'));
    const invierno = serie.filter((e) => e.fecha.startsWith('2025-07'));
    const prom = (xs: (number | null)[]) => {
      const v = xs.filter((x): x is number => x !== null);
      return v.reduce((a, b) => a + b, 0) / v.length;
    };
    expect(prom(verano.map((e) => e.ndvi))).toBeGreaterThan(prom(invierno.map((e) => e.ndvi)));
  });
});

describe("mockS1History", () => {
  it("is deterministic with ~6-day cadence", () => {
    const a = mockS1History(polygon, '2026-01-01', '2026-02-01');
    expect(a).toEqual(mockS1History(polygon, '2026-01-01', '2026-02-01'));
    expect(a.length).toBe(6); // 31 días / 6
  });

  it("VV in agricultural range, VH ~7 dB below", () => {
    for (const e of mockS1History(polygon, '2025-06-01', '2026-06-01')) {
      expect(e.vvDb).toBeGreaterThanOrEqual(-28);
      expect(e.vvDb).toBeLessThanOrEqual(-7);
      expect(e.vhDb).toBeCloseTo(e.vvDb! - 7, 5);
      expect(e.origen).toBe('mock');
    }
  });
});
