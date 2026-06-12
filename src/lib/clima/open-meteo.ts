import type { ClimaDiario } from './types';

const BASE_URL = 'https://api.open-meteo.com/v1/forecast';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CIRCUIT_BREAKER_THRESHOLD = 3;

type CacheEntry = {
  data: ClimaDiario[];
  timestamp: number;
};

const cache = new Map<string, CacheEntry>();
const failureCounts = new Map<string, number>();

// Fecha local de Santiago (las series de Open-Meteo vienen en esa zona horaria)
export function hoyLocalSantiago(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

export async function obtenerClimaHistoricoYForecast(
  lat: number,
  lon: number,
  diasHistorico: number,
  diasForecast: number
): Promise<ClimaDiario[]> {
  const key = `${lat},${lon}`;

  const failures = failureCounts.get(key) ?? 0;
  if (failures >= CIRCUIT_BREAKER_THRESHOLD) {
    const cached = cache.get(key);
    if (cached) return cached.data;
    throw new Error(`Circuit breaker open for ${key}: ${failures} consecutive failures`);
  }

  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    daily: 'temperature_2m_min,temperature_2m_max,precipitation_sum,et0_fao_evapotranspiration',
    past_days: String(diasHistorico),
    forecast_days: String(diasForecast),
    timezone: 'America/Santiago',
  });

  const url = `${BASE_URL}?${params.toString()}`;

  let response: Response;
  try {
    response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch (err) {
    const newCount = (failureCounts.get(key) ?? 0) + 1;
    failureCounts.set(key, newCount);
    const stale = cache.get(key);
    if (stale) return stale.data;
    throw err;
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch (err) {
    const newCount = (failureCounts.get(key) ?? 0) + 1;
    failureCounts.set(key, newCount);
    const stale = cache.get(key);
    if (stale) return stale.data;
    throw err;
  }

  const data = json as {
    daily: {
      time: string[];
      temperature_2m_min: number[];
      temperature_2m_max: number[];
      precipitation_sum: number[];
      et0_fao_evapotranspiration?: (number | null)[];
    };
  };

  const hoy = hoyLocalSantiago();
  const result: ClimaDiario[] = data.daily.time.map((fecha, i) => ({
    fecha,
    tMin: data.daily.temperature_2m_min[i],
    tMax: data.daily.temperature_2m_max[i],
    precipitacionMm: data.daily.precipitation_sum[i] ?? 0,
    et0Mm: data.daily.et0_fao_evapotranspiration?.[i] ?? null,
    esPronostico: fecha > hoy,
    origen: 'open_meteo' as const,
    raw: json,
  }));

  failureCounts.set(key, 0);
  cache.set(key, { data: result, timestamp: Date.now() });

  return result;
}

export { cache, failureCounts };
