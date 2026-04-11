export type Cultivo =
  | 'palto_hass'
  | 'citricos'
  | 'ciruela_dagen'
  | 'nogales'
  | 'uva_mesa'
  | 'uva_vinifera'
  | 'manzano'
  | 'cerezo'
  | 'arandano'
  | 'duraznero'
  | 'almendro'
  | 'olivo'
  | 'kiwi';

export type Fase =
  | 'brotacion'
  | 'floracion'
  | 'cuaje'
  | 'desarrollo_fruto'
  | 'maduracion'
  | 'cosecha'
  | 'post_cosecha'
  | 'reposo';

export type EntradaFenologica = {
  cultivo: Cultivo;
  mes: number; // 1-12, hemisferio sur (Chile)
  fase: Fase;
  kcReferencia: number;
  umbralRojoDeficitPct: number; // % deficit crítico → regar hoy
  umbralAmarilloDeficitPct: number; // % deficit pre-alerta
  fuente: string;
  notas: string;
};
