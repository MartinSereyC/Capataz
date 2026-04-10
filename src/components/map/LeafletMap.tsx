"use client";

import { useState, useEffect } from "react";
import { MapContainer as LeafletMapContainer, TileLayer } from "react-leaflet";
import type { Parcel } from "@/types";
import { MAP_DEFAULTS, BASEMAP_TILES, BASEMAP_LABELS_URL } from "@/lib/constants";
import type { BasemapType } from "@/lib/constants";
import { ParcelPolygon } from "./ParcelPolygon";
import { SatelliteLayer } from "./SatelliteLayer";
import { ManualDraw } from "./ManualDraw";
import { LocationSearch } from "./LocationSearch";
import { BasemapToggle } from "./BasemapToggle";

interface LeafletMapProps {
  parcel: Parcel | null;
  drawMode: boolean;
  selectedDate: string | null;
  availableDates: string[];
  onManualConfirm: (parcel: Parcel) => void;
  onManualCancel: () => void;
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
}: LeafletMapProps) {
  const [basemap, setBasemap] = useState<BasemapType>(
    drawMode ? "satellite" : "street"
  );

  // Auto-switch to satellite when entering draw mode
  useEffect(() => {
    if (drawMode) setBasemap("satellite");
  }, [drawMode]);

  const tile = BASEMAP_TILES[basemap];

  return (
    <LeafletMapContainer
      center={MAP_DEFAULTS.center}
      zoom={MAP_DEFAULTS.zoom}
      minZoom={MAP_DEFAULTS.minZoom}
      maxZoom={MAP_DEFAULTS.maxZoom}
      className="h-full w-full"
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        key={basemap}
        attribution={tile.attribution}
        url={tile.url}
        maxZoom={tile.maxZoom}
      />

      {basemap === "satellite" && (
        <TileLayer
          url={BASEMAP_LABELS_URL}
          maxZoom={19}
          pane="overlayPane"
        />
      )}

      <BasemapToggle basemap={basemap} onChange={setBasemap} />

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
        />
      )}

      {!drawMode && <LocationSearch />}
    </LeafletMapContainer>
  );
}
