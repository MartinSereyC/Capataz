import { obtenerSueloMock } from './mock';
import { obtenerSuelo as obtenerSueloReal } from './soilgrids';
import { muestrearPredioYZonas } from './heterogeneidad';
import type { SueloEstimado, SueloPredio } from './types';

const useMock =
  process.env.USE_MOCK_SUELO === 'true' || process.env.NODE_ENV === 'test';

export async function obtenerSuelo(lat: number, lon: number): Promise<SueloEstimado> {
  if (useMock) {
    return Promise.resolve(obtenerSueloMock(lat, lon));
  }
  return obtenerSueloReal(lat, lon);
}

export async function muestrearPredio(
  predioLat: number,
  predioLon: number,
  zonas: Array<{ id: string; lat: number; lon: number }>
): Promise<SueloPredio> {
  const client = useMock
    ? (lat: number, lon: number) => Promise.resolve(obtenerSueloMock(lat, lon))
    : obtenerSueloReal;

  return muestrearPredioYZonas(predioLat, predioLon, zonas, client);
}

export type { SueloEstimado, SueloPredio } from './types';
