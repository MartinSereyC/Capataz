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
 * Calculates image dimensions from a bbox while keeping the larger dimension
 * at maxPixels and preserving the aspect ratio.
 */
export function calculateDimensions(
  bbox: BboxGeoJSON,
  maxPixels: number = 512,
): { width: number; height: number } {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const lngSpan = maxLng - minLng;
  const latSpan = maxLat - minLat;

  if (lngSpan >= latSpan) {
    const width = maxPixels;
    const height = Math.max(1, Math.round((latSpan / lngSpan) * maxPixels));
    return { width, height };
  } else {
    const height = maxPixels;
    const width = Math.max(1, Math.round((lngSpan / latSpan) * maxPixels));
    return { width, height };
  }
}

/**
 * Builds the Sentinel Hub Process API request body for a true-color image.
 *
 * @param bbox    GeoJSON bbox [minLng, minLat, maxLng, maxLat]
 * @param polygon GeoJSON polygon for geometry clipping
 * @param date    Selected date YYYY-MM-DD
 * @param width   Output image width in pixels
 * @param height  Output image height in pixels
 */
export function buildProcessApiBody(
  bbox: BboxGeoJSON,
  _polygon: GeoJSONPolygon,
  date: string,
  width: number,
  height: number,
): object {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  return {
    input: {
      bounds: {
        bbox: [minLng, minLat, maxLng, maxLat],
        properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/4326" },
      },
      data: [
        {
          type: SENTINEL_CONFIG.collection,
          dataFilter: {
            timeRange: {
              from: `${date}T00:00:00Z`,
              to: `${date}T23:59:59Z`,
            },
          },
        },
      ],
    },
    output: {
      width,
      height,
      responses: [
        { identifier: "default", format: { type: "image/png" } },
      ],
    },
    evalscript: TRUE_COLOR_EVALSCRIPT,
  };
}

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
