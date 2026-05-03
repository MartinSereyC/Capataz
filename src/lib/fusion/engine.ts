import type { ClimaDiario } from '../clima/types';
import type { SueloEstimado } from '../suelo/types';
import { obtenerFenologia } from '../fenologia/lookup';
import type { Cultivo } from '../fenologia/types';
import { calcularEt0Hargreaves } from '../engine/et0';
import type { GeoJSONPolygon } from '@/types';

// Maps UI display crop names to fenologia catalog slugs
const CROP_SLUG_MAP: Record<string, Cultivo> = {
  'Palta Hass':   'palto_hass',
  'Uva de mesa':  'uva_mesa',
  'Uva vinífera': 'uva_vinifera',
  'Cerezo':       'cerezo',
  'Nogal':        'nogales',
  'Kiwi':         'kiwi',
  'Manzano':      'manzano',
  'Peral':        'manzano', // fallback to closest equivalent
  'Arándano':     'arandano',
  'Duraznero':    'duraznero',
  'Almendro':     'almendro',
  'Olivo':        'olivo',
  'Cítricos':     'citricos',
};

function centroide(polygon: GeoJSONPolygon): { lat: number; lng: number } {
  const coords = polygon.coordinates[0];
  const lat = coords.reduce((s, c) => s + c[1], 0) / coords.length;
  const lng = coords.reduce((s, c) => s + c[0], 0) / coords.length;
  return { lat, lng };
}

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

// Map NDMI value to an estimated current deficit (%)
function ndmiToDeficit(ndmi: number): number {
  if (ndmi > 0.3)  return 10;
  if (ndmi > 0.1)  return 25;
  if (ndmi > -0.1) return 45;
  if (ndmi > -0.3) return 65;
  return 80;
}

// Map SAR VV backscatter (dB) to estimated deficit (%)
function sarVvToDeficit(vvDb: number): number {
  if (vvDb > -10) return 15;
  if (vvDb > -15) return 40;
  if (vvDb > -20) return 60;
  return 80;
}

// Maps deficit % to semaforo + timing using crop-specific thresholds
function deficitToRecomendacion(
  deficitPct: number,
  umbralRojo: number,
  umbralAmarillo: number,
): { semaforo: 'verde' | 'amarillo' | 'rojo'; timing: 'hoy' | 'mañana' | '3-4 días' | 'no urgente' } {
  if (deficitPct >= umbralRojo) {
    return { semaforo: 'rojo', timing: 'hoy' };
  }
  const midpoint = umbralAmarillo + (umbralRojo - umbralAmarillo) * 0.5;
  if (deficitPct >= midpoint) {
    return { semaforo: 'amarillo', timing: 'mañana' };
  }
  if (deficitPct >= umbralAmarillo) {
    return { semaforo: 'amarillo', timing: '3-4 días' };
  }
  return { semaforo: 'verde', timing: 'no urgente' };
}

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
