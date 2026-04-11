import type { SueloEstimado, TexturaSuelo } from './types';

interface MockEntry {
  latMin: number;
  latMax: number;
  lonMin: number;
  lonMax: number;
  textura: TexturaSuelo;
  capacidadCampoPct: number;
  puntoMarchitezPct: number;
}

// Approximate bboxes for Chilean central valley comunas
const TABLA: MockEntry[] = [
  // Quillota: coastal range, good loam soils
  {
    latMin: -32.95, latMax: -32.75, lonMin: -71.35, lonMax: -71.15,
    textura: 'franco', capacidadCampoPct: 30, puntoMarchitezPct: 16.5,
  },
  // Los Andes: andean foothills, sandy loam
  {
    latMin: -32.95, latMax: -32.75, lonMin: -70.7, lonMax: -70.5,
    textura: 'franco-arenoso', capacidadCampoPct: 24, puntoMarchitezPct: 13.2,
  },
  // Rancagua: central valley, clay loam
  {
    latMin: -34.25, latMax: -34.05, lonMin: -70.8, lonMax: -70.6,
    textura: 'franco-arcilloso', capacidadCampoPct: 35, puntoMarchitezPct: 19.25,
  },
  // Curicó: central valley south, franco
  {
    latMin: -35.05, latMax: -34.85, lonMin: -71.3, lonMax: -71.1,
    textura: 'franco', capacidadCampoPct: 29, puntoMarchitezPct: 15.95,
  },
  // Buin: Maipo valley, clay
  {
    latMin: -33.85, latMax: -33.65, lonMin: -70.85, lonMax: -70.65,
    textura: 'arcilloso', capacidadCampoPct: 40, puntoMarchitezPct: 22.0,
  },
];

const FALLBACK: Omit<MockEntry, 'latMin' | 'latMax' | 'lonMin' | 'lonMax'> = {
  textura: 'franco',
  capacidadCampoPct: 28,
  puntoMarchitezPct: 15.4,
};

export function obtenerSueloMock(lat: number, lon: number): SueloEstimado {
  const match = TABLA.find(
    (e) => lat >= e.latMin && lat <= e.latMax && lon >= e.lonMin && lon <= e.lonMax
  );

  const { textura, capacidadCampoPct, puntoMarchitezPct } = match ?? FALLBACK;

  return {
    lat,
    lon,
    textura,
    capacidadCampoPct,
    puntoMarchitezPct,
    origen: 'mock',
  };
}
