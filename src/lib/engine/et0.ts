// Hargreaves ET0 (FAO-56 simplificado). Suficiente para Chile central en Fase 1.
// ET0 = 0.0023 * (Tmean + 17.8) * sqrt(Tmax - Tmin) * Ra
// Ra = radiación extraterrestre en mm/día (eq 21 FAO-56).

const GSC = 0.0820; // MJ m-2 min-1
const MJ_TO_MM = 0.408; // conversión radiación -> equiv. evaporación

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function calcularRadiacionExtraterrestre(
  latitudDeg: number,
  diaDelAno: number
): number {
  const phi = toRad(latitudDeg);
  const dr = 1 + 0.033 * Math.cos((2 * Math.PI * diaDelAno) / 365);
  const delta =
    0.409 * Math.sin((2 * Math.PI * diaDelAno) / 365 - 1.39);
  // ωs: ángulo horario al atardecer
  const argAcos = -Math.tan(phi) * Math.tan(delta);
  const omegaS = Math.acos(Math.max(-1, Math.min(1, argAcos)));
  const ra =
    ((24 * 60) / Math.PI) *
    GSC *
    dr *
    (omegaS * Math.sin(phi) * Math.sin(delta) +
      Math.cos(phi) * Math.cos(delta) * Math.sin(omegaS));
  // ra en MJ/m²/día -> mm/día
  return ra * MJ_TO_MM;
}

export function calcularEt0Hargreaves(
  tMin: number,
  tMax: number,
  latitudDeg: number,
  diaDelAno: number
): number {
  if (tMax < tMin) {
    throw new Error("tMax debe ser >= tMin");
  }
  const tMean = (tMax + tMin) / 2;
  const raMm = calcularRadiacionExtraterrestre(latitudDeg, diaDelAno);
  const et0 = 0.0023 * (tMean + 17.8) * Math.sqrt(tMax - tMin) * raMm;
  return Math.max(0, et0);
}
