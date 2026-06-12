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
    confirmDraw: "Guardar zona",
    cancelDraw: "Cancelar",
    resetDraw: "Reiniciar dibujo",
    basemapStreet: "Mapa",
    basemapSatellite: "Satélite",
    basemapHybrid: "Híbrido",
  },
  slider: {
    title: "Línea de tiempo satelital",
    cloudCoverage: "Nubosidad",
    noImages: "No hay imágenes disponibles para este período.",
    dateLabel: "Fecha",
    radarNote: "Radar — atraviesa las nubes",
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
    showOverlay: "Mostrar imagen satelital",
  },
  analysis: {
    title: "Análisis del campo",
    score: "Puntaje",
    distribution: "Distribución",
    recommendations: "Recomendaciones",
    hectares: "ha",
    selectAnalysisLayer: "Selecciona una capa de análisis (NDVI, NDMI o NDWI) para ver estadísticas del campo.",
    radarNotAnalyzable: "El radar es una vista visual — el análisis por zonas se aplica a las capas de vegetación, humedad y agua.",
    loading: "Analizando imagen...",
    error: "No se pudo analizar la imagen.",
    noData: "Sin datos para analizar.",
  },
  tooltip: {
    openHelp: "Ver explicación",
    closeHelp: "Cerrar explicación",
  },
  riego: {
    laminaSugerida: "Lámina sugerida",
    diasHastaEstres: "Días hasta estrés",
    prioridad: "Prioridad",
    deficit: "Déficit hídrico",
    postergarLluvia: "Se esperan {mm} mm de lluvia en {dias} día(s) — puedes postergar el riego",
    registrarRiego: "Registrar riego",
    fechaRiego: "Fecha",
    mmAplicados: "Lámina aplicada (mm)",
    horasRiego: "Horas de riego",
    notaRiego: "Nota (opcional)",
    guardarRiego: "Guardar riego",
    riegoGuardado: "Riego registrado — recomendación actualizada",
    sinRegistroRiego: "Sin registros de riego — el modelo asume que no se ha regado",
    datosSimulados: "Datos simulados (modo demo)",
    calculando: "Calculando con historial de 14 meses…",
    validacion: "Modelo validado con {n} imágenes históricas — error medio ±{mae}%",
    balanceAl: "Balance al {fecha}",
    regarHoy: "Regar hoy",
    regarManana: "Regar mañana",
    regar34: "Regar en 3-4 días",
    sinUrgencia: "Sin urgencia de riego",
  },
} as const;

export type TranslationKey = typeof es;
