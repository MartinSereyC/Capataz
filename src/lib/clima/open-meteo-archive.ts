import type { ClimaDiario } from './types';

// Cliente del Open-Meteo Archive API (reanálisis ERA5): clima diario histórico
// con ET0 FAO incluido. Una sola llamada cubre los 14 meses de backfill.
// El archivo llega con ~5 días de rezago; el hueco se cubre con el forecast
// API (past_days) y upserts donde el dato observado gana al pronóstico.
const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';

export async function obtenerClimaArchivo(
  lat: number,
  lon: number,
  desde: string, // YYYY-MM-DD
  hasta: string,
): Promise<ClimaDiario[]> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    start_date: desde,
    end_date: hasta,
    daily: 'temperature_2m_min,temperature_2m_max,precipitation_sum,et0_fao_evapotranspiration',
    timezone: 'America/Santiago',
  });

  const res = await fetch(`${ARCHIVE_URL}?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Open-Meteo archive error: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as {
    daily: {
      time: string[];
      temperature_2m_min: (number | null)[];
      temperature_2m_max: (number | null)[];
      precipitation_sum: (number | null)[];
      et0_fao_evapotranspiration?: (number | null)[];
    };
  };

  return json.daily.time
    .map((fecha, i): ClimaDiario => ({
      fecha,
      tMin: json.daily.temperature_2m_min[i] ?? 0,
      tMax: json.daily.temperature_2m_max[i] ?? 0,
      precipitacionMm: json.daily.precipitation_sum[i] ?? 0,
      et0Mm: json.daily.et0_fao_evapotranspiration?.[i] ?? null,
      esPronostico: false,
      origen: 'open_meteo_archive',
    }))
    // El archivo rellena con null los días aún no procesados — descartarlos
    .filter((_, i) => json.daily.temperature_2m_min[i] !== null);
}
