// TypeScript row shapes mirroring db/migrations/0001_init.sql.
// Geometries come back as GeoJSON strings or WKT depending on query; typed as string here.

export type LoginMethod = "magic_link" | "admin_manual";
export type Rol = "agricultor" | "admin";
export type Prioridad = "alta" | "media" | "baja";
export type FuenteTipo = "pozo" | "canal" | "acumulador";
export type ClimaOrigen = "open_meteo" | "mock";
export type SueloOrigen = "soilgrids" | "mock";
export type Semaforo = "verde" | "amarillo" | "rojo";
export type Confianza = "baja" | "media" | "alta";
export type Valoracion = "razonable" | "mas_o_menos" | "no_acerto";

export interface UsuarioRow {
  id: string;
  email: string | null;
  login_method: LoginMethod;
  idioma: string;
  rol: Rol;
  creado_en: Date;
  actualizado_en: Date;
}

export interface PredioRow {
  id: string;
  usuario_id: string;
  nombre: string;
  geometria: string;
  region: string | null;
  comuna: string | null;
  creado_en: Date;
  actualizado_en: Date;
}

export interface ZonaRow {
  id: string;
  predio_id: string;
  nombre: string;
  geometria: string;
  cultivo: string;
  prioridad: Prioridad;
  fase_fenologica_override: string | null;
  creado_en: Date;
  actualizado_en: Date;
}

export interface FuenteHidricaRow {
  id: string;
  predio_id: string;
  tipo: FuenteTipo;
  caudal_estimado_lh: string | null;
  capacidad_estimada_l: string | null;
  notas: string | null;
  creado_en: Date;
}

export interface FuenteZonaRow {
  fuente_id: string;
  zona_id: string;
}

export interface ClimaDiarioRow {
  id: string;
  predio_id: string;
  fecha: string;
  origen: ClimaOrigen;
  t_min: string | null;
  t_max: string | null;
  precipitacion_mm: string | null;
  et0_mm: string | null;
  payload: unknown;
  creado_en: Date;
}

export interface SueloEstimadoRow {
  id: string;
  predio_id: string;
  zona_id: string | null;
  origen: SueloOrigen;
  textura: string | null;
  capacidad_campo_pct: string | null;
  punto_marchitez_pct: string | null;
  heterogeneo: boolean;
  payload: unknown;
  creado_en: Date;
}

export interface FenologiaCatalogoRow {
  id: string;
  cultivo: string;
  mes: number;
  kc_referencia: string;
  fase: string;
  fuente: string | null;
  notas: string | null;
}

export interface ObservacionSatelitalRow {
  id: string;
  zona_id: string;
  fecha: string;
  ndvi: string | null;
  ndmi: string | null;
  fuente: string;
  payload: unknown;
  creado_en: Date;
}

export interface EstadoHidricoInternoRow {
  id: string;
  zona_id: string;
  fecha: string;
  deficit_pct: string | null;
  proyectado: boolean;
  inputs: unknown;
  creado_en: Date;
}

export interface RecomendacionDiariaRow {
  id: string;
  zona_id: string;
  fecha: string;
  semaforo: Semaforo;
  timing_etiqueta: string;
  confianza: Confianza;
  razon_breve: string;
  postergada_por_escasez: boolean;
  creado_en: Date;
}

export interface FeedbackAgricultorRow {
  id: string;
  recomendacion_id: string;
  valoracion: Valoracion;
  observacion_libre: string | null;
  creado_en: Date;
}
