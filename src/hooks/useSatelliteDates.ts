"use client";

/**
 * Hook to fetch and cache available Sentinel-2 dates for a parcel's bounding box.
 * Calls /api/satellite-dates and caches the result to avoid re-fetching on slider interaction.
 */

import { useState, useEffect, useRef } from "react";
import { SENTINEL_CONFIG } from "@/lib/constants";
import type { BboxGeoJSON, SatelliteDatesResponse } from "@/types";

interface UseSatelliteDatesResult {
  dates: string[];
  cloudCoverage: Record<string, number>;
  loading: boolean;
  error: string | null;
}

/**
 * Fetches available satellite dates for the given bounding box.
 * Results are cached by bbox+fromDate+toDate key for the component lifetime.
 *
 * @param bbox  GeoJSON bbox [minLng, minLat, maxLng, maxLat], or null if no parcel selected
 */
export function useSatelliteDates(bbox: BboxGeoJSON | null): UseSatelliteDatesResult {
  const [dates, setDates] = useState<string[]>([]);
  const [cloudCoverage, setCloudCoverage] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Simple in-memory cache: key -> result
  const cache = useRef<Map<string, SatelliteDatesResponse>>(new Map());

  useEffect(() => {
    if (!bbox) {
      setDates([]);
      setCloudCoverage({});
      setLoading(false);
      setError(null);
      return;
    }

    // Search a wider window (2x) to account for Sentinel-2 processing delays,
    // then trim results to 6 months anchored to the latest available image.
    const today = new Date();
    const fromDate = new Date(today);
    fromDate.setMonth(fromDate.getMonth() - SENTINEL_CONFIG.defaultMonths * 2);

    const toStr = today.toISOString().split("T")[0];
    const fromStr = fromDate.toISOString().split("T")[0];
    const bboxStr = bbox.join(",");
    const cacheKey = `${bboxStr}|${fromStr}|${toStr}`;

    // Return from cache if available
    const cached = cache.current.get(cacheKey);
    if (cached) {
      setDates(cached.dates);
      setCloudCoverage(cached.cloud_coverage);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    async function fetchDates() {
      setLoading(true);
      setError(null);

      try {
        const url = `/api/satellite-dates?bbox=${bboxStr}&from=${fromStr}&to=${toStr}`;
        const res = await fetch(url);

        if (!res.ok) {
          throw new Error(`Error ${res.status}: ${res.statusText}`);
        }

        const data = await res.json() as SatelliteDatesResponse;

        // Trim to 6 months anchored to the latest available image
        if (data.dates.length > 0) {
          const latestDate = new Date(data.dates[data.dates.length - 1]);
          const cutoff = new Date(latestDate);
          cutoff.setMonth(cutoff.getMonth() - SENTINEL_CONFIG.defaultMonths);
          const cutoffStr = cutoff.toISOString().split("T")[0];

          data.dates = data.dates.filter((d) => d >= cutoffStr);
          const dateSet = new Set(data.dates);
          for (const key of Object.keys(data.cloud_coverage)) {
            if (!dateSet.has(key)) delete data.cloud_coverage[key];
          }
          data.total = data.dates.length;
        }

        if (!cancelled) {
          cache.current.set(cacheKey, data);
          setDates(data.dates);
          setCloudCoverage(data.cloud_coverage);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Error desconocido");
          setLoading(false);
        }
      }
    }

    void fetchDates();

    return () => {
      cancelled = true;
    };
  }, [bbox]);

  return { dates, cloudCoverage, loading, error };
}
