export type ClimaDiario = {
  fecha: string; // YYYY-MM-DD
  tMin: number;
  tMax: number;
  precipitacionMm: number;
  // ET0 FAO Penman-Monteith entregado por Open-Meteo; null si no disponible
  // (fallback: Hargreaves en el motor de balance).
  et0Mm?: number | null;
  esPronostico?: boolean; // fecha futura (se sobreescribe con el dato real después)
  origen: 'open_meteo' | 'open_meteo_archive' | 'mock';
  raw?: unknown;
};
