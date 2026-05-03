"use client";

import { useEffect, useRef, useState } from "react";
import type { GeoJSONPolygon } from "@/types";

export interface ZoneStat {
  ndvi: number | null;
  ndmi: number | null;
  loading: boolean;
}

interface ZoneInput {
  id: number;
  polygon: GeoJSONPolygon;
}

const cache = new Map<string, { ndvi: number | null; ndmi: number | null }>();

export function useZoneStats(
  zones: ZoneInput[],
  selectedDate: string
): Record<number, ZoneStat> {
  const [stats, setStats] = useState<Record<number, ZoneStat>>({});
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (zones.length === 0 || !selectedDate) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStats(
      Object.fromEntries(zones.map((z) => [z.id, { ndvi: null, ndmi: null, loading: true }]))
    );

    const fetchAll = async () => {
      await Promise.all(
        zones.map(async (zone) => {
          const key = `${zone.id}:${selectedDate}`;
          if (cache.has(key)) {
            const cached = cache.get(key)!;
            setStats((prev) => ({ ...prev, [zone.id]: { ...cached, loading: false } }));
            return;
          }

          try {
            const res = await fetch("/api/zone-stats", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ polygon: zone.polygon, date: selectedDate }),
              signal: controller.signal,
            });

            if (!res.ok) throw new Error("fetch failed");
            const data = await res.json() as { ndvi: number | null; ndmi: number | null };
            cache.set(key, data);
            setStats((prev) => ({ ...prev, [zone.id]: { ...data, loading: false } }));
          } catch (err) {
            if ((err as Error).name === "AbortError") return;
            setStats((prev) => ({ ...prev, [zone.id]: { ndvi: null, ndmi: null, loading: false } }));
          }
        })
      );
    };

    fetchAll();

    return () => { controller.abort(); };
  }, [zones, selectedDate]);

  return stats;
}
