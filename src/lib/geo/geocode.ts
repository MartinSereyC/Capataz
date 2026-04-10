import { CHILE_BOUNDS, NOMINATIM_CONFIG } from "@/lib/constants";
import type { GeocodingResult } from "@/types";

export async function searchLocation(
  query: string,
  signal?: AbortSignal
): Promise<GeocodingResult[]> {
  try {
    const params = new URLSearchParams({
      q: query,
      format: "json",
      countrycodes: "cl",
      limit: `${NOMINATIM_CONFIG.maxResults}`,
      viewbox: `${CHILE_BOUNDS.minLng},${CHILE_BOUNDS.maxLat},${CHILE_BOUNDS.maxLng},${CHILE_BOUNDS.minLat}`,
      bounded: "0",
      "accept-language": "es",
    });

    const response = await fetch(`${NOMINATIM_CONFIG.url}?${params}`, {
      signal,
      headers: { "User-Agent": "Capataz/1.0" },
    });

    if (!response.ok) {
      throw new Error(`Geocoding request failed: ${response.status}`);
    }

    const data = await response.json();

    return data.map(
      (result: {
        display_name: string;
        lat: string;
        lon: string;
        boundingbox: string[];
      }): GeocodingResult => ({
        displayName: result.display_name,
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
        boundingbox: result.boundingbox.map(Number) as [
          number,
          number,
          number,
          number,
        ],
      })
    );
  } catch (error) {
    console.error("Geocoding error:", error);
    return [];
  }
}
