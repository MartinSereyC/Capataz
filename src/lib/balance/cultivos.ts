import type { Cultivo } from '../fenologia/types';

// Parámetros de modelo por cultivo no presentes en el catálogo fenológico:
// profundidad radicular efectiva (Zr) y fracción de agotamiento permisible (p).
// Fuente: FAO-56 tabla 22 (Allen et al., 1998), rangos medios para frutales
// adultos con riego localizado. Constantes de modelo — nunca se muestran en
// la UI como dato medido.
export interface ParametrosCultivo {
  profundidadRaizM: number; // Zr efectiva (m)
  fraccionAgotamiento: number; // p: fracción de TAW agotable sin estrés
}

const PARAMETROS: Record<Cultivo, ParametrosCultivo> = {
  palto_hass:    { profundidadRaizM: 0.7, fraccionAgotamiento: 0.7 },
  citricos:      { profundidadRaizM: 1.1, fraccionAgotamiento: 0.5 },
  ciruela_dagen: { profundidadRaizM: 1.0, fraccionAgotamiento: 0.5 },
  nogales:       { profundidadRaizM: 1.7, fraccionAgotamiento: 0.5 },
  uva_mesa:      { profundidadRaizM: 1.0, fraccionAgotamiento: 0.35 },
  uva_vinifera:  { profundidadRaizM: 1.0, fraccionAgotamiento: 0.45 },
  manzano:       { profundidadRaizM: 1.2, fraccionAgotamiento: 0.5 },
  cerezo:        { profundidadRaizM: 1.0, fraccionAgotamiento: 0.5 },
  arandano:      { profundidadRaizM: 0.6, fraccionAgotamiento: 0.5 },
  duraznero:     { profundidadRaizM: 1.0, fraccionAgotamiento: 0.5 },
  almendro:      { profundidadRaizM: 1.2, fraccionAgotamiento: 0.4 },
  olivo:         { profundidadRaizM: 1.3, fraccionAgotamiento: 0.65 },
  kiwi:          { profundidadRaizM: 0.9, fraccionAgotamiento: 0.35 },
};

const DEFAULT_PARAMETROS: ParametrosCultivo = {
  profundidadRaizM: 1.0,
  fraccionAgotamiento: 0.5,
};

export function parametrosCultivo(cultivo: Cultivo | null): ParametrosCultivo {
  if (cultivo && cultivo in PARAMETROS) return PARAMETROS[cultivo];
  return DEFAULT_PARAMETROS;
}

// Mapea nombres de cultivo de la UI a slugs del catálogo fenológico.
// (Movido desde fusion/engine.ts para que ambos motores lo compartan.)
export const CROP_SLUG_MAP: Record<string, Cultivo> = {
  'Palta Hass':   'palto_hass',
  'Uva de mesa':  'uva_mesa',
  'Uva vinífera': 'uva_vinifera',
  'Cerezo':       'cerezo',
  'Nogal':        'nogales',
  'Kiwi':         'kiwi',
  'Manzano':      'manzano',
  'Peral':        'manzano', // equivalente más cercano del catálogo
  'Arándano':     'arandano',
  'Duraznero':    'duraznero',
  'Almendro':     'almendro',
  'Olivo':        'olivo',
  'Cítricos':     'citricos',
};

export function cultivoSlug(cropDisplay: string): Cultivo | null {
  return CROP_SLUG_MAP[cropDisplay] ?? null;
}
