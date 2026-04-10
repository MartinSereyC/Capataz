/**
 * Capataz constants — Chile geography, Sentinel config, UTM definitions.
 */

// --- Chile Bounding Box (WGS84) ---
export const CHILE_BOUNDS = {
  minLat: -56,
  maxLat: -17,
  minLng: -76,
  maxLng: -66,
} as const;

// --- UTM Zone Definitions for Chile ---
export const UTM_ZONES = {
  18: {
    epsg: 32718,
    proj4: "+proj=utm +zone=18 +south +datum=WGS84 +units=m +no_defs",
    label: "Huso 18S",
    /** Typical Easting range for Chilean territory in Zone 18S */
    eastingRange: [500_000, 900_000] as const,
  },
  19: {
    epsg: 32719,
    proj4: "+proj=utm +zone=19 +south +datum=WGS84 +units=m +no_defs",
    label: "Huso 19S",
    /** Typical Easting range for Chilean territory in Zone 19S */
    eastingRange: [150_000, 500_000] as const,
  },
} as const;

// --- Sentinel Hub / Copernicus Data Space ---
export const SENTINEL_CONFIG = {
  /** OAuth2 token endpoint */
  tokenUrl:
    "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token",
  /** Process API base URL */
  processApiUrl: "https://sh.dataspace.copernicus.eu",
  /** Catalog API for searching available dates */
  catalogUrl:
    "https://sh.dataspace.copernicus.eu/api/v1/catalog/1.0.0/search",
  /** Default collection */
  collection: "sentinel-2-l2a",
  /** Max cloud coverage filter (percentage) */
  maxCloudCoverage: 100, // show all, let user decide
  /** Default time range in months */
  defaultMonths: 6,
  /** Debounce delay for slider in ms */
  sliderDebounceMs: 300,
  /** Token cache duration (slightly less than 1 hour) */
  tokenCacheMs: 55 * 60 * 1000,
} as const;

// --- Upload Limits ---
export const UPLOAD_LIMITS = {
  maxSizeMB: 10,
  maxSizeBytes: 10 * 1024 * 1024,
  acceptedTypes: ["application/pdf"],
} as const;

// --- Rate Limiting ---
export const RATE_LIMIT = {
  maxRequests: 10,
  windowMs: 60 * 1000, // 1 minute
} as const;

// --- Map Defaults ---
export const MAP_DEFAULTS = {
  /** Center of Chile (roughly Santiago) */
  center: [-33.45, -70.65] as [number, number],
  zoom: 5,
  minZoom: 3,
  maxZoom: 18,
  /** Padding when fitting parcel bounds */
  fitBoundsPadding: [50, 50] as [number, number],
} as const;

// --- Basemap Tile Layers ---
export type BasemapType = "street" | "satellite";

export const BASEMAP_TILES: Record<
  BasemapType,
  { url: string; attribution: string; maxZoom?: number }
> = {
  street: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution:
      "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics",
    maxZoom: 19,
  },
} as const;

export const BASEMAP_LABELS_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";

// --- Nominatim Geocoding ---
export const NOMINATIM_CONFIG = {
  url: "https://nominatim.openstreetmap.org/search",
  debounceMs: 1000,
  minQueryLength: 3,
  maxResults: 5,
} as const;
