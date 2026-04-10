"use client";

/**
 * SatelliteLayer — Renders satellite imagery within parcel bounds on the Leaflet map.
 *
 * Mock mode: renders a semi-transparent colored Rectangle overlay using react-leaflet.
 * Live mode: fetches a PNG from /api/satellite-image and renders it as an ImageOverlay.
 *
 * Must be rendered inside a react-leaflet <MapContainer>.
 */

import { useState, useEffect, useRef } from "react";
import { Rectangle, ImageOverlay } from "react-leaflet";
import type { LatLngBoundsExpression } from "leaflet";
import { isMockMode } from "@/lib/sentinel/mock";
import type { Parcel } from "@/types";

interface SatelliteLayerProps {
  /** Currently selected date (YYYY-MM-DD) */
  date: string | null;
  /** Parcel data — used for geometry bounds */
  parcel: Parcel;
}

/**
 * Converts a GeoJSON bbox [minLng, minLat, maxLng, maxLat]
 * to a Leaflet LatLngBounds [[minLat, minLng], [maxLat, maxLng]].
 */
function bboxToLeaflet(bbox: [number, number, number, number]): LatLngBoundsExpression {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ];
}

export function SatelliteLayer({ date, parcel }: SatelliteLayerProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // In-memory cache keyed by date string to avoid re-fetching
  const cache = useRef<Map<string, string>>(new Map());

  // Track created object URLs for cleanup on unmount
  const objectUrls = useRef<string[]>([]);

  useEffect(() => {
    // No date or in mock mode — nothing to fetch
    if (!date || isMockMode()) return;

    // Already cached
    const cached = cache.current.get(date);
    if (cached) {
      setImageUrl(cached);
      return;
    }

    let cancelled = false;

    async function fetchImage() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/satellite-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bbox: parcel.bbox,
            polygon: parcel.polygon,
            date,
          }),
        });

        if (!res.ok) {
          throw new Error(`Image fetch failed: ${res.status} ${res.statusText}`);
        }

        const blob = await res.blob();
        if (cancelled) return;

        const url = URL.createObjectURL(blob);
        objectUrls.current.push(url);
        cache.current.set(date!, url);
        setImageUrl(url);
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          console.error("[SatelliteLayer] Failed to fetch satellite image:", msg);
          setError(msg);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchImage();

    return () => {
      cancelled = true;
    };
  }, [date, parcel.bbox, parcel.polygon]);

  // Clean up object URLs on unmount
  useEffect(() => {
    const urls = objectUrls.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  // No date selected — render nothing
  if (!date) return null;

  if (isMockMode()) {
    const bounds = bboxToLeaflet(parcel.bbox);
    return (
      <Rectangle
        bounds={bounds}
        pathOptions={{
          color: "#22c55e",
          fillColor: "#22c55e",
          fillOpacity: 0.35,
          weight: 1,
          opacity: 0.5,
        }}
      />
    );
  }

  // Live mode
  const bounds = bboxToLeaflet(parcel.bbox);

  return (
    <>
      {loading && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 1000,
            background: "rgba(255,255,255,0.85)",
            padding: "8px 16px",
            borderRadius: "8px",
            fontSize: "14px",
            color: "#374151",
            pointerEvents: "none",
          }}
        >
          Cargando imagen satelital...
        </div>
      )}
      {imageUrl && !error && (
        <ImageOverlay
          url={imageUrl}
          bounds={bounds}
          opacity={1}
        />
      )}
    </>
  );
}
