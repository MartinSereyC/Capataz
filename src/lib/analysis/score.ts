/**
 * Computes a 0-100 health/moisture score from a FieldAnalysis result.
 * Weights match the 5-category flat-color scheme from evalscripts.ts.
 */

import type { FieldAnalysis } from "@/types";

function pct(analysis: FieldAnalysis, id: string): number {
  return analysis.categories.find((c) => c.id === id)?.percentage ?? 0;
}

export function computeScore(analysis: FieldAnalysis): number {
  switch (analysis.layerType) {
    case "ndvi": {
      const critical = pct(analysis, "critical");
      const stressed = pct(analysis, "stressed");
      const moderate = pct(analysis, "moderate");
      const healthy = pct(analysis, "healthy");
      const veryHealthy = pct(analysis, "very_healthy");
      return (
        (critical * 0 + stressed * 25 + moderate * 55 + healthy * 85 + veryHealthy * 100) /
        100
      );
    }
    case "ndmi": {
      const veryDry = pct(analysis, "very_dry");
      const dry = pct(analysis, "dry");
      const adequate = pct(analysis, "adequate");
      const humid = pct(analysis, "humid");
      const saturated = pct(analysis, "saturated");
      return (
        (veryDry * 0 + dry * 30 + adequate * 100 + humid * 80 + saturated * 35) / 100
      );
    }
    case "ndwi": {
      const dryLand = pct(analysis, "dry_land");
      const moistSoil = pct(analysis, "moist_soil");
      const lowWater = pct(analysis, "low_water");
      const moderateWater = pct(analysis, "moderate_water");
      const deepWater = pct(analysis, "deep_water");
      return (
        (dryLand * 60 + moistSoil * 100 + lowWater * 70 + moderateWater * 30 + deepWater * 10) /
        100
      );
    }
    default:
      return 0;
  }
}
