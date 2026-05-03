"use client";

import dynamic from "next/dynamic";
import type L from "leaflet";
import type { Parcel, GeoJSONPolygon } from "@/types";
import type { BasemapType } from "@/lib/constants";
import type { ManualDrawApi } from "./ManualDraw";

export interface MapZone {
  id: number | string;
  polygon: GeoJSONPolygon;
  color?: string;
  label?: string;
}

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
  availableDates?: string[];
  onManualConfirm?: (parcel: Parcel) => void;
  onManualCancel?: () => void;
  basemap?: BasemapType;
  onBasemapChange?: (basemap: BasemapType) => void;
  onMapReady?: (map: L.Map) => void;
  onCenterChange?: (center: { lat: number; lng: number }) => void;
  hideInMapControls?: boolean;
  onManualDrawApi?: (api: ManualDrawApi) => void;
  onPointsChange?: (count: number) => void;
  onEditChange?: (editing: boolean) => void;
  /** Seed initial vertices for ManualDraw (e.g. re-opening a saved polygon). */
  initialDrawPoints?: [number, number][];
  /** Extra polygons to render on the map (e.g. user-drawn zones). */
  zones?: MapZone[];
  /** If provided, ManualDraw will reject clicks outside this polygon. */
  boundary?: import("@/types").GeoJSONPolygon;
  /** Fires when the user clicks a zone polygon. */
  onZoneClick?: (id: number | string) => void;
}

/**
 * SSR-safe map wrapper. Dynamically imports Leaflet only on the client.
 * Fills its parent container — parent must have an explicit height.
 */
export function MapContainer({
  parcel,
  drawMode = false,
  selectedDate,
  availableDates = [],
  onManualConfirm,
  onManualCancel,
  basemap,
  onBasemapChange,
  onMapReady,
  onCenterChange,
  hideInMapControls,
  onManualDrawApi,
  onPointsChange,
  onEditChange,
  initialDrawPoints,
  zones,
  boundary,
  onZoneClick,
}: MapContainerProps) {
  return (
    <div className="relative h-full w-full" style={{ zIndex: 0 }}>
      <LeafletMap
        parcel={parcel}
        drawMode={drawMode}
        selectedDate={selectedDate ?? null}
        availableDates={availableDates}
        onManualConfirm={onManualConfirm ?? (() => {})}
        onManualCancel={onManualCancel ?? (() => {})}
        basemap={basemap}
        onBasemapChange={onBasemapChange}
        onMapReady={onMapReady}
        onCenterChange={onCenterChange}
        hideInMapControls={hideInMapControls}
        onManualDrawApi={onManualDrawApi}
        onPointsChange={onPointsChange}
        onEditChange={onEditChange}
        initialDrawPoints={initialDrawPoints}
        zones={zones}
        boundary={boundary}
        onZoneClick={onZoneClick}
      />
    </div>
  );
}
