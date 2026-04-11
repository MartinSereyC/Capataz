import { describe, it, expect } from 'vitest';
import { muestrearPredioYZonas } from '../../src/lib/suelo/heterogeneidad';
import type { SueloEstimado } from '../../src/lib/suelo/types';

function makeSuelo(lat: number, lon: number, capacidadCampoPct: number): SueloEstimado {
  return {
    lat,
    lon,
    textura: 'franco',
    capacidadCampoPct,
    puntoMarchitezPct: capacidadCampoPct * 0.55,
    origen: 'mock',
  };
}

describe('muestrearPredioYZonas', () => {
  it('predio homogéneo (todas las muestras dentro del 10%) → heterogeneo=false', async () => {
    // All samples: 28, 29, 30, 27 → max 30, min 27, media 28.5, divergencia = (3/28.5)*100 ≈ 10.5%
    // Let's use tighter values: 28, 28, 29 → divergencia ≈ 3.5%
    const client = async (lat: number, lon: number) => {
      if (lat === -33.5) return makeSuelo(lat, lon, 28);
      if (lat === -33.6) return makeSuelo(lat, lon, 28);
      return makeSuelo(lat, lon, 29);
    };

    const resultado = await muestrearPredioYZonas(
      -33.5, -70.5,
      [
        { id: 'zona-1', lat: -33.6, lon: -70.5 },
        { id: 'zona-2', lat: -33.7, lon: -70.5 },
      ],
      client
    );

    expect(resultado.heterogeneo).toBe(false);
    expect(resultado.divergenciaMaxPct).toBeLessThanOrEqual(20);
  });

  it('predio heterogéneo (una muestra 50% diferente) → heterogeneo=true', async () => {
    // centroide: 20, zona-1: 20, zona-2: 40 → media 26.67, divergencia = (20/26.67)*100 ≈ 75%
    const client = async (lat: number, _lon: number) => {
      if (lat === -33.7) return makeSuelo(lat, _lon, 40); // outlier
      return makeSuelo(lat, _lon, 20);
    };

    const resultado = await muestrearPredioYZonas(
      -33.5, -70.5,
      [
        { id: 'zona-1', lat: -33.6, lon: -70.5 },
        { id: 'zona-2', lat: -33.7, lon: -70.5 },
      ],
      client
    );

    expect(resultado.heterogeneo).toBe(true);
    expect(resultado.divergenciaMaxPct).toBeGreaterThan(20);
  });

  it('divergenciaMaxPct se calcula correctamente', async () => {
    // centroide: 30, zona-1: 30, zona-2: 30 → divergencia = 0%
    const client = async (lat: number, lon: number) => makeSuelo(lat, lon, 30);

    const resultado = await muestrearPredioYZonas(
      -33.5, -70.5,
      [
        { id: 'zona-1', lat: -33.6, lon: -70.5 },
        { id: 'zona-2', lat: -33.7, lon: -70.5 },
      ],
      client
    );

    expect(resultado.divergenciaMaxPct).toBe(0);
    expect(resultado.heterogeneo).toBe(false);
    expect(resultado.centroidesZonas).toHaveLength(2);
    expect(resultado.centroidePredio.lat).toBe(-33.5);
  });

  it('estructura del resultado contiene centroidePredio y centroidesZonas', async () => {
    const client = async (lat: number, lon: number) => makeSuelo(lat, lon, 25);

    const resultado = await muestrearPredioYZonas(
      -34.0, -71.0,
      [{ id: 'z1', lat: -34.1, lon: -71.0 }],
      client
    );

    expect(resultado.centroidePredio.lat).toBe(-34.0);
    expect(resultado.centroidesZonas[0].zonaId).toBe('z1');
    expect(resultado.centroidesZonas[0].suelo.lat).toBe(-34.1);
  });
});
