"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { searchLocation } from "@/lib/geo/geocode";
import { es } from "@/lib/i18n/es";
import { NOMINATIM_CONFIG } from "@/lib/constants";
import type { GeocodingResult } from "@/types";

/**
 * LocationSearch — floating search bar overlaid on the map.
 * Lets the user search for a place and fly the map to it.
 * Must be rendered inside a react-leaflet MapContainer.
 */
export function LocationSearch() {
  const map = useMap();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Click-outside closes dropdown
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.length < NOMINATIM_CONFIG.minQueryLength) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsLoading(true);
      setError(null);

      try {
        const found = await searchLocation(value, controller.signal);
        setResults(found);
        setIsOpen(true);
        setActiveIndex(-1);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(es.search.error);
      } finally {
        setIsLoading(false);
      }
    }, NOMINATIM_CONFIG.debounceMs);
  }, []);

  const handleSelect = useCallback(
    (result: GeocodingResult) => {
      // boundingbox: [south, north, west, east]
      const [south, north, west, east] = result.boundingbox;
      map.fitBounds(L.latLngBounds([south, west], [north, east]));
      setQuery("");
      setResults([]);
      setIsOpen(false);
      setActiveIndex(-1);
    },
    [map],
  );

  const handleClear = useCallback(() => {
    setQuery("");
    setResults([]);
    setIsOpen(false);
    setActiveIndex(-1);
    abortRef.current?.abort();
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowDown") {
        setActiveIndex((prev) => Math.min(prev + 1, results.length - 1));
        setIsOpen(true);
      } else if (e.key === "ArrowUp") {
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        if (activeIndex >= 0 && results[activeIndex]) {
          handleSelect(results[activeIndex]);
        }
      } else if (e.key === "Escape") {
        setIsOpen(false);
      }
    },
    [activeIndex, results, handleSelect],
  );

  return (
    <div
      ref={containerRef}
      className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] w-full max-w-sm px-4 sm:px-0"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="relative">
        {/* Search icon — left side */}
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>

        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder={es.search.placeholder}
          className="w-full pl-10 pr-10 py-2.5 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />

        {/* Right side: spinner or clear button */}
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 border-2 border-gray-300 border-t-green-500 rounded-full animate-spin" />
          </div>
        )}
        {query && !isLoading && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            aria-label={es.search.clear}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {/* Dropdown */}
        {isOpen && (
          <div className="absolute top-full mt-1 w-full bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 overflow-hidden">
            {isLoading && (
              <div className="px-4 py-3 text-sm text-gray-500">{es.search.loading}</div>
            )}
            {error && (
              <div className="px-4 py-3 text-sm text-red-500">{es.search.error}</div>
            )}
            {!isLoading && !error && results.length === 0 && query.length >= NOMINATIM_CONFIG.minQueryLength && (
              <div className="px-4 py-3 text-sm text-gray-500">{es.search.noResults}</div>
            )}
            {results.map((result, index) => (
              <button
                key={`${result.lat}-${result.lng}`}
                type="button"
                onClick={() => handleSelect(result)}
                className={`w-full px-4 py-3 text-left text-sm hover:bg-gray-100 transition-colors ${
                  index === activeIndex ? "bg-gray-100" : ""
                } ${index < results.length - 1 ? "border-b border-gray-100" : ""}`}
              >
                <span className="text-gray-900 line-clamp-2">{result.displayName}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
