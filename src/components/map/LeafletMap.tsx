"use client";

import { useEffect, useState } from "react";
import { MapContainer as LeafletMapContainer, TileLayer, Polygon, Tooltip, Pane, useMap } from "react-leaflet";
import L from "leaflet";
import type { Parcel } from "@/types";
import type { MapZone } from "./MapContainer";
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
  /** Seed initial vertices for ManualDraw. */
  initialDrawPoints?: [number, number][];
  /** Extra polygons to render on top of the map. */
  zones?: MapZone[];
  /** If provided, ManualDraw will reject clicks outside this polygon. */
  boundary?: import("@/types").GeoJSONPolygon;
  /** Fires when the user clicks a zone polygon. */
  onZoneClick?: (id: number | string) => void;
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
  initialDrawPoints,
  zones,
  boundary,
  onZoneClick,
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

      <Pane name="satelliteImagePane" style={{ zIndex: 250 }} />

      {parcel && !drawMode && (
        <SatelliteLayer date={selectedDate} parcel={parcel} availableDates={availableDates} />
      )}

      {parcel && (
        <ParcelPolygon polygon={parcel.polygon} bbox={parcel.bbox} />
      )}

      {zones?.map((z) => {
        const ring = z.polygon.coordinates[0] as [number, number][];
        const positions = ring.map(([lng, lat]) => [lat, lng] as [number, number]);
        const color = z.color ?? "#2d6a3e";
        return (
          <Polygon
            key={z.id}
            positions={positions}
            pathOptions={{ color: '#ffffff', weight: 3, fillOpacity: 0, opacity: 1 }}
            eventHandlers={onZoneClick ? { click: () => onZoneClick(z.id) } : undefined}
          >
            {z.label && <Tooltip permanent direction="center">{z.label}</Tooltip>}
          </Polygon>
        );
      })}

      {drawMode && (
        <ManualDraw
          onConfirm={onManualConfirm}
          onCancel={onManualCancel}
          hideControls={hideInMapControls}
          initialPoints={initialDrawPoints}
          onApiReady={onManualDrawApi}
          onPointsChange={onPointsChange}
          onEditChange={onEditChange}
          boundary={boundary}
        />
      )}

      {!drawMode && !hideInMapControls && <LocationSearch />}
    </LeafletMapContainer>
  );
}
