"use client";

/**
 * SatelliteLayer — Renders satellite imagery within parcel bounds on the Leaflet map.
 *
 * Mock mode: renders a semi-transparent colored Rectangle overlay using react-leaflet.
 * Live mode: stub — would render Process API tiles (requires credentials).
 *
 * Must be rendered inside a react-leaflet <MapContainer>.
 */

import { Rectangle } from "react-leaflet";
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

  // Live mode stub — Process API tile rendering would be wired here
  // when SENTINEL_CLIENT_ID and SENTINEL_CLIENT_SECRET are provided.
  return null;
}
