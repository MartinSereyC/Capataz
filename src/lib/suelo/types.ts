export type TexturaSuelo =
  | 'arenoso'
  | 'franco'
  | 'arcilloso'
  | 'franco-arenoso'
  | 'franco-arcilloso';

export interface SueloEstimado {
  lat: number;
  lon: number;
  textura: TexturaSuelo;
  capacidadCampoPct: number;
  puntoMarchitezPct: number;
  origen: 'soilgrids' | 'mock';
  raw?: unknown;
}
