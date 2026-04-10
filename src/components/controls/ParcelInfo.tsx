"use client";

/**
 * ParcelInfo — Compact overlay showing parcel metadata.
 * Displays area, detected coordinate format, and vertex count.
 */

import { es } from "@/lib/i18n/es";
import type { Parcel, CoordinateFormat } from "@/types";

interface ParcelInfoProps {
  parcel: Parcel;
}

function formatCoordinateFormat(format: CoordinateFormat): string {
  switch (format) {
    case "UTM_18S":
      return "UTM Huso 18S";
    case "UTM_19S":
      return "UTM Huso 19S";
    case "LATLONG_DECIMAL":
      return "Lat/Long Decimal";
    case "LATLONG_DMS":
      return "Lat/Long DMS";
  }
}

export function ParcelInfo({ parcel }: ParcelInfoProps) {
  return (
    <div className="px-3 py-2 bg-white/90 backdrop-blur-sm rounded-lg shadow text-xs text-gray-700 flex flex-col gap-1 min-w-[160px]">
      <p className="font-semibold text-gray-500 uppercase tracking-wide text-[10px] mb-0.5">
        {es.extraction.parcelInfo}
      </p>
      <div className="flex items-center justify-between gap-3">
        <span className="text-gray-500">{es.extraction.area}</span>
        <span className="font-medium text-gray-800">
          {parcel.area_hectares.toFixed(2)} {es.extraction.hectares}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-gray-500">{es.extraction.format}</span>
        <span className="font-medium text-gray-800">
          {formatCoordinateFormat(parcel.coordinate_format_detected)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-gray-500">{es.extraction.vertices}</span>
        <span className="font-medium text-gray-800">{parcel.coordinates.length}</span>
      </div>
    </div>
  );
}
