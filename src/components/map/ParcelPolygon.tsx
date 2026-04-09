import { Polygon, useMap } from "react-leaflet";
import { LatLngBounds } from "leaflet";
import { useEffect } from "react";
import type { GeoJSONPolygon, BboxGeoJSON } from "@/types";
import { MAP_DEFAULTS } from "@/lib/constants";

interface ParcelPolygonProps {
  polygon: GeoJSONPolygon;
  bbox: BboxGeoJSON;
}

/**
 * Renders the parcel boundary polygon and auto-fits the map to its bounds.
 * Must be rendered inside a MapContainer (react-leaflet).
 */
export function ParcelPolygon({ polygon, bbox }: ParcelPolygonProps) {
  const map = useMap();

  // Convert GeoJSON bbox [minLng, minLat, maxLng, maxLat] to Leaflet LatLngBounds
  const leafletBounds = new LatLngBounds(
    [bbox[1], bbox[0]],
    [bbox[3], bbox[2]],
  );

  // Fit map to parcel bounds on mount / when bbox changes
  useEffect(() => {
    map.fitBounds(leafletBounds, {
      padding: MAP_DEFAULTS.fitBoundsPadding,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bbox[0], bbox[1], bbox[2], bbox[3]]);

  // Convert GeoJSON coordinates [lng, lat][] to Leaflet [lat, lng][]
  const positions = polygon.coordinates[0].map(
    ([lng, lat]) => [lat, lng] as [number, number],
  );

  return (
    <Polygon
      positions={positions}
      pathOptions={{
        color: "#16a34a",       // darker green border
        weight: 2,
        fillColor: "#22c55e",   // green fill
        fillOpacity: 0.25,
      }}
    />
  );
}
