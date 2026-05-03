import { CATALOGO_FENOLOGIA } from './catalogo';
import type { Cultivo, EntradaFenologica, Fase } from './types';

const CULTIVOS_SOPORTADOS: Cultivo[] = [
  'palto_hass', 'citricos', 'ciruela_dagen', 'nogales', 'uva_mesa',
  'uva_vinifera', 'manzano', 'cerezo', 'arandano', 'duraznero',
  'almendro', 'olivo', 'kiwi',
];

export function obtenerFenologia(cultivo: Cultivo, mes: number): EntradaFenologica {
  if (!CULTIVOS_SOPORTADOS.includes(cultivo)) {
    throw new Error(`Cultivo no soportado: ${cultivo}`);
  }
  if (mes < 1 || mes > 12) {
    throw new Error(`Mes inválido: ${mes}. Debe ser 1-12.`);
  }

  const entrada = CATALOGO_FENOLOGIA.find(
    (e) => e.cultivo === cultivo && e.mes === mes,
  );

  if (!entrada) {
    throw new Error(`Sin entrada en catálogo para cultivo=${cultivo} mes=${mes}`);
  }

  return entrada;
}

export function listarCultivosSoportados(): Cultivo[] {
  return [...CULTIVOS_SOPORTADOS];
}

export function listarFasesSoportadas(): Fase[] {
  return [
    'brotacion', 'floracion', 'cuaje', 'desarrollo_fruto',
    'maduracion', 'cosecha', 'post_cosecha', 'reposo',
  ];
}
