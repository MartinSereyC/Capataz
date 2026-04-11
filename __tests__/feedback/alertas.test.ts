import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/feedback/repo", () => ({
  ultimosNFeedbacksDePredio: vi.fn(),
}));

vi.mock("@/lib/cron/logger", () => ({
  logEvento: vi.fn(),
}));

import { ultimosNFeedbacksDePredio } from "@/lib/feedback/repo";
import { logEvento } from "@/lib/cron/logger";
import { detectarAlertaNoAcerto, emitirAlertaSiCorresponde } from "@/lib/feedback/alertas";
import type { Feedback } from "@/lib/feedback/repo";

const mockUltimos = ultimosNFeedbacksDePredio as ReturnType<typeof vi.fn>;
const mockLog = logEvento as ReturnType<typeof vi.fn>;

function makeFeedback(valoracion: Feedback["valoracion"], id: string): Feedback {
  return {
    id,
    recomendacion_id: "rec-1",
    valoracion,
    observacion_libre: null,
    creado_en: new Date(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("detectarAlertaNoAcerto", () => {
  it("retorna disparar=true cuando los últimos 2 son no_acerto", async () => {
    mockUltimos.mockResolvedValue([
      makeFeedback("no_acerto", "fb-1"),
      makeFeedback("no_acerto", "fb-2"),
    ]);
    const result = await detectarAlertaNoAcerto("predio-1");
    expect(result.disparar).toBe(true);
  });

  it("retorna disparar=false cuando el último es no_acerto pero el anterior es razonable", async () => {
    mockUltimos.mockResolvedValue([
      makeFeedback("no_acerto", "fb-1"),
      makeFeedback("razonable", "fb-2"),
    ]);
    const result = await detectarAlertaNoAcerto("predio-1");
    expect(result.disparar).toBe(false);
  });

  it("retorna disparar=false cuando no hay feedbacks", async () => {
    mockUltimos.mockResolvedValue([]);
    const result = await detectarAlertaNoAcerto("predio-1");
    expect(result.disparar).toBe(false);
  });
});

describe("emitirAlertaSiCorresponde", () => {
  it("llama logEvento cuando disparar=true", async () => {
    mockUltimos.mockResolvedValue([
      makeFeedback("no_acerto", "fb-1"),
      makeFeedback("no_acerto", "fb-2"),
    ]);
    await emitirAlertaSiCorresponde("predio-1");
    expect(mockLog).toHaveBeenCalledWith(
      "warn",
      "ALERTA_FEEDBACK_NO_ACERTO",
      expect.objectContaining({ predioId: "predio-1" })
    );
  });

  it("no llama logEvento cuando disparar=false", async () => {
    mockUltimos.mockResolvedValue([]);
    await emitirAlertaSiCorresponde("predio-1");
    expect(mockLog).not.toHaveBeenCalled();
  });
});
