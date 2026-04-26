"use client";

import { useEffect, useState } from "react";
import { MapContainer as LeafletMapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import type { Parcel } from "@/types";
import { MAP_DEFAULTS, BASEMAP_TILES, BASEMAP_LABELS_URL } from "@/lib/constants";
import type { BasemapType } from "@/lib/constants";
import { ParcelPolygon } from "./ParcelPolygon";
import { SatelliteLayer } from "./SatelliteLayer";
import { ManualDraw, type ManualDrawApi } from "./ManualDraw";
import { LocationSearch } from "./LocationSearch";
import { BasemapToggle } from "./BasemapToggle";

interface LeafletMapProps {
  parcel: Parcel | null;
  drawMode: boolean;
  selectedDate: string | null;
  availableDates: string[];
  onManualConfirm: (parcel: Parcel) => void;
  onManualCancel: () => void;
  /** Controlled basemap. If omitted, the map manages its own internal state. */
  basemap?: BasemapType;
  onBasemapChange?: (basemap: BasemapType) => void;
  /** Fires once with the Leaflet map instance after it mounts. */
  onMapReady?: (map: L.Map) => void;
  /** Fires whenever the map center changes (moveend). */
  onCenterChange?: (center: { lat: number; lng: number }) => void;
  /** If true, suppress BasemapToggle, LocationSearch, ManualDraw's own controls
   *  and the native Leaflet zoom control. The host page is expected to provide its own UI. */
  hideInMapControls?: boolean;
  /** Fires once with the ManualDraw imperative API (undo/clear/finish/toggleEdit). */
  onManualDrawApi?: (api: ManualDrawApi) => void;
  /** Fires whenever the number of manually-drawn vertices changes. */
  onPointsChange?: (count: number) => void;
  /** Fires whenever ManualDraw edit mode toggles. */
  onEditChange?: (editing: boolean) => void;
}

/**
 * Small bridge child that lives inside MapContainer so it can use useMap().
 * Exposes the map instance to the parent via callback, and listens to moveend.
 */
function MapBridge({
  onReady,
  onCenterChange,
}: {
  onReady?: (map: L.Map) => void;
  onCenterChange?: (center: { lat: number; lng: number }) => void;
}) {
  const map = useMap();

  useEffect(() => {
    onReady?.(map);
  }, [map, onReady]);

  useEffect(() => {
    if (!onCenterChange) return;
    const emit = () => {
      const c = map.getCenter();
      onCenterChange({ lat: c.lat, lng: c.lng });
    };
    emit();
    map.on("moveend", emit);
    return () => {
      map.off("moveend", emit);
    };
  }, [map, onCenterChange]);

  return null;
}

/**
 * Inner Leaflet map — only ever imported via dynamic() to avoid SSR errors.
 */
export default function LeafletMap({
  parcel,
  drawMode,
  selectedDate,
  availableDates,
  onManualConfirm,
  onManualCancel,
  basemap: controlledBasemap,
  onBasemapChange,
  onMapReady,
  onCenterChange,
  hideInMapControls = false,
  onManualDrawApi,
  onPointsChange,
  onEditChange,
}: LeafletMapProps) {
  const controlled = controlledBasemap !== undefined;
  const [internalBasemap, setInternalBasemap] = useState<BasemapType>(
    drawMode ? "hybrid" : "street",
  );

  const basemap: BasemapType = controlled ? (controlledBasemap as BasemapType) : internalBasemap;
  const setBasemap = (next: BasemapType) => {
    if (onBasemapChange) onBasemapChange(next);
    if (!controlled) setInternalBasemap(next);
  };

  const tile = BASEMAP_TILES[basemap];
  const showLabels = basemap === "hybrid";

  return (
    <LeafletMapContainer
      center={MAP_DEFAULTS.center}
      zoom={MAP_DEFAULTS.zoom}
      minZoom={MAP_DEFAULTS.minZoom}
      maxZoom={MAP_DEFAULTS.maxZoom}
      className="h-full w-full"
      style={{ height: "100%", width: "100%" }}
      zoomControl={!hideInMapControls}
      doubleClickZoom={!drawMode}
    >
      <MapBridge onReady={onMapReady} onCenterChange={onCenterChange} />

      <TileLayer
        key={basemap}
        attribution={tile.attribution}
        url={tile.url}
        maxZoom={tile.maxZoom}
      />

      {showLabels && (
        <TileLayer
          url={BASEMAP_LABELS_URL}
          maxZoom={19}
          pane="overlayPane"
        />
      )}

      {!hideInMapControls && (
        <BasemapToggle basemap={basemap} onChange={setBasemap} />
      )}

      {parcel && !drawMode && (
        <>
          <SatelliteLayer date={selectedDate} parcel={parcel} availableDates={availableDates} />
          <ParcelPolygon polygon={parcel.polygon} bbox={parcel.bbox} />
        </>
      )}

      {drawMode && (
        <ManualDraw
          onConfirm={onManualConfirm}
          onCancel={onManualCancel}
          hideControls={hideInMapControls}
          onApiReady={onManualDrawApi}
          onPointsChange={onPointsChange}
          onEditChange={onEditChange}
        />
      )}

      {!drawMode && !hideInMapControls && <LocationSearch />}
    </LeafletMapContainer>
  );
}
