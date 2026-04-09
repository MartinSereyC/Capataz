"use client";

/**
 * ImageInfo — Compact display of current satellite image metadata.
 * Shows: selected date, cloud coverage %, source "Sentinel-2".
 * Designed as a map overlay or sidebar widget.
 */

import { es } from "@/lib/i18n/es";

interface ImageInfoProps {
  date: string | null;
  cloudCoverage: number | null;
}

/** Format YYYY-MM-DD to a readable Spanish date */
function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("es-CL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ImageInfo({ date, cloudCoverage }: ImageInfoProps) {
  if (!date) return null;

  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-white/90 backdrop-blur-sm rounded-lg shadow text-xs text-gray-700">
      <span className="font-semibold text-gray-500 uppercase tracking-wide">Sentinel-2</span>
      <span className="text-gray-300">|</span>
      <span>
        {es.slider.dateLabel}: <span className="font-medium text-gray-800">{formatDate(date)}</span>
      </span>
      {cloudCoverage !== null && (
        <>
          <span className="text-gray-300">|</span>
          <span>
            {es.slider.cloudCoverage}: <span className="font-medium">{cloudCoverage}%</span>
          </span>
        </>
      )}
    </div>
  );
}
