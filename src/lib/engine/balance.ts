import type {
  ClimaDiario,
  EstadoHidricoActual,
  EstadoHidricoPrevio,
  Kc,
  RiegoRegistrado,
} from "./types";
import { calcularEt0Hargreaves } from "./et0";

// Precipitación efectiva: modelo simple USDA-SCS truncado.
// < 5 mm no infiltra; resto se toma al 80%.
function precipitacionEfectiva(precipMm: number): number {
  if (precipMm < 5) return 0;
  return precipMm * 0.8;
}

// Convierte mm netos a puntos de agotamiento sobre la curva 0..100.
// Simplificación Fase 1: 1 mm ≈ 1 punto porcentual. Los umbrales están
// calibrados contra esta escala y se reconcilian con NDMI/NDVI.
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
