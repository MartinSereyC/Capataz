import { describe, it, expect } from "vitest";
import { mockClimaRange } from "@/lib/clima/mock";

const LAT = -34.0, LON = -70.7;

describe("mockClimaRange", () => {
  it("is deterministic: same inputs produce identical series", () => {
    const a = mockClimaRange(LAT, LON, '2025-04-01', '2026-06-01');
    const b = mockClimaRange(LAT, LON, '2025-04-01', '2026-06-01');
    expect(a).toEqual(b);
  });

  it("covers every day of the range inclusive", () => {
    const serie = mockClimaRange(LAT, LON, '2026-01-01', '2026-01-31');
    expect(serie).toHaveLength(31);
    expect(serie[0].fecha).toBe('2026-01-01');
    expect(serie[30].fecha).toBe('2026-01-31');
  });

  it("follows a southern-hemisphere seasonal cycle", () => {
    const año = mockClimaRange(LAT, LON, '2025-07-01', '2026-06-30');
    const enero = año.filter((d) => d.fecha.startsWith('2026-01'));
    const julio = año.filter((d) => d.fecha.startsWith('2025-07'));
    const prom = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    // summer (January) hotter than winter (July)
    expect(prom(enero.map((d) => d.tMax))).toBeGreaterThan(prom(julio.map((d) => d.tMax)) + 5);
    // winter rains dominate (Mediterranean climate)
    const lluviaInvierno = julio.reduce((s, d) => s + d.precipitacionMm, 0);
    const lluviaVerano = enero.reduce((s, d) => s + d.precipitacionMm, 0);
    expect(lluviaInvierno).toBeGreaterThan(lluviaVerano);
  });

  it("produces physically sane values with ET0 and mock provenance", () => {
    const serie = mockClimaRange(LAT, LON, '2026-01-01', '2026-03-01');
    for (const d of serie) {
      expect(d.tMax).toBeGreaterThan(d.tMin);
      expect(d.precipitacionMm).toBeGreaterThanOrEqual(0);
      expect(d.et0Mm).toBeGreaterThan(0);
      expect(d.origen).toBe('mock');
    }
  });

  it("varies with location (seeded from lat/lng)", () => {
    const a = mockClimaRange(-34.0, -70.7, '2026-01-01', '2026-01-15');
    const b = mockClimaRange(-32.8, -71.2, '2026-01-01', '2026-01-15');
    expect(a.map((d) => d.tMax)).not.toEqual(b.map((d) => d.tMax));
  });
});
