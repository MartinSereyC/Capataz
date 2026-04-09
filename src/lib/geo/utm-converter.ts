/**
 * UTM → WGS84 coordinate converter using proj4.
 * Supports Chilean UTM zones 18S (EPSG:32718) and 19S (EPSG:32719).
 * Zone parameter is NEVER hardcoded — always pass explicitly.
 */

import proj4 from "proj4";
import { UTM_ZONES } from "@/lib/constants";
import type { UTMZone } from "@/types";

// Register both Chilean UTM zone definitions
proj4.defs("EPSG:32718", UTM_ZONES[18].proj4);
proj4.defs("EPSG:32719", UTM_ZONES[19].proj4);

const WGS84 = "EPSG:4326";

export interface WGS84Point {
  lng: number;
  lat: number;
}

/**
 * Convert a single UTM coordinate pair to WGS84 (decimal degrees).
 * @param easting - UTM Easting in metres
 * @param northing - UTM Northing in metres
 * @param zone - UTM zone (18 or 19)
 * @returns WGS84 longitude and latitude
 */
export function utmToWGS84(
  easting: number,
  northing: number,
  zone: UTMZone
): WGS84Point {
  const epsg = `EPSG:${UTM_ZONES[zone].epsg}`;
  const [lng, lat] = proj4(epsg, WGS84, [easting, northing]);
  return { lng, lat };
}

/**
 * Convert an array of UTM [easting, northing] pairs to WGS84 [lng, lat] pairs.
 * @param pairs - Array of [easting, northing] tuples
 * @param zone - UTM zone (18 or 19)
 * @returns Array of [lng, lat] tuples
 */
export function utmPairsToWGS84(
  pairs: [number, number][],
  zone: UTMZone
): [number, number][] {
  return pairs.map(([easting, northing]) => {
    const { lng, lat } = utmToWGS84(easting, northing, zone);
    return [lng, lat];
  });
}
