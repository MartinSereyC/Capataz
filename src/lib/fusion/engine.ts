import type { ClimaDiario } from '../clima/types';
import type { SueloEstimado } from '../suelo/types';
import { obtenerFenologia } from '../fenologia/lookup';
import { calcularEt0Hargreaves } from '../engine/et0';
import { centroide } from '../geo/centroid';
import { CROP_SLUG_MAP } from '../balance/cultivos';
import { ndmiToDeficit, sarVvToDeficit } from '../balance/asimilacion';
import { deficitToRecomendacion } from '../balance/recomendacion';
import type { GeoJSONPolygon } from '@/types';

function dayOfYear(fecha: string): number {
  const [y, m, d] = fecha.split('-').map(Number);
  const start = new Date(y, 0, 1);
  const current = new Date(y, m - 1, d);
  return Math.round((current.getTime() - start.getTime()) / 86_400_000) + 1;
}

function diasDesde(dateStr: string): number {
  const then = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - then.getTime()) / 86_400_000);
}

// Effective precipitation — USDA-SCS simplified
function precipEfectiva(mm: number): number {
  if (mm < 5) return 0;
  return mm * 0.8;
}

// Projects water deficit (mm, treated as %) over a weather window, starting from initialDeficit.
function proyectarBalance(
  weather: ClimaDiario[],
  latitudDeg: number,
  kc: number,
  initialDeficit: number,
): number {
  let deficit = initialDeficit;
  for (const dia of weather) {
    const doy = dayOfYear(dia.fecha);
    const et0 = calcularEt0Hargreaves(dia.tMin, dia.tMax, latitudDeg, doy);
    const etc = et0 * kc;
    const pEf = precipEfectiva(dia.precipitacionMm);
    deficit = Math.max(0, Math.min(100, deficit + etc - pEf));
  }
  return deficit;
}

// Los mapeos NDMI/SAR→déficit y déficit→semáforo viven en src/lib/balance/
// (fuente única compartida con el motor de balance histórico).

export interface FusionInput {
  polygon: GeoJSONPolygon;
  cropDisplay: string;       // display name from UI (e.g. "Palta Hass")
  date: string;              // selected Sentinel-2 date (YYYY-MM-DD)
  ndmi: number | null;
  cloudCoverage: number | null;
  weather: ClimaDiario[];
  suelo: SueloEstimado;
  sarVv: number | null;      // VV backscatter in dB, null if not available
  sarDate: string | null;    // date of SAR acquisition
}

export interface FusionResult {
  semaforo: 'verde' | 'amarillo' | 'rojo';
  timing: 'hoy' | 'mañana' | '3-4 días' | 'no urgente';
  confianza: 'alta' | 'media' | 'baja';
  fuentes: Array<'sentinel-2' | 'sentinel-1' | 'clima' | 'suelo'>;
  ultimaImagenDias: number | null;
}

export function runFusion(input: FusionInput): FusionResult {
  const { polygon, cropDisplay, date, ndmi, cloudCoverage, weather, sarVv, sarDate } = input;

  const { lat } = centroide(polygon);
  const mesActual = new Date().getMonth() + 1;
  const cropSlug = CROP_SLUG_MAP[cropDisplay];

  // Get crop-specific thresholds and Kc
  let umbralRojo = 50;
  let umbralAmarillo = 35;
  let kc = 0.8;

  if (cropSlug) {
    try {
      const fen = obtenerFenologia(cropSlug, mesActual);
      umbralRojo = fen.umbralRojoDeficitPct;
      umbralAmarillo = fen.umbralAmarilloDeficitPct;
      kc = fen.kcReferencia;
    } catch { /* use defaults for unknown crops */ }
  }

  // Run ET0 balance over the last 14 days, starting from deficit=0
  const recentWeather = weather.slice(-14);
  const deficitBalance = proyectarBalance(recentWeather, lat, kc, 0);

  // Determine satellite data freshness
  const diasDesdeS2 = date ? diasDesde(date) : null;
  const s2Clear = cloudCoverage === null || cloudCoverage < 60;
  const s2Usable = diasDesdeS2 !== null && diasDesdeS2 <= 6 && s2Clear && ndmi !== null;
  const sarUsable = sarVv !== null && sarDate !== null && diasDesde(sarDate) <= 14;

  let semaforo: 'verde' | 'amarillo' | 'rojo';
  let timing: 'hoy' | 'mañana' | '3-4 días' | 'no urgente';
  let confianza: 'alta' | 'media' | 'baja';
  const fuentes: Array<'sentinel-2' | 'sentinel-1' | 'clima' | 'suelo'> = ['clima', 'suelo'];

  if (s2Usable && ndmi !== null) {
    // Alta confianza: S2 NDMI primary (60%), ET0 balance secondary (40%)
    const ndmiDeficit = ndmiToDeficit(ndmi);
    const fusedDeficit = 0.6 * ndmiDeficit + 0.4 * deficitBalance;
    const rec = deficitToRecomendacion(fusedDeficit, umbralRojo, umbralAmarillo);
    semaforo = rec.semaforo;
    timing = rec.timing;
    confianza = 'alta';
    fuentes.unshift('sentinel-2');
  } else if (sarUsable) {
    // Media confianza: SAR VV primary (50%), ET0 balance secondary (50%)
    const sarDeficit = sarVvToDeficit(sarVv!);
    const fusedDeficit = 0.5 * sarDeficit + 0.5 * deficitBalance;
    const rec = deficitToRecomendacion(fusedDeficit, umbralRojo, umbralAmarillo);
    semaforo = rec.semaforo;
    timing = rec.timing;
    confianza = 'media';
    fuentes.unshift('sentinel-1');
  } else {
    // Baja confianza: ET0 balance only
    const rec = deficitToRecomendacion(deficitBalance, umbralRojo, umbralAmarillo);
    semaforo = rec.semaforo;
    timing = rec.timing;
    confianza = 'baja';
  }

  return { semaforo, timing, confianza, fuentes, ultimaImagenDias: diasDesdeS2 };
}
