import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSql, setMockResults } = vi.hoisted(() => {
  const _results: unknown[][] = [];
  let _callIndex = 0;

  const mockSql = Object.assign(
    (_strings: TemplateStringsArray, ..._values: unknown[]) => {
      const result = _results[_callIndex] ?? [];
      _callIndex += 1;
      return Promise.resolve(result);
    },
    {}
  );

  function setMockResults(results: unknown[][]) {
    _results.length = 0;
    _callIndex = 0;
    _results.push(...results);
  }

  return { mockSql, setMockResults };
});

vi.mock("@/lib/db/client", () => ({ sql: mockSql }));

import { guardarFeedback, ultimosNFeedbacksDePredio } from "@/lib/feedback/repo";
import type { Feedback } from "@/lib/feedback/repo";

const fakeFeedback: Feedback = {
  id: "fb-1",
  recomendacion_id: "rec-1",
  valoracion: "razonable",
  observacion_libre: null,
  creado_en: new Date(),
};

beforeEach(() => {
  setMockResults([]);
});

describe("guardarFeedback", () => {
  it("inserta y retorna el feedback cuando ownership es válido", async () => {
    setMockResults([[{ id: "rec-1" }], [fakeFeedback]]);
    const result = await guardarFeedback("rec-1", "user-1", "razonable");
    expect(result.id).toBe("fb-1");
    expect(result.valoracion).toBe("razonable");
  });

  it("lanza error cuando ownership es rechazado", async () => {
    setMockResults([[]]); // ownership query returns empty
    await expect(
      guardarFeedback("rec-99", "user-1", "no_acerto")
    ).rejects.toThrow("recomendacion no encontrada o no pertenece al usuario");
  });
});

describe("ultimosNFeedbacksDePredio", () => {
  it("retorna feedbacks en orden descendente", async () => {
    const fb2: Feedback = { ...fakeFeedback, id: "fb-2", valoracion: "no_acerto" };
    setMockResults([[fb2, fakeFeedback]]);
    const result = await ultimosNFeedbacksDePredio("predio-1", 2);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("fb-2");
  });

  it("retorna array vacío cuando no hay feedbacks", async () => {
    setMockResults([[]]);
    const result = await ultimosNFeedbacksDePredio("predio-1", 2);
    expect(result).toEqual([]);
  });
});
