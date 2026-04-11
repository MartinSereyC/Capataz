// Tipos del motor FAO-56 coef. único. Contrato público: timing, nunca volumen.

export type Semaforo = "verde" | "amarillo" | "rojo";
export type Timing = "hoy" | "mañana" | "3-4 días" | "no urgente";
export type Prioridad = "alta" | "media" | "baja";
export type Confianza = "baja" | "media" | "alta";
export type FaseFenologica =
  | "brotacion"
  | "floracion"
  | "cuaja"
  | "crecimiento"
  | "maduracion"
  | "cosecha"
  | "postcosecha"
  | "reposo";

export interface ClimaDiario {
  fecha: string; // ISO YYYY-MM-DD
  tMin: number; // °C
  tMax: number; // °C
  precipitacion: number; // mm (crudos; la efectiva se calcula adentro)
  latitudDeg: number;
  diaDelAno: number; // 1..366
}

export interface SueloZona {
  id: string;
  // Umbrales expresados como % de agotamiento del agua disponible.
  umbralRojo: number; // ej 60
  umbralAmarillo: number; // ej 40
  prioridad: Prioridad;
  demandaEstimada: number; // interno, no expuesto
}

export interface Kc {
  fase: FaseFenologica;
  valor: number; // 0..1.3 aprox
}

export interface EstadoHidricoPrevio {
  zonaId: string;
  deficit: number; // 0..100 % agotamiento
  diasDesdeAlta: number;
  erroresReconciliacion: number[]; // historial para promedio
}

export interface RiegoRegistrado {
  zonaId: string;
  mmAplicados: number; // interno
}

export interface EstadoHidricoActual {
  zonaId: string;
  deficit: number; // 0..100
  et0: number; // mm/día (interno)
  etc: number; // et0*kc (interno)
  precipitacionEfectiva: number; // mm (interno)
}

// contrato público: timing, nunca volumen
export interface Recomendacion {
  zonaId: string;
  semaforo: Semaforo;
  timing: Timing;
  confianza: Confianza;
  postergada: boolean;
  razon: string;
}
