/**
 * Spanish UI strings — i18n-lite approach.
 * Single file for all user-facing text.
 * Future English translation = one additional file.
 */
export const es = {
  meta: {
    title: "Capataz — Ojos remotos para tu terreno",
    description:
      "Sube tu escritura digital y visualiza tu terreno con imágenes satelitales de los últimos 6 meses.",
  },
  landing: {
    hero: "Vigila tu terreno desde cualquier lugar",
    subtitle:
      "Sube la escritura de tu terreno y obtén imágenes satelitales de los últimos 6 meses. Sin cuenta, sin costo.",
    uploadButton: "Subir escritura (PDF)",
    howItWorks: "¿Cómo funciona?",
    step1: "Sube tu escritura digital en PDF",
    step2: "Extraemos las coordenadas automáticamente",
    step3: "Visualiza tu terreno en el mapa satelital",
    step4: "Desliza en el tiempo para ver cambios",
  },
  upload: {
    dropzone: "Arrastra tu escritura aquí",
    dropzoneOr: "o",
    selectFile: "Seleccionar archivo PDF",
    maxSize: "Máximo 10 MB — Solo archivos PDF",
    invalidType: "Solo se aceptan archivos PDF.",
    tooLarge: "El archivo supera el límite de 10 MB.",
  },
  progress: {
    extracting: "Extrayendo coordenadas del documento...",
    locating: "Localizando tu terreno en el mapa...",
    loading: "Cargando imágenes satelitales...",
    ready: "¡Listo! Tu terreno está disponible",
    error: "Ocurrió un error",
  },
  extraction: {
    noCoordinates:
      "No se encontraron coordenadas en el documento. Puede dibujar los límites de su terreno manualmente en el mapa.",
    invalidFormat:
      "Las coordenadas encontradas no tienen un formato válido. Intente dibujar los límites manualmente.",
    outsideChile:
      "Las coordenadas no corresponden a una ubicación en Chile. Verifique el documento e intente nuevamente.",
    drawManually: "Dibujar manualmente",
    parcelInfo: "Información del terreno",
    area: "Superficie",
    hectares: "hectáreas",
    format: "Formato detectado",
    vertices: "Vértices",
  },
  satellite: {
    loading: "Cargando imagen satelital...",
    error: "No se pudo cargar la imagen para esta fecha.",
    noData: "Sin datos satelitales para esta fecha.",
  },
  map: {
    drawInstructions:
      "Haga clic en el mapa para marcar los puntos del perímetro de su terreno. Mínimo 3 puntos.",
    confirmDraw: "Confirmar perímetro",
    cancelDraw: "Cancelar",
    resetDraw: "Reiniciar dibujo",
  },
  slider: {
    title: "Línea de tiempo satelital",
    cloudCoverage: "Nubosidad",
    noImages: "No hay imágenes disponibles para este período.",
    dateLabel: "Fecha",
  },
  errors: {
    generic: "Ocurrió un error inesperado. Intente nuevamente.",
    networkError: "Error de conexión. Verifique su internet e intente nuevamente.",
    serverError: "Error del servidor. Intente nuevamente en unos minutos.",
  },
  search: {
    placeholder: "Buscar lugar, direccion o comuna...",
    noResults: "No se encontraron resultados",
    loading: "Buscando...",
    error: "Error al buscar. Intente nuevamente.",
    clear: "Limpiar busqueda",
  },
  layers: {
    title: "Vista del terreno",
    change: "Cambiar vista",
    legend: "Leyenda",
  },
} as const;

export type TranslationKey = typeof es;
