/**
 * Generates 2-3 plain-Spanish recommendations based on a FieldAnalysis result.
 * Rules keyed to the 5-category flat-color scheme from evalscripts.ts.
 */

import type { FieldAnalysis } from "@/types";

function pct(analysis: FieldAnalysis, id: string): number {
  return analysis.categories.find((c) => c.id === id)?.percentage ?? 0;
}

export function generateRecommendations(analysis: FieldAnalysis): string[] {
  const rules: string[] = [];

  if (analysis.layerType === "ndvi") {
    const critical = pct(analysis, "critical");
    const stressed = pct(analysis, "stressed");
    const moderate = pct(analysis, "moderate");
    const veryHealthy = pct(analysis, "very_healthy");

    if (critical > 10) {
      rules.push(
        `${Math.round(critical)}% de tu campo está en estado crítico (sin vegetación o muy dañado). Requiere intervención inmediata.`,
      );
    }
    if (stressed > 25) {
      rules.push(
        `El ${Math.round(stressed)}% del campo muestra vegetación estresada. Revisa plagas, nutrientes o riego insuficiente.`,
      );
    }
    if (moderate > 40) {
      rules.push(
        "Gran parte del campo tiene vigor moderado. Considera aplicar fertilizante para mejorar rendimiento.",
      );
    }
    if (veryHealthy > 60 && rules.length === 0) {
      rules.push("Tu campo se ve saludable en general. Mantén el programa de manejo actual.");
    }
  }

  if (analysis.layerType === "ndmi") {
    const veryDry = pct(analysis, "very_dry");
    const dry = pct(analysis, "dry");
    const humid = pct(analysis, "humid");
    const saturated = pct(analysis, "saturated");

    if (veryDry > 10) {
      rules.push(
        `${Math.round(veryDry)}% del terreno está muy seco. Riego urgente necesario en esas zonas.`,
      );
    }
    if (dry > 30) {
      rules.push(
        `El ${Math.round(dry)}% del terreno presenta baja humedad. Programa riego en las próximas 48 horas.`,
      );
    }
    if (saturated > 15) {
      rules.push(
        `Se detecta suelo saturado en ${Math.round(saturated)}%. Verifica el drenaje y reduce riego.`,
      );
    }
    if (humid > 60 && rules.length === 0) {
      rules.push("El suelo tiene buena humedad. No es necesario regar por ahora.");
    }
  }

  if (analysis.layerType === "ndwi") {
    const dryLand = pct(analysis, "dry_land");
    const moistSoil = pct(analysis, "moist_soil");
    const lowWater = pct(analysis, "low_water");
    const moderateWater = pct(analysis, "moderate_water");
    const deepWater = pct(analysis, "deep_water");

    const totalWater = lowWater + moderateWater + deepWater;

    if (deepWater > 5) {
      rules.push(
        `Se detecta agua profunda en ${Math.round(deepWater)}% del terreno. Posible anegamiento o embalse.`,
      );
    }
    if (totalWater > 15) {
      rules.push(
        `Presencia de agua en ${Math.round(totalWater)}% del terreno. Verifica drenaje si no es un cuerpo de agua permanente.`,
      );
    }
    if (dryLand > 70 && rules.length === 0) {
      rules.push("El terreno está mayormente seco. No se detecta acumulación de agua.");
    }
    if (moistSoil > 40 && rules.length === 0) {
      rules.push("El suelo presenta humedad superficial adecuada.");
    }
  }

  if (rules.length === 0) {
    return ["No se detectan problemas significativos en esta fecha."];
  }

  return rules.slice(0, 3);
}
