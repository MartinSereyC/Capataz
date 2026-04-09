/**
 * Sentinel Hub Process API layer configuration for Leaflet.
 * In mock mode: returns a placeholder config for a semi-transparent overlay.
 * In live mode: configures SentinelHub Process API with true-color evalscript.
 */

import { SENTINEL_CONFIG } from "@/lib/constants";
import { isMockMode } from "@/lib/sentinel/mock";
import type { BboxGeoJSON, GeoJSONPolygon } from "@/types";

export interface MockLayerConfig {
  type: "mock";
  color: string;
  opacity: number;
  bbox: BboxGeoJSON;
}

export interface LiveLayerConfig {
  type: "live";
  processApiUrl: string;
  collection: string;
  evalscript: string;
  polygon: GeoJSONPolygon;
  date: string;
}

export type SentinelLayerConfig = MockLayerConfig | LiveLayerConfig;

/** True-color evalscript for Sentinel-2 L2A */
const TRUE_COLOR_EVALSCRIPT = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B04", "B03", "B02"] }],
    output: { bands: 3 }
  };
}
function evaluatePixel(sample) {
  return [3.5 * sample.B04, 3.5 * sample.B03, 3.5 * sample.B02];
}`;

/**
 * Returns the layer configuration for rendering satellite imagery.
 *
 * @param bbox    GeoJSON bbox for the parcel area
 * @param polygon GeoJSON polygon for geometry clipping (Process API)
 * @param date    Selected date YYYY-MM-DD
 */
export function getSentinelLayerConfig(
  bbox: BboxGeoJSON,
  polygon: GeoJSONPolygon,
  date: string,
): SentinelLayerConfig {
  if (isMockMode()) {
    return {
      type: "mock",
      color: "#22c55e", // green-500
      opacity: 0.35,
      bbox,
    };
  }

  return {
    type: "live",
    processApiUrl: SENTINEL_CONFIG.processApiUrl,
    collection: SENTINEL_CONFIG.collection,
    evalscript: TRUE_COLOR_EVALSCRIPT,
    polygon,
    date,
  };
}
