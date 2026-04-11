import type { ClimaDiario } from './types';
import { obtenerClimaHistoricoYForecast } from './open-meteo';
import { generarClimaMock } from './mock';

export type { ClimaDiario } from './types';

function useMock(): boolean {
  return process.env.USE_MOCK_CLIMA === 'true' || process.env.NODE_ENV === 'test';
}

export async function obtenerClima(
  lat: number,
  lon: number,
  diasHistorico: number = 7,
  diasForecast: number = 7
): Promise<ClimaDiario[]> {
  if (useMock()) {
    const desde = new Date();
    desde.setDate(desde.getDate() - diasHistorico);
    return generarClimaMock(lat, lon, desde, diasHistorico + diasForecast);
  }
  return obtenerClimaHistoricoYForecast(lat, lon, diasHistorico, diasForecast);
}
