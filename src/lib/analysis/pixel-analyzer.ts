/**
 * Client-side pixel analysis using canvas + nearest-centroid classification.
 *
 * Centroids are the EXACT RGB triplets produced by the flat-color evalscripts
 * in src/lib/sentinel/evalscripts.ts, so classification is essentially exact
 * (nearest-centroid collapses to equality except for PNG compression noise).
 */

import type { SatelliteLayerType, FieldAnalysis, FieldCategory } from "@/types";
import { computeScore } from "./score";
import { generateRecommendations } from "./recommendations";

interface Centroid {
  id: string;
  label: string;
  color: string;
  r: number;
  g: number;
  b: number;
}

// Exactly matches evalscripts.ts NDVI flat colors (0-1 floats × 255).
const NDVI_CENTROIDS: Centroid[] = [
  { id: "critical", label: "Crítico", color: "#CC1A1A", r: 204, g: 26, b: 26 },
  { id: "stressed", label: "Estresado", color: "#E68C1A", r: 230, g: 140, b: 26 },
  { id: "moderate", label: "Moderado", color: "#F2D926", r: 242, g: 217, b: 38 },
  { id: "healthy", label: "Sano", color: "#4DB326", r: 77, g: 179, b: 38 },
  { id: "very_healthy", label: "Muy sano", color: "#0D660D", r: 13, g: 102, b: 13 },
];

const NDMI_CENTROIDS: Centroid[] = [
  { id: "very_dry", label: "Muy seco", color: "#A6400D", r: 166, g: 64, b: 13 },
  { id: "dry", label: "Seco", color: "#E69926", r: 230, g: 153, b: 38 },
  { id: "adequate", label: "Adecuado", color: "#F2E64D", r: 242, g: 230, b: 77 },
  { id: "humid", label: "Húmedo", color: "#338CCC", r: 51, g: 140, b: 204 },
  { id: "saturated", label: "Saturado", color: "#1A2699", r: 26, g: 38, b: 153 },
];

const NDWI_CENTROIDS: Centroid[] = [
  { id: "dry_land", label: "Tierra seca", color: "#D9CCB3", r: 217, g: 204, b: 179 },
  { id: "moist_soil", label: "Suelo húmedo", color: "#B3CC99", r: 179, g: 204, b: 153 },
  { id: "low_water", label: "Agua baja", color: "#80BFE6", r: 128, g: 191, b: 230 },
  { id: "moderate_water", label: "Agua moderada", color: "#2673CC", r: 38, g: 115, b: 204 },
  { id: "deep_water", label: "Agua profunda", color: "#0D268C", r: 13, g: 38, b: 140 },
];

function getCentroids(layerType: SatelliteLayerType): Centroid[] {
  switch (layerType) {
    case "ndvi": return NDVI_CENTROIDS;
    case "ndmi": return NDMI_CENTROIDS;
    case "ndwi": return NDWI_CENTROIDS;
    default: return [];
  }
}

function nearestCentroid(r: number, g: number, b: number, centroids: Centroid[]): Centroid {
  let best = centroids[0];
  let bestDist = Infinity;
  for (const c of centroids) {
    const dr = r - c.r;
    const dg = g - c.g;
    const db = b - c.b;
    const dist = dr * dr + dg * dg + db * db;
    if (dist < bestDist) {
      bestDist = dist;
      best = c;
    }
  }
  return best;
}

export async function analyzeFieldImage(
  imageUrl: string,
  layerType: SatelliteLayerType,
  areaHectares: number,
): Promise<FieldAnalysis | null> {
  if (layerType === "true-color") return null;

  const centroids = getCentroids(layerType);

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(null);
        return;
      }

      ctx.drawImage(img, 0, 0);
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

      const counts = new Map<string, number>();
      for (const c of centroids) counts.set(c.id, 0);

      let totalValidPixels = 0;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        // Skip transparent or near-black (outside parcel) pixels
        if (a === 0 || r + g + b < 15) continue;

        totalValidPixels++;
        const nearest = nearestCentroid(r, g, b, centroids);
        counts.set(nearest.id, (counts.get(nearest.id) ?? 0) + 1);
      }

      if (totalValidPixels === 0) {
        resolve(null);
        return;
      }

      const categories: FieldCategory[] = centroids.map((c) => {
        const pixelCount = counts.get(c.id) ?? 0;
        const percentage = (pixelCount / totalValidPixels) * 100;
        const hectares = areaHectares * percentage / 100;
        return {
          id: c.id,
          label: c.label,
          color: c.color,
          percentage,
          hectares,
          pixelCount,
        };
      });

      const partialAnalysis = { layerType, categories, totalValidPixels };
      const score = computeScore({ ...partialAnalysis, score: 0, recommendations: [], analyzedAt: 0 });
      const recommendations = generateRecommendations({ ...partialAnalysis, score, recommendations: [], analyzedAt: 0 });

      resolve({
        layerType,
        score,
        categories,
        recommendations,
        totalValidPixels,
        analyzedAt: Date.now(),
      });
    };

    img.onerror = () => resolve(null);
    img.src = imageUrl;
  });
}
