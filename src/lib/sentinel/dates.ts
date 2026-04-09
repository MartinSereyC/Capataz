/**
 * Fetch available Sentinel-2 image dates for a given bounding box and time range.
 */

import { SENTINEL_CONFIG } from "@/lib/constants";
import { isMockMode, getMockDates, getMockCloudCoverage } from "@/lib/sentinel/mock";
import { getSentinelToken } from "@/lib/sentinel/auth";
import type { BboxGeoJSON, SatelliteDatesResponse } from "@/types";

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
 * Returns available Sentinel-2 acquisition dates for the given bounding box
 * and time window, along with cloud coverage per date.
 *
 * @param bbox      GeoJSON bbox [minLng, minLat, maxLng, maxLat]
 * @param fromDate  ISO date string YYYY-MM-DD (start of range)
 * @param toDate    ISO date string YYYY-MM-DD (end of range)
 */
export async function getAvailableDates(
  bbox: BboxGeoJSON,
  fromDate: string,
  toDate: string,
): Promise<SatelliteDatesResponse> {
  if (isMockMode()) {
    const dates = getMockDates();
    const cloudCoverage = getMockCloudCoverage();
    return { dates, total: dates.length, cloud_coverage: cloudCoverage };
  }

  const { token } = await getSentinelToken();

  const body = {
    bbox,
    datetime: `${fromDate}T00:00:00Z/${toDate}T23:59:59Z`,
    collections: [SENTINEL_CONFIG.collection],
    limit: 100,
    fields: {
      include: ["properties.datetime", "properties.eo:cloud_cover"],
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
    cloudCoverage[isoDate] = Math.round(feature.properties["eo:cloud_cover"] ?? 0);
  }

  // Sort ascending (oldest first)
  const dates = Array.from(dateSet).sort();

  return { dates, total: dates.length, cloud_coverage: cloudCoverage };
}
