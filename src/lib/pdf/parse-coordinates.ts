/**
 * Coordinate extraction engine for Chilean land deeds.
 * Parses raw PDF text and returns coordinate arrays with detected format and UTM zone.
 */

import type { CoordinateFormat, UTMZone } from "@/types";

export interface ParsedCoordinates {
  /** Array of [easting/lng, northing/lat] pairs in original units */
  rawPairs: [number, number][];
  /** Detected coordinate format */
  format: CoordinateFormat;
  /** Detected UTM zone (only present for UTM formats) */
  utmZone?: UTMZone;
  /** Serialized string of raw coordinates for storage */
  rawString: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse a Chilean-formatted number that may use:
 *   - Period as thousands separator: "6.297.515" → 6297515
 *   - Comma as thousands separator: "6,297,515" or "344,899" → 6297515 / 344899
 *   - Comma as decimal separator: "1.234,56" → 1234.56
 *
 * Heuristic:
 *   1. If there are multiple commas → all commas are thousands separators
 *   2. If there is exactly one comma AND the substring after it is exactly 3 digits → thousands separator
 *   3. Otherwise → decimal separator (replace comma with dot)
 *   4. Remove all remaining dots used as thousands separators (3-digit groups between dots)
 */
function normalizeNumber(s: string): number {
  let str = s.trim();

  // Count commas
  const commaCount = (str.match(/,/g) ?? []).length;

  if (commaCount > 1) {
    // Multiple commas → all thousands separators → remove them
    str = str.replace(/,/g, "");
  } else if (commaCount === 1) {
    const afterComma = str.split(",")[1];
    if (/^\d{3}$/.test(afterComma)) {
      // Exactly 3 digits after comma → thousands separator
      str = str.replace(",", "");
    } else {
      // Decimal separator
      str = str.replace(",", ".");
    }
  }

  // Remove periods used as thousands separators (followed by 3 digits)
  str = str.replace(/\.(?=\d{3}(?:[.,]|$))/g, "");

  return parseFloat(str);
}

// ---------------------------------------------------------------------------
// Zone detection
// ---------------------------------------------------------------------------

/**
 * Detect UTM zone from text.
 * Strategy:
 * 1. Explicit keyword: "Huso 18/19", "Zone 18/19", "UTM 18S/19S"
 * 2. Easting heuristic: values >= 500 000 → Zone 18S, else Zone 19S
 * 3. Default → Zone 19S
 */
export function detectUTMZone(text: string, eastings: number[]): UTMZone {
  // 1. Explicit zone keywords
  const explicitMatch = text.match(
    /(?:huso|zone|utm)\s*(18|19)\s*s?/i
  );
  if (explicitMatch) {
    return parseInt(explicitMatch[1], 10) as UTMZone;
  }

  // 2. Easting heuristic
  if (eastings.length > 0) {
    const avgEasting = eastings.reduce((a, b) => a + b, 0) / eastings.length;
    return avgEasting >= 500_000 ? 18 : 19;
  }

  // 3. Default
  return 19;
}

// ---------------------------------------------------------------------------
// UTM patterns
// ---------------------------------------------------------------------------

const UTM_NORTE_ESTE_RE =
  /norte\s*:\s*([\d.,]+)\s*(?:m(?:etros)?\.?)?\s*este\s*:\s*([\d.,]+)/gi;

const UTM_N_E_RE =
  /n\s*[:=]\s*([\d.,]+)\s*[,;]\s*e\s*[:=]\s*([\d.,]+)/gi;

const UTM_PREFIX_RE =
  /(?:utm|huso\s*1[89]\s*s?)[\s:]*(?:norte|n)\s*[:=]?\s*([\d.,]+)[\s,;]+(?:este|e)\s*[:=]?\s*([\d.,]+)/gi;

function extractUTMPairs(text: string): [number, number][] {
  const pairs: [number, number][] = [];
  const seen = new Set<string>();

  const addPair = (northStr: string, eastStr: string) => {
    const north = normalizeNumber(northStr);
    const east = normalizeNumber(eastStr);
    if (!isNaN(north) && !isNaN(east)) {
      const key = `${north},${east}`;
      if (!seen.has(key)) {
        seen.add(key);
        pairs.push([east, north]); // [easting, northing]
      }
    }
  };

  // Run all UTM patterns
  for (const re of [UTM_PREFIX_RE, UTM_NORTE_ESTE_RE, UTM_N_E_RE]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      addPair(m[1], m[2]);
    }
  }

