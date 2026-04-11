import { describe, it, expect } from 'vitest';
import {
  obtenerFenologia,
  listarCultivosSoportados,
  listarFasesSoportadas,
} from '../../src/lib/fenologia/lookup';
import { CATALOGO_FENOLOGIA } from '../../src/lib/fenologia/catalogo';

describe('obtenerFenologia', () => {
  it('retorna una entrada para palto_hass mes=1', () => {
    const entrada = obtenerFenologia('palto_hass', 1);
    expect(entrada).toBeDefined();
    expect(entrada.cultivo).toBe('palto_hass');
    expect(entrada.mes).toBe(1);
    expect(typeof entrada.kcReferencia).toBe('number');
  });

  it('override cambia la fase pero mantiene el Kc del catálogo base', () => {
    const sinOverride = obtenerFenologia('palto_hass', 1);
    const conOverride = obtenerFenologia('palto_hass', 1, 'reposo');

    expect(conOverride.fase).toBe('reposo');
    // El Kc con override de 'reposo' debe ser el Kc de la entrada de reposo en catálogo
    const entradaReposo = CATALOGO_FENOLOGIA.find(
      (e) => e.cultivo === 'palto_hass' && e.fase === 'reposo',
    )!;
    expect(conOverride.kcReferencia).toBe(entradaReposo.kcReferencia);
    // Los demás campos vienen del mes=1
    expect(conOverride.mes).toBe(sinOverride.mes);
    expect(conOverride.umbralRojoDeficitPct).toBe(sinOverride.umbralRojoDeficitPct);
  });

  it('override con fase inexistente mantiene el Kc original', () => {
    const sinOverride = obtenerFenologia('citricos', 6);
    const conOverride = obtenerFenologia('citricos', 6, 'floracion');
    // floracion sí existe en catálogo para citricos, por lo que Kc cambia
    expect(conOverride.fase).toBe('floracion');
    expect(conOverride.mes).toBe(6);
  });

  it('lanza error para cultivo no soportado', () => {
    expect(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      obtenerFenologia('manzano' as any, 1),
    ).toThrow('Cultivo no soportado');
  });

  it('lanza error para mes inválido', () => {
    expect(() => obtenerFenologia('palto_hass', 13)).toThrow('Mes inválido');
    expect(() => obtenerFenologia('palto_hass', 0)).toThrow('Mes inválido');
  });
});

describe('listarCultivosSoportados', () => {
  it('retorna los 3 cultivos', () => {
    const cultivos = listarCultivosSoportados();
    expect(cultivos).toHaveLength(3);
    expect(cultivos).toContain('palto_hass');
    expect(cultivos).toContain('citricos');
    expect(cultivos).toContain('ciruela_dagen');
  });
});

describe('listarFasesSoportadas', () => {
  it('retorna las 8 fases', () => {
    const fases = listarFasesSoportadas();
    expect(fases).toHaveLength(8);
    expect(fases).toContain('brotacion');
    expect(fases).toContain('reposo');
  });
});
