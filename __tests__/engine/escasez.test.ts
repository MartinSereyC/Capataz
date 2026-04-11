import { describe, it, expect } from "vitest";
import { arbitrarEscasez } from "@/lib/engine/escasez";

describe("arbitrarEscasez", () => {
  it("2 zonas en rojo que caben en la fuente => ninguna postergada", () => {
    const res = arbitrarEscasez(
      [
        { id: "a", prioridad: "alta", semaforo: "rojo", demandaEstimada: 30 },
        { id: "b", prioridad: "media", semaforo: "rojo", demandaEstimada: 30 },
      ],
      100
    );
    expect(res.every((r) => !r.postergada)).toBe(true);
  });

  it("3 zonas en rojo que no caben => la de menor prioridad se posterga", () => {
    const res = arbitrarEscasez(
      [
        { id: "a", prioridad: "alta", semaforo: "rojo", demandaEstimada: 40 },
        { id: "b", prioridad: "media", semaforo: "rojo", demandaEstimada: 40 },
        { id: "c", prioridad: "baja", semaforo: "rojo", demandaEstimada: 40 },
      ],
      100
    );
    const byId = Object.fromEntries(res.map((r) => [r.id, r]));
    expect(byId.a.postergada).toBe(false);
    expect(byId.b.postergada).toBe(false);
    expect(byId.c.postergada).toBe(true);
  });

  it("4 zonas todas rojo => solo alta+media reciben agua", () => {
    const res = arbitrarEscasez(
      [
        { id: "a1", prioridad: "alta", semaforo: "rojo", demandaEstimada: 30 },
        { id: "a2", prioridad: "alta", semaforo: "rojo", demandaEstimada: 30 },
        { id: "m", prioridad: "media", semaforo: "rojo", demandaEstimada: 30 },
        { id: "b", prioridad: "baja", semaforo: "rojo", demandaEstimada: 30 },
      ],
      90
    );
    const byId = Object.fromEntries(res.map((r) => [r.id, r]));
    expect(byId.a1.postergada).toBe(false);
    expect(byId.a2.postergada).toBe(false);
    expect(byId.m.postergada).toBe(false);
    expect(byId.b.postergada).toBe(true);
  });

  it("zonas no-rojas no compiten por la fuente", () => {
    const res = arbitrarEscasez(
      [
        { id: "v", prioridad: "alta", semaforo: "verde", demandaEstimada: 100 },
        { id: "r", prioridad: "baja", semaforo: "rojo", demandaEstimada: 20 },
      ],
      50
    );
    const byId = Object.fromEntries(res.map((r) => [r.id, r]));
    expect(byId.v.postergada).toBe(false);
    expect(byId.r.postergada).toBe(false);
  });
});
