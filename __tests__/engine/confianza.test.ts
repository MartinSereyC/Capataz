import { describe, it, expect } from "vitest";
import { calcularConfianza } from "@/lib/engine/confianza";

describe("calcularConfianza", () => {
  it("día 1 => baja", () => {
    expect(calcularConfianza(1, 0)).toBe("baja");
  });

  it("día 14 => baja (aún en ventana de arranque)", () => {
    expect(calcularConfianza(14, 0)).toBe("baja");
  });

  it("día 15 con error bajo => media", () => {
    expect(calcularConfianza(15, 0.1)).toBe("media");
  });

  it("día 30 con error alto (>=0.2) => baja", () => {
    expect(calcularConfianza(30, 0.3)).toBe("baja");
  });

  it("nunca devuelve alta en Fase 1", () => {
    expect(calcularConfianza(365, 0)).toBe("media");
  });
});
