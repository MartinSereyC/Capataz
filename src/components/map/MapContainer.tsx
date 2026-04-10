"use client";

import dynamic from "next/dynamic";
import type { Parcel } from "@/types";

// Dynamically import the Leaflet map to prevent SSR errors.
// Leaflet requires browser APIs (window, document) that don't exist on the server.
const LeafletMap = dynamic(() => import("./LeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-gray-100">
      <p className="text-gray-500 text-sm">Cargando mapa...</p>
    </div>
  ),
});

interface MapContainerProps {
  parcel: Parcel | null;
  drawMode?: boolean;
  selectedDate?: string | null;
  onManualConfirm?: (parcel: Parcel) => void;
  onManualCancel?: () => void;
}

/**
 * SSR-safe map wrapper. Dynamically imports Leaflet only on the client.
 * Fills its parent container — parent must have an explicit height.
 */
export function MapContainer({
  parcel,
  drawMode = false,
  selectedDate,
  onManualConfirm,
  onManualCancel,
}: MapContainerProps) {
  return (
    <div className="relative h-full w-full">
      <LeafletMap
        parcel={parcel}
        drawMode={drawMode}
        selectedDate={selectedDate ?? null}
        onManualConfirm={onManualConfirm ?? (() => {})}
        onManualCancel={onManualCancel ?? (() => {})}
      />
    </div>
  );
}
