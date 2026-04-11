import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('obtenerClima facade', () => {
  beforeEach(() => {
    process.env.USE_MOCK_CLIMA = 'true';
  });

  afterEach(() => {
    delete process.env.USE_MOCK_CLIMA;
  });

  it('uses mock when USE_MOCK_CLIMA=true', async () => {
    // Must import after setting env var so the module sees the flag
    const { obtenerClima } = await import('../../src/lib/clima/index');
    const result = await obtenerClima(-33.45, -70.66, 7, 7);

    expect(result.length).toBeGreaterThan(0);
    for (const day of result) {
      expect(day.origen).toBe('mock');
    }
  });

  it('returns ClimaDiario array with correct fields', async () => {
    const { obtenerClima } = await import('../../src/lib/clima/index');
    const result = await obtenerClima(-33.45, -70.66, 7, 7);

    for (const day of result) {
      expect(day).toHaveProperty('fecha');
      expect(day).toHaveProperty('tMin');
      expect(day).toHaveProperty('tMax');
      expect(day).toHaveProperty('precipitacionMm');
      expect(day).toHaveProperty('origen');
    }
  });

  it('returns diasHistorico + diasForecast days total', async () => {
    const { obtenerClima } = await import('../../src/lib/clima/index');
    const result = await obtenerClima(-33.45, -70.66, 5, 7);
    expect(result).toHaveLength(12);
  });
});
