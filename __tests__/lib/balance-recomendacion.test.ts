import { describe, it, expect } from "vitest";
import {
  calcularRecomendacion,
  deficitToRecomendacion,
  simularDiasHastaEstres,
  derivarConfianza,
  priorizarZonas,
  type EntradaRecomendacion,
  type DiaPronostico,
} from "@/lib/balance/recomendacion";
import type { EstadoBalance } from "@/lib/balance/paso";
import type { EntradaFenologica } from "@/lib/fenologia/types";

const fen: EntradaFenologica = {
  cultivo: 'palto_hass',
  mes: 1,
  fase: 'desarrollo_fruto',
  kcReferencia: 0.85,
  umbralRojoDeficitPct: 50,
  umbralAmarilloDeficitPct: 35,
  fuente: 'test',
  notas: '',
};

function pronosticoSeco(dias = 7, et0 = 5): DiaPronostico[] {
  return Array.from({ length: dias }, (_, i) => ({
    fecha: `2026-01-${String(i + 16).padStart(2, '0')}`,
    et0Mm: et0,
    precipMm: 0,
  }));
}

function entrada(deficitPct: number, overrides: Partial<EntradaRecomendacion> = {}): EntradaRecomendacion {
  const tawMm = 126;
  const estado: EstadoBalance = {
    agotamientoMm: (deficitPct / 100) * tawMm,
    tawMm,
    rawMm: 63,
  };
  return {
    estado,
    deficitPct,
    fen,
    pronostico: pronosticoSeco(),
    fuentes: ['clima', 'suelo'],
    diasDesdeS2: 3,
    diasDesdeS1: null,
    riegoAsumido: false,
    ...overrides,
  };
}

describe("deficitToRecomendacion", () => {
  it("maps deficit vs phenology thresholds to semaforo", () => {
    expect(deficitToRecomendacion(55, 50, 35).semaforo).toBe('rojo');
    expect(deficitToRecomendacion(45, 50, 35)).toEqual({ semaforo: 'amarillo', timing: 'mañana' });
    expect(deficitToRecomendacion(37, 50, 35)).toEqual({ semaforo: 'amarillo', timing: '3-4 días' });
    expect(deficitToRecomendacion(20, 50, 35).semaforo).toBe('verde');
  });
});

describe("simularDiasHastaEstres", () => {
  it("returns 0 when already past the red threshold", () => {
    const estado: EstadoBalance = { agotamientoMm: 70, tawMm: 126, rawMm: 63 };
    expect(simularDiasHastaEstres(estado, 0.85, 50, pronosticoSeco())).toBe(0);
  });

  it("projects days until crossing under dry forecast", () => {
    // deficit 40% (Dr=50.4), red at 50% (Dr=63): ETc ≈ 4.25 mm/day → ~3 days
    const estado: EstadoBalance = { agotamientoMm: 50.4, tawMm: 126, rawMm: 63 };
    const d = simularDiasHastaEstres(estado, 0.85, 50, pronosticoSeco());
    expect(d).toBe(3);
  });

  it("returns null when stress is beyond the 14-day horizon", () => {
    const estado: EstadoBalance = { agotamientoMm: 5, tawMm: 126, rawMm: 63 };
    expect(simularDiasHastaEstres(estado, 0.3, 50, pronosticoSeco(7, 1))).toBeNull();
  });

  it("rain in the forecast delays the crossing", () => {
    const estado: EstadoBalance = { agotamientoMm: 50.4, tawMm: 126, rawMm: 63 };
    const conLluvia = pronosticoSeco().map((d, i) => i === 1 ? { ...d, precipMm: 20 } : d);
    const sinLluvia = simularDiasHastaEstres(estado, 0.85, 50, pronosticoSeco())!;
    const con = simularDiasHastaEstres(estado, 0.85, 50, conLluvia);
    expect(con === null || con > sinLluvia).toBe(true);
  });
});

describe("calcularRecomendacion", () => {
  it("verde: no lamina", () => {
    const r = calcularRecomendacion(entrada(15));
    expect(r.semaforo).toBe('verde');
    expect(r.laminaMm).toBeNull();
  });

  it("rojo: lamina refills the depleted reservoir", () => {
    const r = calcularRecomendacion(entrada(55));
    expect(r.semaforo).toBe('rojo');
    expect(r.timing).toBe('hoy');
    // lamina = Dr = 55% de 126 ≈ 69 mm
    expect(r.laminaMm).toBe(69);
  });

  it("postpones when forecast rain covers >=80% of the lamina", () => {
    // deficit 37% → lamina ≈ 47 mm; rain 60mm*0.8=48mm effective on day 2
    const pron = pronosticoSeco().map((d, i) => (i === 1 ? { ...d, precipMm: 60 } : d));
    const r = calcularRecomendacion(entrada(37, { pronostico: pron }));
    expect(r.postergar).toBe(true);
    expect(r.lluviaProximaMm).toBeCloseTo(48, 1);
    expect(r.lluviaProximaDias).toBe(2);
    expect(r.timing).toBe('no urgente'); // degraded one step from '3-4 días'
  });

  it("does not postpone for insufficient rain", () => {
    const pron = pronosticoSeco().map((d, i) => (i === 1 ? { ...d, precipMm: 8 } : d));
    const r = calcularRecomendacion(entrada(55, { pronostico: pron }));
    expect(r.postergar).toBe(false);
    expect(r.timing).toBe('hoy');
  });

  it("flags the no-irrigation-log assumption", () => {
    const r = calcularRecomendacion(entrada(40, { riegoAsumido: true }));
    expect(r.supuestos).toContain('sin_registro_riego');
  });
});

describe("derivarConfianza", () => {
  it("uses measured hindcast error when available", () => {
    expect(derivarConfianza(2, null, { '0-3d': 3.2 })).toBe('alta');
    expect(derivarConfianza(2, null, { '0-3d': 7.5 })).toBe('media');
    expect(derivarConfianza(9, null, { '8-14d': 14 })).toBe('baja');
  });

  it("falls back to freshness rules without evaluation", () => {
    expect(derivarConfianza(3, null, null)).toBe('alta');
    expect(derivarConfianza(10, 5, null)).toBe('media');
    expect(derivarConfianza(20, 20, null)).toBe('baja');
  });
});

describe("priorizarZonas", () => {
  it("orders rojo > amarillo > verde, then days-to-stress, then deficit", () => {
    const mk = (semaforo: 'verde' | 'amarillo' | 'rojo', dias: number | null, deficit: number) => ({
      semaforo, timing: 'hoy' as const, laminaMm: 10, diasHastaEstres: dias,
      lluviaProximaMm: null, lluviaProximaDias: null, postergar: false,
      confianza: 'alta' as const, deficitPct: deficit, supuestos: [],
    });
    const ranked = priorizarZonas([
      { zoneId: 'verde-zone', rec: mk('verde', null, 10) },
      { zoneId: 'rojo-lento', rec: mk('rojo', 2, 55) },
      { zoneId: 'rojo-urgente', rec: mk('rojo', 0, 60) },
      { zoneId: 'amarillo', rec: mk('amarillo', 5, 40) },
    ]);
    expect(ranked.map((r) => r.zoneId)).toEqual(['rojo-urgente', 'rojo-lento', 'amarillo', 'verde-zone']);
    expect(ranked[0].prioridad).toBe(1);
  });
});
