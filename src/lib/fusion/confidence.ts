// Generates the human-readable explanation shown in the confidence tooltip.

export function textoConfianza(
  confianza: 'alta' | 'media' | 'baja',
  ultimaImagenDias: number | null,
): string {
  if (confianza === 'alta') {
    return 'Basado en imagen Sentinel-2 reciente y modelo climático calibrado.';
  }
  if (confianza === 'media') {
    if (ultimaImagenDias !== null) {
      return `Sin imagen óptica clara en ${ultimaImagenDias} días. Usando radar SAR (ve a través de nubes) y modelo climático.`;
    }
    return 'Imagen óptica no disponible. Recomendación basada en radar SAR y modelo climático.';
  }
  // baja
  if (ultimaImagenDias !== null) {
    return `Sin datos satelitales en ${ultimaImagenDias} días. Recomendación basada solo en modelo climático.`;
  }
  return 'Sin imágenes satelitales recientes. Recomendación basada en modelo climático y textura de suelo.';
}

export function labelConfianza(confianza: 'alta' | 'media' | 'baja'): string {
  if (confianza === 'alta') return 'Confianza alta';
  if (confianza === 'media') return 'Confianza media';
  return 'Confianza baja';
}

export function colorConfianza(confianza: 'alta' | 'media' | 'baja'): string {
  if (confianza === 'alta') return '#16a34a';   // green
  if (confianza === 'media') return '#ca8a04';  // amber
  return '#6b7280';                              // grey
}

export function labelFuente(fuente: 'sentinel-2' | 'sentinel-1' | 'clima' | 'suelo'): string {
  switch (fuente) {
    case 'sentinel-2': return 'Sentinel-2';
    case 'sentinel-1': return 'Radar SAR';
    case 'clima':      return 'Clima';
    case 'suelo':      return 'Suelo';
  }
}
