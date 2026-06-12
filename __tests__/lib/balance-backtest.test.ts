import { describe, it, expect } from "vitest";
import {
  replayBalance,
  calibrarZona,
  evaluarZona,
  PARAMETROS_NEUTROS,
  type DiaHistorico,
  type ObsHistorica,
} from "@/lib/balance/backtest";
import { ndmiToDeficit } from "@/lib/balance/asimilacion";
import type { EstadoBalance } from "@/lib/balance/paso";

const estado0: EstadoBalance = { agotamientoMm: 0, tawMm: 126, rawMm: 63 };

function fechaN(n: number): string {
  const d = new Date(2026, 0, 1);
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function diasSecos(n: number, kc = 0.8, et0 = 5): DiaHistorico[] {
  return Array.from({ length: n }, (_, i) => ({
    fecha: fechaN(i),
    et0Mm: et0,
    kc,
    precipMm: 0,
    riegoMm: 0,
    riegoAsumido: true,
  }));
}

// NDMI consistent with a given deficit bucket (inverse of ndmiToDeficit)
function ndmiParaDeficit(deficitPct: number): number {
  if (deficitPct <= 10) return 0.4;
  if (deficitPct <= 25) return 0.2;
  if (deficitPct <= 45) return 0.0;
  if (deficitPct <= 65) return -0.2;
  return -0.4;
}

describe("replayBalance", () => {
  it("is deterministic", () => {
    const dias = diasSecos(30);
    const obs: ObsHistorica[] = [{ fecha: fechaN(10), sensor: 's2', ndmi: 0.1, nubosidadPct: 5 }];
    const a = replayBalance(estado0, dias, obs);
    const b = replayBalance(estado0, dias, obs);
    expect(a.estadoFinal).toEqual(b.estadoFinal);
    expect(a.errores).toEqual(b.errores);
  });

  it("records pre-anchor error with walk-forward horizon", () => {
    const dias = diasSecos(20);
    const obs: ObsHistorica[] = [
      { fecha: fechaN(5), sensor: 's2', ndmi: 0.0, nubosidadPct: 5 },
      { fecha: fechaN(12), sensor: 's2', ndmi: 0.0, nubosidadPct: 5 },
    ];
    const r = replayBalance(estado0, dias, obs);
    expect(r.errores).toHaveLength(2);
    expect(r.errores[0].horizonteDias).toBe(6); // days 0..5 blind from start
    expect(r.errores[1].horizonteDias).toBe(7); // days since first anchor
  });

  it("anchoring pulls the state toward the satellite reading", () => {
    const dias = diasSecos(10);
    const obsSeca: ObsHistorica[] = [{ fecha: fechaN(5), sensor: 's2', ndmi: -0.4, nubosidadPct: 5 }];
    const sinAnclaje = replayBalance(estado0, dias, [], PARAMETROS_NEUTROS, false);
    const conAnclaje = replayBalance(estado0, dias, obsSeca, PARAMETROS_NEUTROS, true);
    // satellite says 80% deficit — anchored run must end drier than blind run
    expect(conAnclaje.estadoFinal.agotamientoMm).toBeGreaterThan(sinAnclaje.estadoFinal.agotamientoMm);
  });

  it("skips cloudy observations entirely", () => {
    const dias = diasSecos(10);
    const obs: ObsHistorica[] = [{ fecha: fechaN(5), sensor: 's2', ndmi: -0.4, nubosidadPct: 90 }];
    const r = replayBalance(estado0, dias, obs);
    expect(r.errores).toHaveLength(0);
    expect(r.pasos[5].fuenteAnclaje).toBeNull();
  });

  it("kcFactor scales the drawdown", () => {
    const dias = diasSecos(10);
    const lento = replayBalance(estado0, dias, [], { kcFactor: 0.7, ndmiOffset: 0 }, false);
    const rapido = replayBalance(estado0, dias, [], { kcFactor: 1.3, ndmiOffset: 0 }, false);
    expect(rapido.estadoFinal.agotamientoMm).toBeGreaterThan(lento.estadoFinal.agotamientoMm);
  });
});

describe("calibrarZona", () => {
  it("recovers a known Kc bias from synthetic observations", () => {
    // "Truth": crop actually consumes at kc*1.25. Periodic rain keeps the
    // trajectory inside the informative range of the NDMI mapping (the
    // buckets saturate at 80%, where any slow model would look good).
    const nDias = 90;
    const dias = diasSecos(nDias, 0.8, 7).map((d, i) =>
      i > 0 && i % 10 === 0 ? { ...d, precipMm: 60 } : d,
    );
    const verdad = replayBalance(estado0, dias, [], { kcFactor: 1.25, ndmiOffset: 0 }, false);

    const obs: ObsHistorica[] = [];
    for (let i = 4; i < nDias; i += 5) {
      const deficitReal = verdad.pasos[i].deficitPct;
      obs.push({ fecha: fechaN(i), sensor: 's2', ndmi: ndmiParaDeficit(deficitReal), nubosidadPct: 5 });
    }

    const cal = calibrarZona(estado0, dias, obs);
    expect(cal.maeTrain).not.toBeNull();
    expect(cal.params.kcFactor).toBeGreaterThan(1);
    expect(cal.nObservaciones).toBeGreaterThan(10);

    // calibrated params must beat neutral on the same window
    const neutralReplay = replayBalance(estado0, dias, obs, PARAMETROS_NEUTROS, true);
    const neutralMae = neutralReplay.errores.reduce((s, e) => s + Math.abs(e.errorPct), 0) / neutralReplay.errores.length;
    expect(cal.maeTrain!).toBeLessThanOrEqual(neutralMae);
  });

  it("returns neutral params when there are no usable observations", () => {
    const cal = calibrarZona(estado0, diasSecos(30), []);
    expect(cal.params).toEqual(PARAMETROS_NEUTROS);
    expect(cal.maeTrain).toBeNull();
  });
});

describe("evaluarZona", () => {
  it("produces MAE, bias and per-horizon buckets", () => {
    const dias = diasSecos(60);
    const obs: ObsHistorica[] = [];
    for (let i = 4; i < 60; i += 5) {
      obs.push({ fecha: fechaN(i), sensor: 's2', ndmi: 0.0, nubosidadPct: 5 });
    }
    const ev = evaluarZona(estado0, dias, obs, PARAMETROS_NEUTROS);
    expect(ev.nObservaciones).toBeGreaterThan(0);
    expect(ev.maeDeficitPct).not.toBeNull();
    expect(ev.biasDeficitPct).not.toBeNull();
    expect(Object.keys(ev.errorPorHorizonte).length).toBeGreaterThan(0);
    // 5-day cadence → all horizons fall in the 4-7d bucket
    expect(ev.errorPorHorizonte['4-7d']).toBeDefined();
  });

  it("returns empty evaluation without observations", () => {
    const ev = evaluarZona(estado0, diasSecos(30), [], PARAMETROS_NEUTROS);
    expect(ev.nObservaciones).toBe(0);
    expect(ev.maeDeficitPct).toBeNull();
  });

  it("a well-calibrated model scores lower MAE than a biased one", () => {
    const nDias = 60;
    const dias = diasSecos(nDias, 0.8, 5);
    const verdad = replayBalance(estado0, dias, [], { kcFactor: 1.25, ndmiOffset: 0 }, false);
    const obs: ObsHistorica[] = [];
    for (let i = 4; i < nDias; i += 5) {
      obs.push({ fecha: fechaN(i), sensor: 's2', ndmi: ndmiParaDeficit(verdad.pasos[i].deficitPct), nubosidadPct: 5 });
    }
    const evBuena = evaluarZona(estado0, dias, obs, { kcFactor: 1.25, ndmiOffset: 0 });
    const evMala = evaluarZona(estado0, dias, obs, { kcFactor: 0.7, ndmiOffset: 0 });
    expect(evBuena.maeDeficitPct!).toBeLessThan(evMala.maeDeficitPct!);
  });
});

// Guard: ndmiParaDeficit must actually invert ndmiToDeficit's buckets
describe("test helper consistency", () => {
  it("ndmiParaDeficit inverts ndmiToDeficit", () => {
    for (const d of [10, 25, 45, 65, 80]) {
      expect(ndmiToDeficit(ndmiParaDeficit(d))).toBe(d);
    }
  });
});
