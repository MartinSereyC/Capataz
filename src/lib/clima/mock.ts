import type { ClimaDiario } from './types';

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function generarClimaMock(
  lat: number,
  lon: number,
  desde: Date,
  dias: number
): ClimaDiario[] {
  const seed = Math.floor(lat * 100) + Math.floor(lon * 100);
  const rand = lcg(seed);

  // Pre-generate rain days: pick 3-5 indices deterministically
  const numRainDays = 3 + Math.floor(rand() * 3); // 3, 4, or 5
  const rainDaySet = new Set<number>();
  while (rainDaySet.size < numRainDays) {
    rainDaySet.add(Math.floor(rand() * dias));
  }

  const result: ClimaDiario[] = [];

  for (let i = 0; i < dias; i++) {
    const tMin = 5 + rand() * 13; // 5-18
    const tMax = 15 + rand() * 17; // 15-32
    const precipitacionMm = rainDaySet.has(i) ? 2 + rand() * 13 : 0; // 2-15mm on rain days

    const d = new Date(desde);
    d.setDate(d.getDate() + i);
    const fecha = d.toISOString().slice(0, 10);

    result.push({
      fecha,
      tMin: parseFloat(tMin.toFixed(1)),
      tMax: parseFloat(tMax.toFixed(1)),
      precipitacionMm: parseFloat(precipitacionMm.toFixed(1)),
      origen: 'mock',
    });
  }

  return result;
}
