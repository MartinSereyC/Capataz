import { describe, it, expect } from "vitest";
import { ejecutarMotor } from "@/lib/engine";
import type {
  ClimaDiario,
  EstadoHidricoPrevio,
  Kc,
  SueloZona,
} from "@/lib/engine/types";

// Launch-signal #3: el contrato público jamás expone volumen.
const CAMPOS_PROHIBIDOS = ["litros", "mm", "volumen", "caudal", "m3"];

describe("contrato público sin volumen", () => {
  const zonas: SueloZona[] = [
    {
      id: "z1",
      umbralRojo: 60,
      umbralAmarillo: 40,
      prioridad: "alta",
      demandaEstimada: 30,
    },
    {
      id: "z2",
      umbralRojo: 60,
      umbralAmarillo: 40,
      prioridad: "baja",
      demandaEstimada: 30,
    },
  ];
  const previos: EstadoHidricoPrevio[] = [
    { zonaId: "z1", deficit: 65, diasDesdeAlta: 30, erroresReconciliacion: [0.1] },
    { zonaId: "z2", deficit: 65, diasDesdeAlta: 30, erroresReconciliacion: [0.1] },
  ];
  const clima: ClimaDiario = {
    fecha: "2026-01-15",
    tMin: 15,
    tMax: 35,
    precipitacion: 0,
    latitudDeg: -33,
    diaDelAno: 15,
  };
  const kc: Kc = { fase: "crecimiento", valor: 1.0 };

  it("Recomendacion nunca contiene campos de volumen", () => {
    const recs = ejecutarMotor({
      zonas,
      previos,
      clima,
      kcPorZona: { z1: kc, z2: kc },
      riegos: [],
      capacidadFuente: 40,
    });
    expect(recs.length).toBe(2);
    for (const rec of recs) {
      const keys = Object.keys(rec);
      for (const prohibido of CAMPOS_PROHIBIDOS) {
        expect(keys).not.toContain(prohibido);
      }
    }
  });

  it("devuelve timing válido y al menos una zona baja queda postergada bajo escasez", () => {
    const recs = ejecutarMotor({
      zonas,
      previos,
      clima,
      kcPorZona: { z1: kc, z2: kc },
      riegos: [],
      capacidadFuente: 40,
    });
    const timingsValidos = new Set(["hoy", "mañana", "3-4 días", "no urgente"]);
    for (const r of recs) {
      expect(timingsValidos.has(r.timing)).toBe(true);
    }
    const z2 = recs.find((r) => r.zonaId === "z2")!;
    expect(z2.postergada).toBe(true);
  });
});
