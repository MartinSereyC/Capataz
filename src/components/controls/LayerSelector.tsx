"use client";

import { useState } from "react";
import { useParcelContext } from "@/context/ParcelContext";
import { SATELLITE_LAYERS } from "@/lib/satellite-layers";
import { es } from "@/lib/i18n/es";

export function LayerSelector() {
  const { selectedLayerType, setSelectedLayerType, overlayVisible, setOverlayVisible } = useParcelContext();
  const [open, setOpen] = useState(false);

  const activeMeta = SATELLITE_LAYERS.find((l) => l.id === selectedLayerType)!;

  return (
    <div className="flex flex-col gap-2">
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 px-4 py-2 bg-white/90 backdrop-blur-sm text-gray-700 text-sm font-semibold rounded-lg shadow border border-gray-200 hover:bg-white transition-colors"
      >
        <span
          className="w-3 h-3 rounded-full shrink-0"
          style={{ backgroundColor: activeMeta.iconColor }}
        />
        {activeMeta.name}
        <svg
          className={`w-4 h-4 ml-auto transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded panel */}
      {open && (
        <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 overflow-hidden">
          {SATELLITE_LAYERS.map((layer) => (
            <button
              key={layer.id}
              type="button"
              onClick={() => {
                setSelectedLayerType(layer.id);
                setOpen(false);
              }}
              className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                layer.id === selectedLayerType ? "bg-green-50" : ""
              }`}
            >
              <span
                className={`mt-0.5 w-3 h-3 rounded-full shrink-0 ${
                  layer.id === selectedLayerType ? "ring-2 ring-green-500 ring-offset-1" : ""
                }`}
                style={{ backgroundColor: layer.iconColor }}
              />
              <div className="min-w-0">
                <span className="block text-sm font-semibold text-gray-800">{layer.name}</span>
                <span className="block text-xs text-gray-500">{layer.description}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Legend bar for active layer */}
      <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow border border-gray-200 px-3 py-2">
        <p className="text-[10px] font-medium text-gray-500 mb-1">{es.layers.legend}</p>
        <div className="flex items-center gap-0.5">
          {activeMeta.legend.map((stop) => (
            <div key={stop.label} className="flex-1 flex flex-col items-center gap-0.5">
              <div
                className="w-full h-3 rounded-sm"
                style={{ backgroundColor: stop.color }}
              />
              <span className="text-[8px] text-gray-500 leading-tight text-center">{stop.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Satellite overlay visibility toggle */}
      <label className="flex items-center gap-2 px-3 py-2 bg-white/90 backdrop-blur-sm rounded-lg shadow border border-gray-200 cursor-pointer">
        <input
          type="checkbox"
          checked={overlayVisible}
          onChange={(e) => setOverlayVisible(e.target.checked)}
          className="accent-green-600 w-3.5 h-3.5"
        />
        <span className="text-xs text-gray-700 font-medium select-none">
          {es.layers.showOverlay}
        </span>
      </label>
    </div>
  );
}
