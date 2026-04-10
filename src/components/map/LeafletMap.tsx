"use client";

import { MapContainer as LeafletMapContainer, TileLayer } from "react-leaflet";
import type { Parcel } from "@/types";
import { MAP_DEFAULTS } from "@/lib/constants";
import { ParcelPolygon } from "./ParcelPolygon";
import { SatelliteLayer } from "./SatelliteLayer";
import { ManualDraw } from "./ManualDraw";
import { LocationSearch } from "./LocationSearch";

interface LeafletMapProps {
  parcel: Parcel | null;
  drawMode: boolean;
  selectedDate: string | null;
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
  onManualConfirm,
  onManualCancel,
}: LeafletMapProps) {
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
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {parcel && !drawMode && (
        <>
          <SatelliteLayer date={selectedDate} parcel={parcel} />
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
