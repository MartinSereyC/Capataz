import { ultimosNFeedbacksDePredio } from "./repo";
import { logEvento } from "@/lib/cron/logger";

export async function detectarAlertaNoAcerto(
  predioId: string
): Promise<{ disparar: boolean; razon: string }> {
  const feedbacks = await ultimosNFeedbacksDePredio(predioId, 2);

  if (feedbacks.length < 2) {
    return { disparar: false, razon: "menos de 2 feedbacks" };
  }

  const ambosNoAcertaron = feedbacks.every(
    (f) => f.valoracion === "no_acerto"
  );

  if (ambosNoAcertaron) {
    return {
      disparar: true,
      razon: "los últimos 2 feedbacks son no_acerto",
    };
  }

  return { disparar: false, razon: "no se cumple condición de alerta" };
}

export async function emitirAlertaSiCorresponde(
  predioId: string
): Promise<void> {
  const { disparar, razon } = await detectarAlertaNoAcerto(predioId);

  if (disparar) {
    logEvento("warn", "ALERTA_FEEDBACK_NO_ACERTO", { predioId, razon });
  }
}
