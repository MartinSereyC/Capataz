"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import { useMap } from "react-leaflet";
import type { BasemapType } from "@/lib/constants";
import { es } from "@/lib/i18n/es";

interface BasemapToggleProps {
  basemap: BasemapType;
  onChange: (basemap: BasemapType) => void;
}

/**
 * Floating pill toggle on the map to switch between street and satellite basemaps.
 * Positioned top-right, below zoom controls.
 */
export function BasemapToggle({ basemap, onChange }: BasemapToggleProps) {
  const map = useMap();
  const containerRef = useRef<HTMLDivElement>(null);

  // Prevent map clicks/drags when interacting with the toggle
  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      L.DomEvent.disableClickPropagation(el);
      L.DomEvent.disableScrollPropagation(el);
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute top-3 right-3 z-[1000] flex rounded-lg overflow-hidden shadow-lg border border-gray-300"
    >
      <button
        type="button"
        onClick={() => onChange("street")}
        className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
          basemap === "street"
            ? "bg-white text-gray-900"
            : "bg-gray-700/80 text-white/80 hover:bg-gray-600/80"
        }`}
      >
        {es.map.basemapStreet}
      </button>
      <button
        type="button"
        onClick={() => onChange("satellite")}
        className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
          basemap === "satellite"
            ? "bg-white text-gray-900"
            : "bg-gray-700/80 text-white/80 hover:bg-gray-600/80"
        }`}
      >
        {es.map.basemapSatellite}
      </button>
      <button
        type="button"
        onClick={() => onChange("hybrid")}
        className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
          basemap === "hybrid"
            ? "bg-white text-gray-900"
            : "bg-gray-700/80 text-white/80 hover:bg-gray-600/80"
        }`}
      >
        {es.map.basemapHybrid}
      </button>
    </div>
  );
}
