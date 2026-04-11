import { describe, it, expect } from 'vitest';
import { obtenerSueloMock } from '../../src/lib/suelo/mock';

describe('obtenerSueloMock', () => {
  it('es determinista: mismas coords siempre retornan el mismo resultado', () => {
    const a = obtenerSueloMock(-32.85, -71.25);
    const b = obtenerSueloMock(-32.85, -71.25);
    expect(a).toEqual(b);
  });

  it('Quillota retorna suelo franco apto para paltas', () => {
    // Quillota bbox: lat -32.95 to -32.75, lon -71.35 to -71.15
    const suelo = obtenerSueloMock(-32.85, -71.25);
    expect(suelo.textura).toBe('franco');
    expect(suelo.capacidadCampoPct).toBeGreaterThan(20);
    expect(suelo.origen).toBe('mock');
  });

  it('coordenadas desconocidas retornan fallback franco con valores por defecto', () => {
    const suelo = obtenerSueloMock(0, 0);
    expect(suelo.textura).toBe('franco');
    expect(suelo.capacidadCampoPct).toBe(28);
    expect(suelo.puntoMarchitezPct).toBeCloseTo(15.4, 1);
    expect(suelo.origen).toBe('mock');
  });

  it('Rancagua retorna franco-arcilloso', () => {
    const suelo = obtenerSueloMock(-34.15, -70.7);
    expect(suelo.textura).toBe('franco-arcilloso');
  });

  it('Buin retorna arcilloso', () => {
    const suelo = obtenerSueloMock(-33.75, -70.75);
    expect(suelo.textura).toBe('arcilloso');
  });
});
