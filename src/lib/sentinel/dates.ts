/**
 * Fetch available Sentinel acquisition dates for a given bounding box and
 * time range. Supports both Sentinel-2 (optical, default) and Sentinel-1
 * (radar), since radar passes through clouds and has its own revisit cadence.
 */

import { SENTINEL_CONFIG } from "@/lib/constants";
import { isMockMode, getMockDates, getMockCloudCoverage } from "@/lib/sentinel/mock";
import { getSentinelToken } from "@/lib/sentinel/auth";
import type { BboxGeoJSON, SatelliteDatesResponse } from "@/types";

export type SentinelCollection = "sentinel-2-l2a" | "sentinel-1-grd";

interface CatalogFeature {
  properties: {
    datetime: string;
    "eo:cloud_cover"?: number;
  };
}

interface CatalogResponse {
  features: CatalogFeature[];
}

/**
 * Returns available acquisition dates for the given bounding box and time
 * window, along with cloud coverage per date (always 0 for radar).
 *
 * @param bbox        GeoJSON bbox [minLng, minLat, maxLng, maxLat]
 * @param fromDate    ISO date string YYYY-MM-DD (start of range)
 * @param toDate      ISO date string YYYY-MM-DD (end of range)
 * @param collection  Sentinel collection to query (default: sentinel-2-l2a)
 */
export async function getAvailableDates(
  bbox: BboxGeoJSON,
  fromDate: string,
  toDate: string,
  collection: SentinelCollection = "sentinel-2-l2a",
): Promise<SatelliteDatesResponse> {
  if (isMockMode()) {
    const dates = getMockDates();
    const cloudCoverage =
      collection === "sentinel-1-grd"
        ? Object.fromEntries(dates.map((d) => [d, 0]))
        : getMockCloudCoverage();
    return { dates, total: dates.length, cloud_coverage: cloudCoverage };
  }

  const { token } = await getSentinelToken();

  const isRadar = collection === "sentinel-1-grd";

  const body = {
    bbox,
    datetime: `${fromDate}T00:00:00Z/${toDate}T23:59:59Z`,
    collections: [collection],
    limit: 100,
    fields: {
      include: isRadar
        ? ["properties.datetime"]
        : ["properties.datetime", "properties.eo:cloud_cover"],
    },
  };

  const res = await fetch(SENTINEL_CONFIG.catalogUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Sentinel catalog request failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json() as CatalogResponse;

  const cloudCoverage: Record<string, number> = {};
  const dateSet = new Set<string>();

  for (const feature of data.features) {
    const isoDate = feature.properties.datetime.split("T")[0];
    dateSet.add(isoDate);
    cloudCoverage[isoDate] = isRadar
      ? 0
      : Math.round(feature.properties["eo:cloud_cover"] ?? 0);
  }

  // Sort ascending (oldest first)
  const dates = Array.from(dateSet).sort();

  return { dates, total: dates.length, cloud_coverage: cloudCoverage };
}
