import { describe, it, expect } from "vitest";
import { calcularEt0Hargreaves } from "@/lib/engine/et0";

describe("calcularEt0Hargreaves", () => {
  it("día caluroso (tmin 15, tmax 35) en latitud chilena central, enero", () => {
    const et0 = calcularEt0Hargreaves(15, 35, -33, 15);
    // Verano austral, día largo, amplitud térmica grande => ET0 alta (>5 mm/día).
    expect(et0).toBeGreaterThan(5);
    expect(et0).toBeLessThan(12);
  });

  it("día frío (tmin 5, tmax 15) en latitud chilena central, junio", () => {
    const et0 = calcularEt0Hargreaves(5, 15, -33, 165);
    // Invierno, día corto => ET0 baja.
    expect(et0).toBeGreaterThan(0);
    expect(et0).toBeLessThan(3);
  });

  it("día típico Chile central enero (tmin 12, tmax 28, lat -33, doy 15)", () => {
    const et0 = calcularEt0Hargreaves(12, 28, -33, 15);
    expect(et0).toBeGreaterThan(4);
    expect(et0).toBeLessThan(10);
  });

  it("tmax < tmin lanza error", () => {
    expect(() => calcularEt0Hargreaves(20, 10, -33, 15)).toThrow();
  });
});
