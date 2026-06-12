import type { SueloEstimado } from '../suelo/types';

// TAW (total available water, mm) = (θFC − θWP) × Zr × 1000  (FAO-56 ec. 82)
// Capacidad de campo y punto de marchitez vienen en % volumétrico.
export function calcularTawMm(suelo: SueloEstimado, profundidadRaizM: number): number {
  const fraccion = (suelo.capacidadCampoPct - suelo.puntoMarchitezPct) / 100;
  return Math.max(10, fraccion * profundidadRaizM * 1000);
}

// RAW (readily available water, mm) = p × TAW  (FAO-56 ec. 83)
export function calcularRawMm(tawMm: number, fraccionAgotamiento: number): number {
  return fraccionAgotamiento * tawMm;
}
