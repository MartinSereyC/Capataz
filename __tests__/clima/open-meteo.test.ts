import { describe, it, expect, vi, beforeEach } from 'vitest';

// We need to reset module state between tests so cache and failureCounts are fresh
// Use dynamic import after vi.stubGlobal for fetch

const mockResponse = {
  daily: {
    time: ['2024-06-01', '2024-06-02'],
    temperature_2m_min: [8.5, 9.1],
    temperature_2m_max: [20.3, 21.0],
    precipitation_sum: [0, 3.5],
  },
};

function makeFetchMock(response: unknown, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(response),
  });
}

describe('obtenerClimaHistoricoYForecast', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('builds correct URL with expected query params', async () => {
    const fetchMock = makeFetchMock(mockResponse);
    vi.stubGlobal('fetch', fetchMock);

    const { obtenerClimaHistoricoYForecast } = await import('../../src/lib/clima/open-meteo');
    await obtenerClimaHistoricoYForecast(-33.45, -70.66, 7, 7);

    const calledUrl: string = fetchMock.mock.calls[0][0];
    expect(calledUrl).toContain('latitude=-33.45');
    expect(calledUrl).toContain('longitude=-70.66');
    expect(calledUrl).toContain('past_days=7');
    expect(calledUrl).toContain('forecast_days=7');
    expect(calledUrl).toContain('temperature_2m_min');
    expect(calledUrl).toContain('temperature_2m_max');
    expect(calledUrl).toContain('precipitation_sum');
    expect(calledUrl).toContain('timezone=America%2FSantiago');
  });

  it('parses response into ClimaDiario array with correct shape', async () => {
    const fetchMock = makeFetchMock(mockResponse);
    vi.stubGlobal('fetch', fetchMock);

    const { obtenerClimaHistoricoYForecast } = await import('../../src/lib/clima/open-meteo');
    const result = await obtenerClimaHistoricoYForecast(-33.45, -70.66, 7, 7);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      fecha: '2024-06-01',
      tMin: 8.5,
      tMax: 20.3,
      precipitacionMm: 0,
      origen: 'open_meteo',
    });
    expect(result[1].precipitacionMm).toBe(3.5);
  });

  it('circuit breaker trips after 3 consecutive failures', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network error'));
    vi.stubGlobal('fetch', fetchMock);

    const { obtenerClimaHistoricoYForecast } = await import('../../src/lib/clima/open-meteo');

    // 3 failures — no cache available, each should throw
    for (let i = 0; i < 3; i++) {
      await expect(obtenerClimaHistoricoYForecast(-33.45, -70.66, 7, 7)).rejects.toThrow();
    }

    // 4th call: circuit breaker is open, fetch should NOT be called again
    await expect(obtenerClimaHistoricoYForecast(-33.45, -70.66, 7, 7)).rejects.toThrow(
      /Circuit breaker open/
    );
    // fetch was only called 3 times (not 4)
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('returns cached data on second call within 24h (no second fetch)', async () => {
    const fetchMock = makeFetchMock(mockResponse);
    vi.stubGlobal('fetch', fetchMock);

    const { obtenerClimaHistoricoYForecast } = await import('../../src/lib/clima/open-meteo');

    const first = await obtenerClimaHistoricoYForecast(-33.45, -70.66, 7, 7);
    const second = await obtenerClimaHistoricoYForecast(-33.45, -70.66, 7, 7);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });
});
