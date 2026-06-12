import { describe, it, expect } from "vitest";
import { pasoDiario, calcularKs, precipitacionEfectiva, type EstadoBalance, type EntradaDia } from "@/lib/balance/paso";

const estadoBase: EstadoBalance = { agotamientoMm: 20, tawMm: 126, rawMm: 63 };

function dia(overrides: Partial<EntradaDia> = {}): EntradaDia {
  return {
    fecha: '2026-01-15',
    et0Mm: 5,
    kc: 0.8,
    precipMm: 0,
    riegoMm: 0,
    riegoAsumido: false,
    ...overrides,
  };
}

describe("precipitacionEfectiva", () => {
  it("ignores rain under 5 mm and takes 80% above", () => {
    expect(precipitacionEfectiva(3)).toBe(0);
    expect(precipitacionEfectiva(10)).toBeCloseTo(8, 5);
  });
});

describe("calcularKs", () => {
  it("is 1 while depletion is within RAW", () => {
    expect(calcularKs(0, 126, 63)).toBe(1);
    expect(calcularKs(63, 126, 63)).toBe(1);
  });

  it("decays linearly between RAW and TAW (FAO-56 eq. 84)", () => {
    // halfway between RAW=63 and TAW=126 → Ks = 0.5
    expect(calcularKs(94.5, 126, 63)).toBeCloseTo(0.5, 5);
    expect(calcularKs(126, 126, 63)).toBe(0);
  });
});

describe("pasoDiario", () => {
  it("accumulates depletion by ETc on a dry day", () => {
    const r = pasoDiario(estadoBase, dia());
    // ETc = 1 * 0.8 * 5 = 4 mm → Dr = 24
    expect(r.etcMm).toBeCloseTo(4, 5);
    expect(r.agotamientoMm).toBeCloseTo(24, 5);
    expect(r.deficitPct).toBeCloseTo((24 / 126) * 100, 3);
  });

  it("reduces depletion with effective rain", () => {
    const r = pasoDiario(estadoBase, dia({ precipMm: 20 }));
    // Dr = 20 + 4 - 16 = 8
    expect(r.precipEfectivaMm).toBeCloseTo(16, 5);
    expect(r.agotamientoMm).toBeCloseTo(8, 5);
  });

  it("reduces depletion with logged irrigation", () => {
    const r = pasoDiario(estadoBase, dia({ riegoMm: 15 }));
    expect(r.agotamientoMm).toBeCloseTo(9, 5);
  });

  it("clamps depletion at 0 (cannot store above field capacity)", () => {
    const r = pasoDiario(estadoBase, dia({ precipMm: 100 }));
    expect(r.agotamientoMm).toBe(0);
  });

  it("clamps depletion at TAW", () => {
    const seco: EstadoBalance = { agotamientoMm: 125, tawMm: 126, rawMm: 63 };
    const r = pasoDiario(seco, dia({ et0Mm: 10 }));
    expect(r.agotamientoMm).toBeLessThanOrEqual(126);
  });

  it("applies stress coefficient when past RAW (real ET drops)", () => {
    const estresado: EstadoBalance = { agotamientoMm: 94.5, tawMm: 126, rawMm: 63 };
    const r = pasoDiario(estresado, dia());
    expect(r.ks).toBeCloseTo(0.5, 5);
    expect(r.etcMm).toBeCloseTo(2, 5); // half of unstressed 4 mm
  });

  it("propagates riegoAsumido flag", () => {
    expect(pasoDiario(estadoBase, dia({ riegoAsumido: true })).riegoAsumido).toBe(true);
  });
});
