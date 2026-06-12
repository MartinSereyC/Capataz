import type { ClimaDiario } from './types';
import { calcularEt0Hargreaves } from '../engine/et0';

// Serie climática sintética determinista para modo MOCK: sinusoide estacional
// de hemisferio sur (verano dic-feb, lluvias de invierno jun-ago, clima
// mediterráneo de Chile central), sembrada desde lat/lng como los demás mocks.
// origen: 'mock' — la UI debe etiquetarla como dato simulado.

function hash01(...vals: number[]): number {
  let h = 0;
  for (const v of vals) h = Math.sin(h * 12.9898 + v * 78.233) * 43758.5453;
  return Math.abs(h - Math.floor(h));
}

function dayOfYear(fecha: string): number {
  const [y, m, d] = fecha.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86_400_000) + 1;
}

function* fechasEnRango(desde: string, hasta: string): Generator<string> {
  const [y1, m1, d1] = desde.split('-').map(Number);
  const [y2, m2, d2] = hasta.split('-').map(Number);
  const fin = Date.UTC(y2, m2 - 1, d2);
  let t = Date.UTC(y1, m1 - 1, d1);
  while (t <= fin) {
    yield new Date(t).toISOString().split('T')[0];
    t += 86_400_000;
  }
}

export function mockClimaRange(
  lat: number,
  lon: number,
  desde: string,
  hasta: string,
  esPronostico = false,
): ClimaDiario[] {
  const result: ClimaDiario[] = [];

  for (const fecha of fechasEnRango(desde, hasta)) {
    const doy = dayOfYear(fecha);
    // Fase estacional: máximo el 15 de enero (doy 15), hemisferio sur
    const estacional = Math.cos((2 * Math.PI * (doy - 15)) / 365);

    const ruidoT = (hash01(lat, lon, doy) - 0.5) * 6;
    const tMax = 22 + 8 * estacional + ruidoT;
    const tMin = tMax - (9 + 3 * hash01(lon, doy, lat));

    // Lluvia concentrada en invierno (estacional < 0): probabilidad y monto
    const probLluvia = estacional < -0.2 ? 0.3 : 0.05;
    const dado = hash01(doy, lat + lon, doy * 2);
    const precipitacionMm = dado < probLluvia
      ? Math.round(hash01(doy * 3, lat, lon) * 25 * 10) / 10
      : 0;

    const et0 = calcularEt0Hargreaves(tMin, tMax, lat, doy);

    result.push({
      fecha,
      tMin: Math.round(tMin * 10) / 10,
      tMax: Math.round(tMax * 10) / 10,
      precipitacionMm,
      et0Mm: Math.round(et0 * 100) / 100,
      esPronostico,
      origen: 'mock',
    });
  }

  return result;
}
