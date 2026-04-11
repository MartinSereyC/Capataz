import { describe, it, expect } from 'vitest';
import { CATALOGO_FENOLOGIA } from '../../src/lib/fenologia/catalogo';
import type { Cultivo } from '../../src/lib/fenologia/types';

const CULTIVOS: Cultivo[] = ['palto_hass', 'citricos', 'ciruela_dagen'];

describe('CATALOGO_FENOLOGIA', () => {
  it('tiene exactamente 36 entradas', () => {
    expect(CATALOGO_FENOLOGIA).toHaveLength(36);
  });

  it('cubre todas las combinaciones cultivo × mes (1-12)', () => {
    for (const cultivo of CULTIVOS) {
      for (let mes = 1; mes <= 12; mes++) {
        const entrada = CATALOGO_FENOLOGIA.find(
          (e) => e.cultivo === cultivo && e.mes === mes,
        );
        expect(entrada, `Falta entrada para ${cultivo} mes=${mes}`).toBeDefined();
      }
    }
  });

  it('todos los Kc están en rango plausible (0.3 – 1.3)', () => {
    for (const entrada of CATALOGO_FENOLOGIA) {
      expect(
        entrada.kcReferencia,
        `Kc fuera de rango: ${entrada.cultivo} mes=${entrada.mes}`,
      ).toBeGreaterThanOrEqual(0.3);
      expect(
        entrada.kcReferencia,
        `Kc fuera de rango: ${entrada.cultivo} mes=${entrada.mes}`,
      ).toBeLessThanOrEqual(1.3);
    }
  });

  it('umbral rojo > umbral amarillo en todas las entradas', () => {
    for (const entrada of CATALOGO_FENOLOGIA) {
      expect(
        entrada.umbralRojoDeficitPct,
        `Umbral rojo <= amarillo: ${entrada.cultivo} mes=${entrada.mes}`,
      ).toBeGreaterThan(entrada.umbralAmarilloDeficitPct);
    }
  });

  it('palto Hass en enero (verano) tiene Kc mayor que en julio (reposo)', () => {
    const enero = CATALOGO_FENOLOGIA.find(
      (e) => e.cultivo === 'palto_hass' && e.mes === 1,
    )!;
    const julio = CATALOGO_FENOLOGIA.find(
      (e) => e.cultivo === 'palto_hass' && e.mes === 7,
    )!;
    expect(enero.kcReferencia).toBeGreaterThan(julio.kcReferencia);
  });
});
