export type ClimaDiario = {
  fecha: string; // YYYY-MM-DD
  tMin: number;
  tMax: number;
  precipitacionMm: number;
  origen: 'open_meteo' | 'mock';
  raw?: unknown;
};
