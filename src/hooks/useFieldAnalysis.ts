"use client";

/**
 * Hook that runs pixel analysis on the current satellite image whenever
 * the date, layer type, or image URL changes. Results are cached per
 * date+layer combination so re-renders don't re-analyse.
 */

import { useState, useEffect, useRef } from "react";
import { useParcelContext } from "@/context/ParcelContext";
import { analyzeFieldImage } from "@/lib/analysis/pixel-analyzer";
import type { FieldAnalysis } from "@/types";

interface UseFieldAnalysisResult {
  analysis: FieldAnalysis | null;
  loading: boolean;
  error: string | null;
}

export function useFieldAnalysis(): UseFieldAnalysisResult {
  const { satelliteImageUrl, selectedLayerType, selectedDate, parcel } = useParcelContext();

  const [analysis, setAnalysis] = useState<FieldAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cache = useRef<Map<string, FieldAnalysis>>(new Map());

  useEffect(() => {
    if (!satelliteImageUrl || !selectedDate || !parcel || selectedLayerType === "true-color") {
      setAnalysis(null);
      setLoading(false);
      setError(null);
      return;
    }

    const cacheKey = `${selectedDate}:${selectedLayerType}`;
    const cached = cache.current.get(cacheKey);
    if (cached) {
      setAnalysis(cached);
      return;
    }

    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);
      try {
        const result = await analyzeFieldImage(
          satelliteImageUrl!,
          selectedLayerType,
          parcel!.area_hectares,
        );
        if (cancelled) return;
        if (result) {
          cache.current.set(cacheKey, result);
          setAnalysis(result);
        } else {
          setAnalysis(null);
          setError("no-data");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "unknown");
          setAnalysis(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [satelliteImageUrl, selectedLayerType, selectedDate, parcel]);

  return { analysis, loading, error };
}
