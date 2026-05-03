import type { ClimaDiario, EstadoHidricoPrevio, EstadoHidricoActual, Kc, RiegoRegistrado } from './types';
import { calcularEt0Hargreaves } from './et0';

// Simple USDA-SCS truncated effective precipitation model.
// < 5 mm doesn't infiltrate; the rest is taken at 80%.
function precipitacionEfectiva(precipMm: number): number {
  if (precipMm < 5) return 0;
  return precipMm * 0.8;
}

// Converts net mm to depletion points on the 0..100 scale.
// Phase 1 simplification: 1 mm ≈ 1 percentage point. Thresholds are
// calibrated against this scale and reconciled with NDMI/NDVI.
function mmAPuntos(mm: number): number {
  return mm;
}

export function proyectarDeficit(
  previo: EstadoHidricoPrevio,
  clima: ClimaDiario,
  kc: Kc,
  riego: RiegoRegistrado | null
): EstadoHidricoActual {
  const et0 = calcularEt0Hargreaves(
    clima.tMin,
    clima.tMax,
    clima.latitudDeg,
    clima.diaDelAno
  );
  const etc = et0 * kc.valor;
  const pEf = precipitacionEfectiva(clima.precipitacion);
  const riegoMm = riego?.mmAplicados ?? 0;

  const delta = mmAPuntos(etc) - mmAPuntos(pEf) - mmAPuntos(riegoMm);
  const crudo = previo.deficit + delta;
  const clamped = Math.max(0, Math.min(100, crudo));

  return {
    zonaId: previo.zonaId,
    deficit: clamped,
    et0,
    etc,
    precipitacionEfectiva: pEf,
  };
}
