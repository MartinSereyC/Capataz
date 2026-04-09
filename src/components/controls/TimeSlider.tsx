"use client";

/**
 * TimeSlider — Maps a range input to an array of available satellite dates.
 * Shows cloud coverage per date. Debounced 300ms to avoid excessive callbacks.
 * Touch-friendly. All text in Spanish.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { es } from "@/lib/i18n/es";
import { SENTINEL_CONFIG } from "@/lib/constants";

interface TimeSliderProps {
  dates: string[];
  cloudCoverage: Record<string, number>;
  selectedDate: string | null;
  onDateChange: (date: string) => void;
}

/** Format YYYY-MM-DD to a readable Spanish date, e.g. "12 ene 2025" */
function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("es-CL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Returns a Tailwind color class based on cloud coverage percentage */
function cloudColor(pct: number): string {
  if (pct <= 15) return "text-green-600";
  if (pct <= 35) return "text-yellow-600";
  return "text-red-500";
}

export function TimeSlider({ dates, cloudCoverage, selectedDate, onDateChange }: TimeSliderProps) {
  // Find the index of the currently selected date (default to last)
  const currentIndex = selectedDate ? Math.max(0, dates.indexOf(selectedDate)) : Math.max(0, dates.length - 1);
  const [sliderIndex, setSliderIndex] = useState(currentIndex);

  // Sync slider when selectedDate changes externally
  useEffect(() => {
    const idx = selectedDate ? dates.indexOf(selectedDate) : dates.length - 1;
    if (idx >= 0) setSliderIndex(idx);
  }, [selectedDate, dates]);

  // Debounce ref
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const idx = Number(e.target.value);
      setSliderIndex(idx);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const date = dates[idx];
        if (date) onDateChange(date);
      }, SENTINEL_CONFIG.sliderDebounceMs);
    },
    [dates, onDateChange],
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  if (dates.length === 0) {
    return (
      <div className="px-4 py-3 text-sm text-gray-500 text-center">
        {es.slider.noImages}
      </div>
    );
  }

  const activeDate = dates[sliderIndex] ?? dates[dates.length - 1];
  const coverage = cloudCoverage[activeDate] ?? 0;

  return (
    <div className="flex flex-col gap-3 p-4 bg-white rounded-xl shadow-md w-full max-w-xl">
      {/* Title */}
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
        {es.slider.title}
      </h3>

      {/* Selected date + cloud coverage */}
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-gray-800">
          {es.slider.dateLabel}: <span className="text-green-700">{formatDate(activeDate)}</span>
        </span>
        <span className={`font-medium ${cloudColor(coverage)}`}>
          {es.slider.cloudCoverage}: {coverage}%
        </span>
      </div>

      {/* Range input */}
      <input
        type="range"
        min={0}
        max={dates.length - 1}
        step={1}
        value={sliderIndex}
        onChange={handleChange}
        className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-green-600"
        aria-label={es.slider.title}
      />

      {/* Date tick marks — show first, middle, last */}
      <div className="flex justify-between text-xs text-gray-400 px-0.5">
        <span>{formatDate(dates[0])}</span>
        {dates.length > 2 && (
          <span>{formatDate(dates[Math.floor((dates.length - 1) / 2)])}</span>
        )}
        <span>{formatDate(dates[dates.length - 1])}</span>
      </div>
    </div>
  );
}
