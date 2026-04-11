import { describe, it, expect, vi, beforeEach } from "vitest";

// Stateful fake de sql que decide respuestas por keywords.
let respuestas: Array<Array<Record<string, unknown>>> = [];
let i = 0;

function fakeSql(
  _strings: TemplateStringsArray,
  ..._values: unknown[]
): Promise<Array<Record<string, unknown>>> {
  const r = respuestas[i] ?? [];
  i += 1;
  return Promise.resolve(r);
}

vi.mock("@/lib/db/client", () => ({ sql: fakeSql }));

import {
  contarRecomendacionesHoy,
  contarErroresUltimas24h,
  agruparFeedbackUltimas24h,
  errorReconciliacionUltimaImagen,
  estadoQuotas,
} from "@/lib/cron/observabilidad";

describe("observabilidad", () => {
  beforeEach(() => {
    i = 0;
    respuestas = [];
  });

  it("contarRecomendacionesHoy retorna generadas y esperadas", async () => {
    respuestas = [[{ count: "12" }], [{ count: "15" }]];
    const r = await contarRecomendacionesHoy();
    expect(r.generadas).toBe(12);
    expect(r.esperadas).toBe(15);
  });

  it("contarErroresUltimas24h devuelve número", async () => {
    respuestas = [[{ count: "3" }]];
    const n = await contarErroresUltimas24h();
    expect(n).toBe(3);
  });

  it("agruparFeedbackUltimas24h agrupa por valoración", async () => {
    respuestas = [
      [
        { valoracion: "razonable", count: "5" },
        { valoracion: "mas_o_menos", count: "2" },
        { valoracion: "no_acerto", count: "1" },
      ],
    ];
    const r = await agruparFeedbackUltimas24h();
    expect(r.razonable).toBe(5);
    expect(r.mas_o_menos).toBe(2);
    expect(r.no_acerto).toBe(1);
  });

  it("errorReconciliacionUltimaImagen arma mapa por predio", async () => {
    respuestas = [
      [
        { predio_id: "p1", error_prom: "0.12" },
        { predio_id: "p2", error_prom: null },
      ],
    ];
    const r = await errorReconciliacionUltimaImagen();
    expect(r.p1).toBeCloseTo(0.12);
    expect(r.p2).toBe(0);
  });

  it("estadoQuotas devuelve sentinelRequestsHoy y keepalive", async () => {
    respuestas = [[{ count: "7" }]];
    const r = await estadoQuotas();
    expect(r.sentinelRequestsHoy).toBe(7);
    expect(r.keepaliveUltimo).toBeNull();
  });
});