  return pairs;
}

// ---------------------------------------------------------------------------
// Decimal lat/long pattern
// ---------------------------------------------------------------------------

const DECIMAL_LATLONG_RE =
  /(-?\d{1,2}\.\d{4,8})\s*[,;]\s*(-?\d{2,3}\.\d{4,8})/g;

function extractDecimalPairs(text: string): [number, number][] {
  const pairs: [number, number][] = [];
  const seen = new Set<string>();
  DECIMAL_LATLONG_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = DECIMAL_LATLONG_RE.exec(text)) !== null) {
    const lat = parseFloat(m[1]);
    const lng = parseFloat(m[2]);
    if (!isNaN(lat) && !isNaN(lng)) {
      const key = `${lat},${lng}`;
      if (!seen.has(key)) {
        seen.add(key);
        pairs.push([lng, lat]); // [lng, lat]
      }
    }
  }
  return pairs;
}

// ---------------------------------------------------------------------------
// DMS pattern
// ---------------------------------------------------------------------------

const DMS_RE =
  /(\d{1,2})°\s*(\d{1,2})['\u2019\u2032]\s*(\d{1,2}(?:\.\d+)?)["\u201d\u2033]?\s*([NS])[\s,;]+(\d{2,3})°\s*(\d{1,2})['\u2019\u2032]\s*(\d{1,2}(?:\.\d+)?)["\u201d\u2033]?\s*([EWO])/gi;

function dmsToDecimal(
  deg: number,
  min: number,
  sec: number,
  dir: string
): number {
  const decimal = deg + min / 60 + sec / 3600;
  return dir.toUpperCase() === "S" || dir.toUpperCase() === "W" || dir.toUpperCase() === "O"
    ? -decimal
    : decimal;
}

function extractDMSPairs(text: string): [number, number][] {
  const pairs: [number, number][] = [];
  const seen = new Set<string>();
  DMS_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = DMS_RE.exec(text)) !== null) {
    const lat = dmsToDecimal(
      parseFloat(m[1]),
      parseFloat(m[2]),
      parseFloat(m[3]),
      m[4]
    );
    const lng = dmsToDecimal(
      parseFloat(m[5]),
      parseFloat(m[6]),
      parseFloat(m[7]),
      m[8]
    );
    if (!isNaN(lat) && !isNaN(lng)) {
      const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;
      if (!seen.has(key)) {
        seen.add(key);
        pairs.push([lng, lat]);
      }
    }
  }
  return pairs;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Parse coordinates from raw PDF text extracted from a Chilean land deed.
 * Returns null if no valid coordinate set is found.
 */
export function parseCoordinates(text: string): ParsedCoordinates | null {
  if (!text || text.trim().length === 0) return null;

  // 1. Try UTM first (most common in Chilean deeds)
  const utmPairs = extractUTMPairs(text);
  if (utmPairs.length >= 3) {
    const eastings = utmPairs.map(([e]) => e);
    const zone = detectUTMZone(text, eastings);
    const format: CoordinateFormat = zone === 18 ? "UTM_18S" : "UTM_19S";
    return {
      rawPairs: utmPairs,
      format,
      utmZone: zone,
      rawString: utmPairs.map(([e, n]) => `E:${e} N:${n}`).join(" | "),
    };
  }

  // 2. Try DMS
  const dmsPairs = extractDMSPairs(text);
  if (dmsPairs.length >= 3) {
    return {
      rawPairs: dmsPairs,
      format: "LATLONG_DMS",
      rawString: dmsPairs.map(([lng, lat]) => `${lat},${lng}`).join(" | "),
    };
  }

  // 3. Try decimal lat/lng
  const decimalPairs = extractDecimalPairs(text);
  if (decimalPairs.length >= 3) {
    return {
      rawPairs: decimalPairs,
      format: "LATLONG_DECIMAL",
      rawString: decimalPairs
        .map(([lng, lat]) => `${lat},${lng}`)
        .join(" | "),
    };
  }

  return null;
}
