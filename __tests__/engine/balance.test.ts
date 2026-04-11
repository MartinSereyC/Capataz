import { describe, it, expect } from "vitest";
import { proyectarDeficit } from "@/lib/engine/balance";
import type {
  ClimaDiario,
  EstadoHidricoPrevio,
  Kc,
  RiegoRegistrado,
} from "@/lib/engine/types";

const climaSeco: ClimaDiario = {
  fecha: "2026-01-15",
  tMin: 15,
  tMax: 35,
  precipitacion: 0,
  latitudDeg: -33,
  diaDelAno: 15,
};

const climaLluvioso: ClimaDiario = {
  fecha: "2026-06-15",
  tMin: 5,
  tMax: 12,
  precipitacion: 25,
  latitudDeg: -33,
  diaDelAno: 166,
};

const kcMedio: Kc = { fase: "crecimiento", valor: 1.0 };

function previo(zonaId: string, deficit: number): EstadoHidricoPrevio {
  return { zonaId, deficit, diasDesdeAlta: 30, erroresReconciliacion: [] };
}

describe("proyectarDeficit", () => {
  it("seco: déficit aumenta", () => {
    const p = previo("z1", 30);
    const r = proyectarDeficit(p, climaSeco, kcMedio, null);
    expect(r.deficit).toBeGreaterThan(30);
    expect(r.precipitacionEfectiva).toBe(0);
    expect(r.etc).toBeGreaterThan(0);
  });

  it("lluvioso: déficit baja (precipitación > etc)", () => {
    const p = previo("z1", 40);
    const r = proyectarDeficit(p, climaLluvioso, kcMedio, null);
    expect(r.deficit).toBeLessThan(40);
    expect(r.precipitacionEfectiva).toBeGreaterThan(0);
  });

  it("post-riego: riego grande lleva déficit a 0 (clamp)", () => {
    const p = previo("z1", 50);
    const riego: RiegoRegistrado = { zonaId: "z1", mmAplicados: 80 };
    const r = proyectarDeficit(p, climaSeco, kcMedio, riego);
    expect(r.deficit).toBe(0);
  });

  it("heterogéneo: dos zonas con kc distinto divergen", () => {
    const p1 = previo("z1", 30);
    const p2 = previo("z2", 30);
    const kcBajo: Kc = { fase: "brotacion", valor: 0.4 };
    const kcAlto: Kc = { fase: "floracion", valor: 1.15 };
    const r1 = proyectarDeficit(p1, climaSeco, kcBajo, null);
    const r2 = proyectarDeficit(p2, climaSeco, kcAlto, null);
    expect(r2.deficit).toBeGreaterThan(r1.deficit);
  });

  it("clampa déficit al techo 100", () => {
    const p = previo("z1", 99);
    const r = proyectarDeficit(p, climaSeco, { fase: "floracion", valor: 1.2 }, null);
    expect(r.deficit).toBeLessThanOrEqual(100);
  });
});
