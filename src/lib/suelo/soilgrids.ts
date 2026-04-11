import type { SueloEstimado, TexturaSuelo } from './types';

const CACHE = new Map<string, SueloEstimado>();

const BASE_URL = 'https://rest.isric.org/soilgrids/v2.0/properties/query';

function clasificarTextura(sand: number, clay: number): TexturaSuelo {
  // USDA soil triangle simplified rules (percentages 0-100)
  if (sand >= 70 && clay < 15) return 'arenoso';
  if (clay >= 40) return 'arcilloso';
  if (clay >= 27 && sand <= 45) return 'franco-arcilloso';
  if (sand >= 50 && clay < 27) return 'franco-arenoso';
  return 'franco';
}

function calcularHidraulica(sand: number, clay: number): { capacidadCampoPct: number; puntoMarchitezPct: number } {
  // Saxton & Rawls simplified pedotransfer
  const OM = 1.5;
  const capacidadCampo = 0.2576 - 0.002 * sand + 0.0036 * clay + 0.0299 * OM;
  const capacidadCampoPct = Math.min(45, Math.max(10, capacidadCampo * 100));
  const puntoMarchitezPct = capacidadCampoPct * 0.55;
  return { capacidadCampoPct, puntoMarchitezPct };
}

function extraerPromedioCapas(layers: unknown[], propertyName: string): number {
  // layers is array of {name, depths:[{label,values:{mean}}]}
  const layer = (layers as Array<{ name: string; depths: Array<{ values: { mean: number | null } }> }>)
    .find((l) => l.name === propertyName);
  if (!layer) return 0;

  const means = layer.depths
    .map((d) => d.values.mean)
    .filter((v): v is number => v !== null && v !== undefined);

  if (means.length === 0) return 0;
  // SoilGrids returns sand/clay/silt in g/kg, convert to %
  const avg = means.reduce((a, b) => a + b, 0) / means.length;
  return avg / 10; // g/kg → %
}

export async function obtenerSuelo(lat: number, lon: number): Promise<SueloEstimado> {
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  if (CACHE.has(key)) return CACHE.get(key)!;

  const url = `${BASE_URL}?lon=${lon}&lat=${lat}&property=sand&property=clay&property=silt&depth=0-5cm&depth=5-15cm&value=mean`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`SoilGrids error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { properties: { layers: unknown[] } };
  const layers = data.properties.layers;

  const sand = extraerPromedioCapas(layers, 'sand');
  const clay = extraerPromedioCapas(layers, 'clay');

  const textura: TexturaSuelo = clasificarTextura(sand, clay);
  const { capacidadCampoPct, puntoMarchitezPct } = calcularHidraulica(sand, clay);

  const result: SueloEstimado = {
    lat,
    lon,
    textura,
    capacidadCampoPct,
    puntoMarchitezPct,
    origen: 'soilgrids',
    raw: data,
  };

  CACHE.set(key, result);
  return result;
}

export function _clearCacheForTests(): void {
  CACHE.clear();
}
