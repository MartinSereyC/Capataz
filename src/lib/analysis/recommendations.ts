/**
 * Generates 2-3 plain-Spanish recommendations based on a FieldAnalysis result.
 */

import type { FieldAnalysis } from "@/types";

function pct(analysis: FieldAnalysis, id: string): number {
  return analysis.categories.find((c) => c.id === id)?.percentage ?? 0;
}

export function generateRecommendations(analysis: FieldAnalysis): string[] {
  const rules: string[] = [];

  if (analysis.layerType === "ndvi") {
    const stressed = pct(analysis, "stressed");
    const veryHealthy = pct(analysis, "very_healthy");
    const moderate = pct(analysis, "moderate");

    if (stressed > 30) {
      rules.push(
        `El ${Math.round(stressed)}% de tu campo muestra vegetación estresada. Revisa posibles plagas, falta de nutrientes o riego insuficiente.`,
      );
    }
    if (veryHealthy > 60) {
      rules.push("Tu campo se ve saludable en general. Mantén el programa de manejo actual.");
    }
    if (moderate > 50) {
      rules.push(
        "Gran parte del campo tiene vigor moderado. Considera aplicar fertilizante para mejorar el rendimiento.",
      );
    }
  }

  if (analysis.layerType === "ndmi") {
    const dry = pct(analysis, "dry");
    const humid = pct(analysis, "humid");
    const saturated = pct(analysis, "saturated");

    if (dry > 40) {
      rules.push(
        `El ${Math.round(dry)}% del terreno presenta baja humedad. Programa riego en las próximas 48 horas.`,
      );
    }
    if (humid > 70) {
      rules.push("El suelo tiene buena humedad. No es necesario regar por ahora.");
    }
    if (saturated > 15) {
      rules.push(`Se detecta suelo saturado en ${Math.round(saturated)}%. Verifica el drenaje.`);
    }
  }

  if (analysis.layerType === "ndwi") {
    const water = pct(analysis, "water");
    const dryLand = pct(analysis, "dry_land");

    if (water > 15) {
      rules.push(
        `Se detecta exceso de agua en ${Math.round(water)}% del terreno. Verifica el drenaje.`,
      );
    }
    if (dryLand > 80) {
      rules.push(
        "El terreno se encuentra seco. No se detectan problemas de acumulación de agua.",
      );
    }
  }

  if (rules.length === 0) {
    return ["No se detectan problemas significativos en esta fecha."];
  }

  return rules.slice(0, 3);
}
