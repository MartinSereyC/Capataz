import { getSentinelToken } from '@/lib/sentinel/auth';
import { isMockMode, getMockDates } from '@/lib/sentinel/mock';
import type { BboxGeoJSON } from '@/types';

const CATALOG_URL = 'https://sh.dataspace.copernicus.eu/api/v1/catalog/1.0.0/search';
const SAR_COLLECTION = 'sentinel-1-grd';

interface CatalogFeature {
  properties: {
    datetime: string;
    'sar:instrument_mode'?: string;
    'sat:orbit_state'?: string;
  };
}

interface CatalogResponse {
  features: CatalogFeature[];
}

export interface SarDateEntry {
  date: string; // YYYY-MM-DD
  orbitDirection: 'ascending' | 'descending' | 'unknown';
}

// Returns available Sentinel-1 GRD dates for a bbox in the given time window.
export async function getSarDates(
  bbox: BboxGeoJSON,
  fromDate: string,
  toDate: string,
): Promise<SarDateEntry[]> {
  if (isMockMode()) {
    // Return a subset of mock dates to simulate SAR cadence (~12 days)
    const allDates = getMockDates();
    return allDates
      .filter((_, i) => i % 2 === 0) // every other mock date
      .map((date) => ({ date, orbitDirection: 'descending' as const }));
  }

  const { token } = await getSentinelToken();

  const body = {
    bbox,
    datetime: `${fromDate}T00:00:00Z/${toDate}T23:59:59Z`,
    collections: [SAR_COLLECTION],
    limit: 50,
    fields: {
      include: ['properties.datetime', 'properties.sat:orbit_state'],
    },
  };

  const res = await fetch(CATALOG_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`SAR catalog request failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json() as CatalogResponse;

  const seen = new Set<string>();
  const result: SarDateEntry[] = [];

  for (const feature of data.features) {
    const date = feature.properties.datetime.split('T')[0];
    if (seen.has(date)) continue;
    seen.add(date);
    const orbitRaw = feature.properties['sat:orbit_state'] ?? '';
    const orbitDirection =
      orbitRaw === 'ascending' ? 'ascending'
      : orbitRaw === 'descending' ? 'descending'
      : 'unknown';
    result.push({ date, orbitDirection });
  }

  return result.sort((a, b) => a.date.localeCompare(b.date));
}

// Returns the most recent SAR date within the last N days, or null.
export async function getMostRecentSarDate(
  bbox: BboxGeoJSON,
  withinDays: number,
): Promise<SarDateEntry | null> {
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - withinDays);
  const toStr = today.toISOString().split('T')[0];
  const fromStr = from.toISOString().split('T')[0];

  const dates = await getSarDates(bbox, fromStr, toStr);
  return dates.length > 0 ? dates[dates.length - 1] : null;
}
