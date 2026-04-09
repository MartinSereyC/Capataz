"use client";

import { useEffect, useCallback, useState } from "react";
import { useMap, Polygon } from "react-leaflet";
import L from "leaflet";
import type { Parcel, GeoJSONPolygon, BboxGeoJSON } from "@/types";
import { es } from "@/lib/i18n/es";

interface ManualDrawProps {
  onConfirm: (parcel: Parcel) => void;
  onCancel: () => void;
}

/**
 * Calculates a rough area in hectares from a closed GeoJSON polygon ring.
 * Uses the Shoelace formula on lat/lng degrees, then converts to hectares
 * using an approximate scale factor for Chile (~35°S).
 */
function calcAreaHectares(points: [number, number][]): number {
  if (points.length < 4) return 0; // closed ring needs at least 4 pts (3 unique + repeat)

  // Degrees to meters rough conversion at ~35°S (centre of Chile)
  const LAT_TO_M = 111_320;
  const LNG_TO_M = 111_320 * Math.cos((35 * Math.PI) / 180);

  let area = 0;
  const n = points.length - 1; // exclude closing duplicate
  for (let i = 0; i < n; i++) {
    const [lng1, lat1] = points[i];
    const [lng2, lat2] = points[(i + 1) % n];
    area += lng1 * LNG_TO_M * lat2 * LAT_TO_M;
    area -= lng2 * LNG_TO_M * lat1 * LAT_TO_M;
  }
  const areaSqM = Math.abs(area) / 2;
  return areaSqM / 10_000; // sq metres → hectares
}

/**
 * Builds a Parcel from a list of [lng, lat] points drawn by the user.
 * Closes the ring so first === last point.
 */
function buildParcelFromPoints(points: [number, number][]): Parcel {
  const closed: [number, number][] = [...points, points[0]];

  const lngs = points.map(([lng]) => lng);
  const lats = points.map(([, lat]) => lat);
  const bbox: BboxGeoJSON = [
    Math.min(...lngs),
    Math.min(...lats),
    Math.max(...lngs),
    Math.max(...lats),
  ];

  const polygon: GeoJSONPolygon = {
    type: "Polygon",
    coordinates: [closed],
  };

  return {
    coordinates: points,
    polygon,
    bbox,
    area_hectares: calcAreaHectares(closed),
    coordinate_format_detected: "LATLONG_DECIMAL",
    raw_coordinates: "Dibujado manualmente",
  };
}

/**
 * ManualDraw — lets the user click map points to define a parcel boundary.
 * Activated when automatic coordinate extraction fails.
 * Must be rendered inside a react-leaflet MapContainer.
 */
export function ManualDraw({ onConfirm, onCancel }: ManualDrawProps) {
  const map = useMap();
  // Points stored as [lng, lat] to match GeoJSON convention
  const [points, setPoints] = useState<[number, number][]>([]);
  // Leaflet marker layer refs for cleanup
  const [markerLayer] = useState(() => L.layerGroup());

  const canConfirm = points.length >= 3;

  // Add marker layer to map on mount, remove on unmount
  useEffect(() => {
    markerLayer.addTo(map);
    return () => {
      markerLayer.clearLayers();
      markerLayer.remove();
    };
  }, [map, markerLayer]);

  // Map click handler — adds a point and a small circle marker
  const handleMapClick = useCallback(
    (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      const point: [number, number] = [lng, lat];

      setPoints((prev) => {
        const next = [...prev, point];
        // Add a small circle marker for visual feedback
        L.circleMarker([lat, lng], {
          radius: 5,
          color: "#16a34a",
          fillColor: "#22c55e",
          fillOpacity: 0.9,
          weight: 2,
        })
          .bindTooltip(`${next.length}`, { permanent: true, direction: "top" })
          .addTo(markerLayer);
        return next;
      });
    },
    [markerLayer],
  );

  useEffect(() => {
    map.on("click", handleMapClick);
    // Change cursor to crosshair while drawing
    map.getContainer().style.cursor = "crosshair";
    return () => {
      map.off("click", handleMapClick);
      map.getContainer().style.cursor = "";
    };
  }, [map, handleMapClick]);

  const handleReset = useCallback(() => {
    setPoints([]);
    markerLayer.clearLayers();
  }, [markerLayer]);

  const handleConfirm = useCallback(() => {
    if (!canConfirm) return;
    const parcel = buildParcelFromPoints(points);
    onConfirm(parcel);
  }, [canConfirm, points, onConfirm]);

  // Convert [lng, lat] points to Leaflet [lat, lng] for preview polygon
  const previewPositions = points.map(([lng, lat]) => [lat, lng] as [number, number]);

  return (
    <>
      {/* Live polygon preview */}
      {points.length >= 2 && (
        <Polygon
          positions={previewPositions}
          pathOptions={{
            color: "#16a34a",
            weight: 2,
            dashArray: "6 4",
            fillColor: "#22c55e",
            fillOpacity: 0.15,
          }}
        />
      )}

      {/* Drawing control panel — overlaid on the map */}
      <div
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] flex flex-col items-center gap-3 pointer-events-none"
        style={{ pointerEvents: "none" }}
      >
        {/* Instruction banner */}
        <div className="bg-white/95 backdrop-blur-sm rounded-xl px-4 py-2 shadow-lg text-sm text-gray-700 text-center max-w-xs pointer-events-auto">
          {es.map.drawInstructions}
          {points.length > 0 && (
            <span className="ml-2 font-semibold text-green-700">
              ({points.length} punto{points.length !== 1 ? "s" : ""})
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 pointer-events-auto">
          {/* Confirm */}
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg shadow hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {es.map.confirmDraw}
          </button>

          {/* Reset */}
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 bg-white text-gray-700 text-sm font-semibold rounded-lg shadow border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            {es.map.resetDraw}
          </button>

          {/* Cancel */}
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-white text-gray-700 text-sm font-semibold rounded-lg shadow border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            {es.map.cancelDraw}
          </button>
        </div>
      </div>
    </>
  );
}
