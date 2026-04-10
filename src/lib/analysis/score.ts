/**
 * Computes a 0-100 health score from a FieldAnalysis result.
 */

import type { FieldAnalysis } from "@/types";

function pct(analysis: FieldAnalysis, id: string): number {
  return analysis.categories.find((c) => c.id === id)?.percentage ?? 0;
}

export function computeScore(analysis: FieldAnalysis): number {
  switch (analysis.layerType) {
    case "ndvi": {
      const veryHealthy = pct(analysis, "very_healthy");
      const healthy = pct(analysis, "healthy");
      const moderate = pct(analysis, "moderate");
      const stressed = pct(analysis, "stressed");
      return (veryHealthy * 100 + healthy * 75 + moderate * 40 + stressed * 10) / 100;
    }
    case "ndmi": {
      const humid = pct(analysis, "humid");
      const adequate = pct(analysis, "adequate");
      const saturated = pct(analysis, "saturated");
      const dry = pct(analysis, "dry");
      return (humid * 85 + adequate * 100 + saturated * 40 + dry * 10) / 100;
    }
    case "ndwi": {
      const dryLand = pct(analysis, "dry_land");
      const humid = pct(analysis, "humid");
      const water = pct(analysis, "water");
      return (dryLand * 70 + humid * 100 + water * 20) / 100;
    }
    default:
      return 0;
  }
}
