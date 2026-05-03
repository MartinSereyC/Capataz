"use client";

import { useState, useEffect } from "react";
import type { ClimaDiario } from "@/lib/clima/types";

export function useWeatherForecast(lat: number | null, lng: number | null): {
  forecast: ClimaDiario[];
  loading: boolean;
} {
  const [forecast, setForecast] = useState<ClimaDiario[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (lat === null || lng === null) return;

    setLoading(true);
    fetch(`/api/weather?lat=${lat}&lng=${lng}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: ClimaDiario[]) => {
        const today = new Date().toISOString().split('T')[0];
        setForecast(data.filter((d) => d.fecha >= today).slice(0, 7));
      })
      .catch(() => setForecast([]))
      .finally(() => setLoading(false));
  }, [lat, lng]);

  return { forecast, loading };
}
