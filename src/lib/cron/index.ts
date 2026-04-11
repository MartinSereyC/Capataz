// Barrel re-export del módulo cron.

export { ejecutarJobDiario } from "./daily-job";
export type { JobResultado, JobOpciones } from "./daily-job";
export { iniciarScheduler, detenerScheduler } from "./scheduler";
export { SentinelBudget } from "./sentinel-budget";
export {
  logEvento,
  logJobCorrida,
  _setEscritor,
  _resetEscritor,
} from "./logger";
export type { NivelLog, LogLine } from "./logger";
export {
  contarRecomendacionesHoy,
  contarErroresUltimas24h,
  agruparFeedbackUltimas24h,
  errorReconciliacionUltimaImagen,
  estadoQuotas,
} from "./observabilidad";
