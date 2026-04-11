import { describe, it, expect } from "vitest";
import { traducirASemaforo } from "@/lib/engine/semaforo";

const umbrales = { rojo: 60, amarillo: 40 };

describe("traducirASemaforo", () => {
  it("deficit muy bajo => verde / no urgente", () => {
    expect(traducirASemaforo(10, umbrales)).toEqual({
      semaforo: "verde",
      timing: "no urgente",
    });
  });

  it("deficit 39 justo bajo amarillo => verde", () => {
    expect(traducirASemaforo(39, umbrales).semaforo).toBe("verde");
  });

  it("deficit igual a amarillo => amarillo / 3-4 días", () => {
    expect(traducirASemaforo(40, umbrales)).toEqual({
      semaforo: "amarillo",
      timing: "3-4 días",
    });
  });

  it("deficit 54 (rojo-6) => amarillo", () => {
    expect(traducirASemaforo(54, umbrales).semaforo).toBe("amarillo");
  });

  it("deficit 55 (rojo-5) => rojo / mañana", () => {
    expect(traducirASemaforo(55, umbrales)).toEqual({
      semaforo: "rojo",
      timing: "mañana",
    });
  });

  it("deficit igual al rojo => rojo / hoy", () => {
    expect(traducirASemaforo(60, umbrales)).toEqual({
      semaforo: "rojo",
      timing: "hoy",
    });
  });

  it("deficit muy alto => rojo / hoy", () => {
    expect(traducirASemaforo(95, umbrales).timing).toBe("hoy");
  });
});
