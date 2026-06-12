import { describe, it, expect } from "vitest";
import { anclarConSatelite, deficitSatelital, ndmiToDeficit, sarVvToDeficit } from "@/lib/balance/asimilacion";
import type { EstadoBalance } from "@/lib/balance/paso";

const estado: EstadoBalance = { agotamientoMm: 25.2, tawMm: 126, rawMm: 63 }; // deficit 20%

describe("deficitSatelital", () => {
  it("maps NDMI to deficit using fusion calibration", () => {
    expect(ndmiToDeficit(0.4)).toBe(10);
    expect(ndmiToDeficit(-0.5)).toBe(80);
    expect(deficitSatelital({ sensor: 's2', ndmi: 0.2 })).toEqual({ deficitPct: 25, fuente: 's2' });
  });

  it("maps SAR VV to deficit", () => {
    expect(sarVvToDeficit(-8)).toBe(15);
    expect(deficitSatelital({ sensor: 's1', vvDb: -17 })).toEqual({ deficitPct: 60, fuente: 's1' });
  });

  it("rejects cloudy S2 observations", () => {
    expect(deficitSatelital({ sensor: 's2', ndmi: 0.2, nubosidadPct: 75 })).toBeNull();
  });

  it("rejects observations with missing values", () => {
    expect(deficitSatelital({ sensor: 's2', ndmi: null })).toBeNull();
    expect(deficitSatelital({ sensor: 's1', vvDb: null })).toBeNull();
  });

  it("applies ndmiOffset calibration before mapping", () => {
    // ndmi 0.08 → bucket 45; with +0.05 offset → 0.13 → bucket 25
    expect(deficitSatelital({ sensor: 's2', ndmi: 0.08 })!.deficitPct).toBe(45);
    expect(deficitSatelital({ sensor: 's2', ndmi: 0.08 }, 0.05)!.deficitPct).toBe(25);
  });
});

describe("anclarConSatelite", () => {
  it("nudges Dr toward the S2-implied value with weight 0.5", () => {
    // sat deficit 45% → Dr_sat = 56.7; Dr' = 0.5*25.2 + 0.5*56.7 = 40.95
    const r = anclarConSatelite(estado, { sensor: 's2', ndmi: 0.0, nubosidadPct: 10 });
    expect(r).not.toBeNull();
    expect(r!.agotamientoMm).toBeCloseTo(40.95, 2);
    expect(r!.ajusteMm).toBeCloseTo(15.75, 2);
    expect(r!.fuente).toBe('s2');
  });

  it("uses a weaker weight (0.25) for SAR", () => {
    // sat deficit 60% → Dr_sat = 75.6; Dr' = 0.75*25.2 + 0.25*75.6 = 37.8
    const r = anclarConSatelite(estado, { sensor: 's1', vvDb: -17 });
    expect(r!.agotamientoMm).toBeCloseTo(37.8, 2);
    expect(r!.fuente).toBe('s1');
  });

  it("returns null for unusable observations", () => {
    expect(anclarConSatelite(estado, { sensor: 's2', ndmi: 0.2, nubosidadPct: 90 })).toBeNull();
  });

  it("keeps result within [0, TAW]", () => {
    const casiSeco: EstadoBalance = { agotamientoMm: 120, tawMm: 126, rawMm: 63 };
    const r = anclarConSatelite(casiSeco, { sensor: 's2', ndmi: 0.5, nubosidadPct: 0 });
    expect(r!.agotamientoMm).toBeGreaterThanOrEqual(0);
    expect(r!.agotamientoMm).toBeLessThanOrEqual(126);
  });
});
