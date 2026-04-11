import type { Confianza } from "./types";

// Fase 1: "alta" está reservada para cuando exista calibración local (Fase 2).
export function calcularConfianza(
  diasDesdeAlta: number,
  errorReconciliacionPromedio: number
): Confianza {
  if (diasDesdeAlta < 15) return "baja";
  if (errorReconciliacionPromedio >= 0.2) return "baja";
  return "media";
}
