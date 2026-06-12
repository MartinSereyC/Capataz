// Paso diario del balance hídrico FAO-56 (modelo de estanque en zona radicular).
// Dr (agotamiento) sube con ETc y baja con precipitación efectiva + riego.
// Funciones puras, sin I/O.

export interface EstadoBalance {
  agotamientoMm: number; // Dr: agotamiento de la zona radicular, 0..TAW
  tawMm: number;
  rawMm: number;
}

export interface EntradaDia {
  fecha: string; // YYYY-MM-DD
  et0Mm: number;
  kc: number;
  precipMm: number;
  riegoMm: number;
  riegoAsumido: boolean; // true cuando no hay registro y se asume riego = 0
}

export interface ResultadoPaso {
  fecha: string;
  et0Mm: number;
  kc: number;
  ks: number;
  etcMm: number;
  precipMm: number;
  precipEfectivaMm: number;
  riegoMm: number;
  riegoAsumido: boolean;
  tawMm: number;
  rawMm: number;
  agotamientoMm: number; // Dr al final del día
  deficitPct: number; // Dr/TAW × 100
}

// Precipitación efectiva — USDA-SCS simplificado (mismo criterio que engine/balance.ts):
// < 5 mm no infiltra; el resto se toma al 80%.
export function precipitacionEfectiva(precipMm: number): number {
  if (precipMm < 5) return 0;
  return precipMm * 0.8;
}

// Coeficiente de estrés Ks (FAO-56 ec. 84): 1 mientras Dr ≤ RAW,
// luego decae linealmente hasta 0 en Dr = TAW.
export function calcularKs(agotamientoMm: number, tawMm: number, rawMm: number): number {
  if (agotamientoMm <= rawMm) return 1;
  if (tawMm <= rawMm) return 1;
  return Math.max(0, (tawMm - agotamientoMm) / (tawMm - rawMm));
}

export function pasoDiario(prev: EstadoBalance, dia: EntradaDia): ResultadoPaso {
  const ks = calcularKs(prev.agotamientoMm, prev.tawMm, prev.rawMm);
  const etcMm = ks * dia.kc * dia.et0Mm;
  const precipEfectivaMm = precipitacionEfectiva(dia.precipMm);

  const crudo = prev.agotamientoMm + etcMm - precipEfectivaMm - dia.riegoMm;
  const agotamientoMm = Math.max(0, Math.min(prev.tawMm, crudo));

  return {
    fecha: dia.fecha,
    et0Mm: dia.et0Mm,
    kc: dia.kc,
    ks,
    etcMm,
    precipMm: dia.precipMm,
    precipEfectivaMm,
    riegoMm: dia.riegoMm,
    riegoAsumido: dia.riegoAsumido,
    tawMm: prev.tawMm,
    rawMm: prev.rawMm,
    agotamientoMm,
    deficitPct: (agotamientoMm / prev.tawMm) * 100,
  };
}
