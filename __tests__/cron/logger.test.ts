import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  logEvento,
  logJobCorrida,
  _setEscritor,
  _resetEscritor,
} from "@/lib/cron/logger";

describe("logger estructurado", () => {
  const lineas: string[] = [];

  beforeEach(() => {
    lineas.length = 0;
    _setEscritor((l) => {
      lineas.push(l);
    });
  });
  afterEach(() => {
    _resetEscritor();
  });

  it("emite una línea JSON válida con ts, nivel, evento", () => {
    logEvento("info", "hola", { foo: 1 });
    expect(lineas.length).toBe(1);
    const obj = JSON.parse(lineas[0]);
    expect(obj.nivel).toBe("info");
    expect(obj.evento).toBe("hola");
    expect(obj.foo).toBe(1);
    expect(typeof obj.ts).toBe("string");
  });

  it("logJobCorrida incluye predioId, zonaId, duracionMs", () => {
    logJobCorrida("p1", "z1", { in: 1 }, { out: 2 }, 42);
    const obj = JSON.parse(lineas[0]);
    expect(obj.predioId).toBe("p1");
    expect(obj.zonaId).toBe("z1");
    expect(obj.duracionMs).toBe(42);
    expect(obj.error).toBeNull();
  });

  it("logJobCorrida marca nivel error cuando se pasa error", () => {
    logJobCorrida("p1", "z1", null, null, 10, new Error("bum"));
    const obj = JSON.parse(lineas[0]);
    expect(obj.nivel).toBe("error");
    expect(obj.error).toBe("bum");
  });

  it("varias llamadas producen varias líneas", () => {
    logEvento("info", "a");
    logEvento("warn", "b");
    logEvento("error", "c");
    expect(lineas.length).toBe(3);
  });
});
