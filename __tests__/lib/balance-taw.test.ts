import { describe, it, expect } from "vitest";
import { calcularTawMm, calcularRawMm } from "@/lib/balance/taw";
import { parametrosCultivo } from "@/lib/balance/cultivos";
import type { SueloEstimado } from "@/lib/suelo/types";

const sueloFranco: SueloEstimado = {
  lat: -34, lon: -70.7,
  textura: 'franco',
  capacidadCampoPct: 28,
  puntoMarchitezPct: 15.4,
  origen: 'mock',
};

describe("calcularTawMm", () => {
  it("computes TAW = (FC-WP)/100 * Rd * 1000 (FAO-56 eq. 82)", () => {
    // (28 - 15.4)/100 * 1.0 * 1000 = 126 mm
    expect(calcularTawMm(sueloFranco, 1.0)).toBeCloseTo(126, 1);
  });

  it("scales linearly with root depth", () => {
    expect(calcularTawMm(sueloFranco, 0.5)).toBeCloseTo(63, 1);
    expect(calcularTawMm(sueloFranco, 2.0)).toBeCloseTo(252, 1);
  });

  it("clamps to a positive floor for degenerate soils", () => {
    const degenerate: SueloEstimado = { ...sueloFranco, capacidadCampoPct: 10, puntoMarchitezPct: 10 };
    expect(calcularTawMm(degenerate, 1.0)).toBeGreaterThan(0);
  });

  it("sandy soil holds less water than clay at same depth", () => {
    const arenoso: SueloEstimado = { ...sueloFranco, textura: 'arenoso', capacidadCampoPct: 24, puntoMarchitezPct: 13.2 };
    const arcilloso: SueloEstimado = { ...sueloFranco, textura: 'arcilloso', capacidadCampoPct: 40, puntoMarchitezPct: 22 };
    expect(calcularTawMm(arenoso, 1.0)).toBeLessThan(calcularTawMm(arcilloso, 1.0));
  });
});

describe("calcularRawMm", () => {
  it("RAW = p * TAW (FAO-56 eq. 83)", () => {
    expect(calcularRawMm(126, 0.5)).toBeCloseTo(63, 1);
    expect(calcularRawMm(126, 0.35)).toBeCloseTo(44.1, 1);
  });
});

describe("parametrosCultivo", () => {
  it("returns FAO-56 table 22 parameters for known crops", () => {
    const palto = parametrosCultivo('palto_hass');
    expect(palto.profundidadRaizM).toBeGreaterThan(0);
    expect(palto.fraccionAgotamiento).toBeGreaterThan(0);
    expect(palto.fraccionAgotamiento).toBeLessThan(1);
  });

  it("uva_mesa is more stress-sensitive (lower p) than olivo", () => {
    expect(parametrosCultivo('uva_mesa').fraccionAgotamiento)
      .toBeLessThan(parametrosCultivo('olivo').fraccionAgotamiento);
  });

  it("falls back to defaults for null", () => {
    const d = parametrosCultivo(null);
    expect(d.profundidadRaizM).toBe(1.0);
    expect(d.fraccionAgotamiento).toBe(0.5);
  });
});
