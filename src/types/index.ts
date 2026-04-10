/**
 * Capataz MVP — Shared Type Definitions
 *
 * BBOX CONVENTION: All bounding boxes follow GeoJSON standard:
 * [minLng, minLat, maxLng, maxLat]
 *
 * Conversion to Leaflet LatLngBounds happens only at the component level.
 */

/** GeoJSON bounding box: [minLng, minLat, maxLng, maxLat] */
export type BboxGeoJSON = [number, number, number, number];

/** Supported UTM zones in Chile */
export type UTMZone = 18 | 19;

/** Coordinate format detected from the land deed */
export type CoordinateFormat = "UTM_18S" | "UTM_19S" | "LATLONG_DECIMAL" | "LATLONG_DMS";

/** GeoJSON Polygon geometry */
export interface GeoJSONPolygon {
  type: "Polygon";
  coordinates: number[][][];
}

/** Extracted parcel data from a land deed */
export interface Parcel {
  coordinates: [number, number][]; // [lng, lat] pairs
  polygon: GeoJSONPolygon;
  bbox: BboxGeoJSON;
  area_hectares: number;
  coordinate_format_detected: CoordinateFormat;
  utm_zone_detected?: UTMZone;
  raw_coordinates: string;
  name?: string;
}

/** Land deed document metadata */
export interface LandDeed {
  file: File | null;
  extracted_text: string;
  raw_coordinates: string;
  coordinate_format: CoordinateFormat | null;
}

/** Satellite image metadata */
export interface SatelliteImage {
  date: string; // ISO date string YYYY-MM-DD
  source: "Sentinel-2";
  bounds: BboxGeoJSON;
  cloud_coverage: number; // percentage 0-100
}

/** Available satellite dates response */
export interface SatelliteDatesResponse {
  dates: string[];
  total: number;
  cloud_coverage: Record<string, number>;
}

/** Sentinel token response */
export interface SentinelTokenResponse {
  token: string;
  expires_in: number;
}

/** Progress step status */
export type ProgressStatus = "pending" | "active" | "done" | "error";

/** Progressive loading step */
export interface ProgressStep {
  id: string;
  label: string;
  status: ProgressStatus;
  order: number;
}

/** Parse deed API success response */
export interface ParseDeedSuccess {
  success: true;
  parcel: Parcel;
}

/** Parse deed API error response */
export interface ParseDeedError {
  success: false;
  error: string;
  message: string;
  extracted_text_preview?: string;
}

export type ParseDeedResponse = ParseDeedSuccess | ParseDeedError;

/** Parcel source: auto-extracted or manually drawn */
export type ParcelSource = "auto" | "manual";

/** Shared app state */
export interface AppState {
  parcel: Parcel | null;
  parcelSource: ParcelSource;
  availableDates: string[];
  cloudCoverage: Record<string, number>;
  selectedDate: string | null;
  sentinelToken: string | null;
}

/** Geocoding result from Nominatim or similar service */
export interface GeocodingResult {
  displayName: string;
  lat: number;
  lng: number;
  boundingbox: [number, number, number, number]; // [south, north, west, east]
}
