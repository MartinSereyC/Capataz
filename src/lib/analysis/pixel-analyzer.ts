/**
 * Client-side pixel analysis using canvas + nearest-centroid classification.
 * Analyzes the satellite image PNG already loaded as a blob object URL.
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

const NDVI_CENTROIDS: Centroid[] = [
  { id: "stressed", label: "Estresada", color: "#CC0000", r: 204, g: 0, b: 0 },
  { id: "moderate", label: "Moderada", color: "#CCCC00", r: 204, g: 204, b: 0 },
  { id: "healthy", label: "Sana", color: "#669900", r: 102, g: 153, b: 0 },
  { id: "very_healthy", label: "Muy sana", color: "#003300", r: 0, g: 51, b: 0 },
];

const NDMI_CENTROIDS: Centroid[] = [
  { id: "dry", label: "Seco", color: "#994C00", r: 153, g: 76, b: 0 },
  { id: "adequate", label: "Adecuada", color: "#CCB200", r: 204, g: 178, b: 0 },
  { id: "humid", label: "Húmedo", color: "#338CCC", r: 51, g: 140, b: 204 },
  { id: "saturated", label: "Saturado", color: "#0000FF", r: 0, g: 0, b: 255 },
];

const NDWI_CENTROIDS: Centroid[] = [
  { id: "dry_land", label: "Tierra seca", color: "#FFFFFF", r: 255, g: 255, b: 255 },
  { id: "humid", label: "Humedad", color: "#CCE5FF", r: 204, g: 229, b: 255 },
  { id: "water", label: "Agua", color: "#0033FF", r: 0, g: 51, b: 255 },
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
