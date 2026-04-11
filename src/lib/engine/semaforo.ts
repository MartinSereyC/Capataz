import type { Semaforo, Timing } from "./types";

export function traducirASemaforo(
  deficit: number,
  umbrales: { rojo: number; amarillo: number }
): { semaforo: Semaforo; timing: Timing } {
  if (deficit >= umbrales.rojo) {
    return { semaforo: "rojo", timing: "hoy" };
  }
  if (deficit >= umbrales.rojo - 5) {
    return { semaforo: "rojo", timing: "mañana" };
  }
  if (deficit >= umbrales.amarillo) {
    return { semaforo: "amarillo", timing: "3-4 días" };
  }
  return { semaforo: "verde", timing: "no urgente" };
}
