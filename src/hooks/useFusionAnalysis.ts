"use client";

import { useState, useEffect, useRef } from "react";
import type { GeoJSONPolygon } from "@/types";
import type { FusionResult } from "@/lib/fusion/engine";

const cache = new Map<string, FusionResult>();

export function useFusionAnalysis(params: {
  zoneId: number | null;
  polygon: GeoJSONPolygon | null;
  crop: string | null;
  date: string | null;
  ndmi: number | null | undefined;
  cloudCoverage: number | null | undefined;
}): { result: FusionResult | null; loading: boolean } {
  const { zoneId, polygon, crop, date, ndmi, cloudCoverage } = params;
  const [result, setResult] = useState<FusionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!zoneId || !polygon || !crop || !date) {
      setResult(null);
      setLoading(false);
      return;
    }

    // Stable cache key: zone + date + ndmi availability
    const cacheKey = `${zoneId}:${date}:${ndmi != null ? 'sat' : 'nosat'}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      setResult(cached);
      setLoading(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);

    const fetchFusion = async () => {
      try {
        const res = await fetch('/api/fusion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            polygon,
            crop,
            date,
            ndmi: ndmi ?? null,
            cloudCoverage: cloudCoverage ?? null,
          }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error('fetch failed');
        const data = await res.json() as FusionResult;
        cache.set(cacheKey, data);
        setResult(data);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setResult(null);
      } finally {
        setLoading(false);
      }
    };

    void fetchFusion();
    return () => { controller.abort(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoneId, date, ndmi != null]);

  return { result, loading };
}
