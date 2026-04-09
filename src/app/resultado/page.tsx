"use client";

import { useState, useCallback, useEffect } from "react";
import { MapContainer } from "@/components/map/MapContainer";
import { TimeSlider } from "@/components/controls/TimeSlider";
import { ImageInfo } from "@/components/controls/ImageInfo";
import { useParcelContext } from "@/context/ParcelContext";
import { useSatelliteDates } from "@/hooks/useSatelliteDates";
import { es } from "@/lib/i18n/es";
import type { Parcel } from "@/types";

export default function ResultadoPage() {
  const {
    parcel,
    parcelSource,
    setParcel,
    availableDates,
    cloudCoverage,
    selectedDate,
    setSelectedDate,
    setDates,
  } = useParcelContext();

  const [drawMode, setDrawMode] = useState(false);

  // Fetch satellite dates when parcel exists
  // The hook caches internally so re-renders don't re-fetch
  const {
    dates: fetchedDates,
    cloudCoverage: fetchedCoverage,
    loading: datesLoading,
  } = useSatelliteDates(parcel?.bbox ?? null);

  // Sync fetched dates into context (if not already loaded from upload flow)
  useEffect(() => {
    if (fetchedDates.length > 0 && availableDates.length === 0) {
      setDates(fetchedDates, fetchedCoverage);
    }
  }, [fetchedDates, fetchedCoverage, availableDates.length, setDates]);

  // Use context dates (may come from upload flow or from hook sync above)
  const dates = availableDates.length > 0 ? availableDates : fetchedDates;
  const coverage = Object.keys(cloudCoverage).length > 0 ? cloudCoverage : fetchedCoverage;

  const handleManualConfirm = useCallback(
    (drawnParcel: Parcel) => {
      setParcel(drawnParcel, "manual");
      setDrawMode(false);
    },
    [setParcel],
  );

  const handleManualCancel = useCallback(() => {
    setDrawMode(false);
  }, []);

  const handleStartDraw = useCallback(() => {
    setDrawMode(true);
  }, []);

  const handleDateChange = useCallback(
    (date: string) => {
      setSelectedDate(date);
    },
    [setSelectedDate],
  );

  return (
    <main className="flex flex-col h-screen">
      {/* Map — takes primary viewport space */}
      <div className="flex-1 relative min-h-0">
        <MapContainer
          parcel={parcel}
          drawMode={drawMode}
          onManualConfirm={handleManualConfirm}
          onManualCancel={handleManualCancel}
        />

        {/* Image info overlay — top left */}
        {parcel && selectedDate && (
          <div className="absolute top-4 left-4 z-[1000]">
            <ImageInfo
              date={selectedDate}
              cloudCoverage={coverage[selectedDate] ?? 0}
            />
          </div>
        )}

        {/* Manual draw trigger — top right */}
        {!drawMode && (
          <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
            <button
              type="button"
              onClick={handleStartDraw}
              className="px-4 py-2 bg-white text-gray-700 text-sm font-semibold rounded-lg shadow border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              {es.extraction.drawManually}
            </button>

            {parcelSource === "manual" && (
              <span className="text-xs text-center text-gray-500 bg-white/90 rounded px-2 py-1 shadow">
                Perímetro dibujado manualmente
              </span>
            )}
          </div>
        )}

        {/* No parcel notice */}
        {!parcel && !drawMode && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-white/95 backdrop-blur-sm rounded-xl px-6 py-4 shadow-lg text-center max-w-sm pointer-events-auto">
              <p className="text-gray-700 text-sm mb-3">
                {es.extraction.noCoordinates}
              </p>
              <button
                type="button"
                onClick={handleStartDraw}
                className="px-5 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors"
              >
                {es.extraction.drawManually}
              </button>
            </div>
          </div>
        )}

        {/* Back to home link */}
        <div className="absolute bottom-4 left-4 z-[1000]">
          <a
            href="/"
            className="px-3 py-2 bg-white/90 text-gray-600 text-xs font-medium rounded-lg shadow border border-gray-200 hover:bg-white transition-colors"
          >
            ← Subir otro documento
          </a>
        </div>
      </div>

      {/* Time Slider */}
      <div className="bg-gray-50 border-t border-gray-200 flex items-center justify-center p-2">
        {parcel && dates.length > 0 ? (
          <TimeSlider
            dates={dates}
            cloudCoverage={coverage}
            selectedDate={selectedDate}
            onDateChange={handleDateChange}
          />
        ) : parcel && datesLoading ? (
          <p className="text-gray-400 text-sm py-3">
            {es.progress.loading}
          </p>
        ) : (
          <p className="text-gray-400 text-xs py-3">
            {es.slider.noImages}
          </p>
        )}
      </div>
    </main>
  );
}
