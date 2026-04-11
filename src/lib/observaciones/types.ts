export interface ObservacionSatelital {
  zonaId: string;
  /** YYYY-MM-DD */
  fecha: string;
  ndvi: number | null;
  ndmi: number | null;
  fuente: string;
  payloadRaw: unknown;
}
