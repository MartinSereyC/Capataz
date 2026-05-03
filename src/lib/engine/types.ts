// Types for the FAO-56 ET0 balance engine.
// ClimaDiario here differs from clima/types.ts — it carries latitudDeg and diaDelAno
// required by the Hargreaves formula. Use the adapter in fusion/engine.ts to convert.

export interface ClimaDiario {
  fecha: string; // ISO YYYY-MM-DD
  tMin: number; // °C
  tMax: number; // °C
  precipitacion: number; // mm crudo (effective precip calculated inside)
  latitudDeg: number;
  diaDelAno: number; // 1..366
}

export interface Kc {
  fase: string;
  valor: number; // 0..1.3 approx
}

export interface EstadoHidricoPrevio {
  zonaId: string;
  deficit: number; // 0..100 % agotamiento
  diasDesdeAlta: number;
  erroresReconciliacion: number[];
}

export interface RiegoRegistrado {
  zonaId: string;
  mmAplicados: number;
}

export interface EstadoHidricoActual {
  zonaId: string;
  deficit: number; // 0..100
  et0: number; // mm/día
  etc: number; // et0*kc
  precipitacionEfectiva: number; // mm
}
