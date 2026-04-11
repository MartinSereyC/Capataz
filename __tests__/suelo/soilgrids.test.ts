import { describe, it, expect, vi, beforeEach } from 'vitest';
import { obtenerSuelo, _clearCacheForTests } from '../../src/lib/suelo/soilgrids';

function buildFakeResponse(sandGkg: number, clayGkg: number, siltGkg: number) {
  const makeLayer = (name: string, value: number) => ({
    name,
    depths: [
      { label: '0-5cm', values: { mean: value } },
      { label: '5-15cm', values: { mean: value } },
    ],
  });
  return {
    properties: {
      layers: [
        makeLayer('sand', sandGkg),
        makeLayer('clay', clayGkg),
        makeLayer('silt', siltGkg),
      ],
    },
  };
}

describe('obtenerSuelo (soilgrids)', () => {
  beforeEach(() => {
    _clearCacheForTests();
    vi.restoreAllMocks();
  });

  it('construye la URL correctamente con lat y lon', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => buildFakeResponse(400, 200, 400),
    } as Response);

    await obtenerSuelo(-33.5, -70.6);

    expect(fetchSpy).toHaveBeenCalledOnce();
    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain('lat=-33.5');
    expect(url).toContain('lon=-70.6');
    expect(url).toContain('property=sand');
    expect(url).toContain('property=clay');
  });

  it('parsea sand y clay correctamente desde g/kg a porcentaje', async () => {
    // 600 g/kg sand = 60%, 100 g/kg clay = 10% → franco-arenoso
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => buildFakeResponse(600, 100, 300),
    } as Response);

    const suelo = await obtenerSuelo(-33.0, -71.0);
    expect(suelo.textura).toBe('franco-arenoso');
    expect(suelo.origen).toBe('soilgrids');
  });

  it('clasifica arenoso cuando sand >= 70 y clay < 15', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => buildFakeResponse(750, 100, 150),
    } as Response);

    const suelo = await obtenerSuelo(-32.0, -71.0);
    expect(suelo.textura).toBe('arenoso');
  });

  it('clasifica arcilloso cuando clay >= 40', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => buildFakeResponse(200, 450, 350),
    } as Response);

    const suelo = await obtenerSuelo(-34.0, -71.0);
    expect(suelo.textura).toBe('arcilloso');
  });

  it('clasifica franco-arcilloso', async () => {
    // clay >= 27, sand <= 45
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => buildFakeResponse(350, 320, 330),
    } as Response);

    const suelo = await obtenerSuelo(-34.5, -71.0);
    expect(suelo.textura).toBe('franco-arcilloso');
  });

  it('clasifica franco (default)', async () => {
    // sand ~40, clay ~20 → franco
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => buildFakeResponse(400, 200, 400),
    } as Response);

    const suelo = await obtenerSuelo(-35.0, -71.0);
    expect(suelo.textura).toBe('franco');
  });

  it('usa cache: la segunda llamada con mismas coords no hace fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => buildFakeResponse(400, 200, 400),
    } as Response);

    const a = await obtenerSuelo(-33.5, -70.5);
    const b = await obtenerSuelo(-33.5, -70.5);

    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(a).toBe(b); // same reference from cache
  });
});
