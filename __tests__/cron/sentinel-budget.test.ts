import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SentinelBudget } from "@/lib/cron/sentinel-budget";
import { _setEscritor, _resetEscritor } from "@/lib/cron/logger";

describe("SentinelBudget", () => {
  const capturado: string[] = [];

  beforeEach(() => {
    capturado.length = 0;
    _setEscritor((l) => {
      capturado.push(l);
    });
  });
  afterEach(() => {
    _resetEscritor();
  });

  it("inicia en cero", () => {
    const b = new SentinelBudget();
    expect(b.requestsHoy).toBe(0);
    expect(b.debePausar()).toBe(false);
  });

  it("pausa al llegar a 25 (techo default 30)", () => {
    const b = new SentinelBudget();
    for (let i = 0; i < 24; i++) b.incrementar();
    expect(b.debePausar()).toBe(false);
    b.incrementar();
    expect(b.debePausar()).toBe(true);
    const breaker = capturado.find((l) =>
      l.includes("CIRCUIT_BREAKER_SENTINEL_ACTIVO"),
    );
    expect(breaker).toBeDefined();
  });

  it("reset vuelve a cero y permite seguir", () => {
    const b = new SentinelBudget();
    for (let i = 0; i < 25; i++) b.incrementar();
    expect(b.debePausar()).toBe(true);
    b.resetearDiario();
    expect(b.requestsHoy).toBe(0);
    expect(b.debePausar()).toBe(false);
  });

  it("techo custom aplica corte proporcional", () => {
    const b = new SentinelBudget(10);
    for (let i = 0; i < 4; i++) b.incrementar();
    expect(b.debePausar()).toBe(false);
    b.incrementar();
    expect(b.debePausar()).toBe(true);
  });
});
