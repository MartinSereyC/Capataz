import { describe, it, expect } from 'vitest';
import { generarClimaMock } from '../../src/lib/clima/mock';

const LAT = -33.45;
const LON = -70.66;
const DESDE = new Date('2024-06-01');
const DIAS = 30;

describe('generarClimaMock', () => {
  it('is deterministic: same inputs produce identical outputs', () => {
    const a = generarClimaMock(LAT, LON, DESDE, DIAS);
    const b = generarClimaMock(LAT, LON, DESDE, DIAS);
    expect(a).toEqual(b);
  });

  it('generates exactly the requested number of days', () => {
    const result = generarClimaMock(LAT, LON, DESDE, DIAS);
    expect(result).toHaveLength(DIAS);
  });

  it('all values are within plausible Chilean central-zone ranges', () => {
    const result = generarClimaMock(LAT, LON, DESDE, DIAS);
    for (const day of result) {
      expect(day.tMin).toBeGreaterThanOrEqual(5);
      expect(day.tMin).toBeLessThanOrEqual(18);
      expect(day.tMax).toBeGreaterThanOrEqual(15);
      expect(day.tMax).toBeLessThanOrEqual(32);
      expect(day.precipitacionMm).toBeGreaterThanOrEqual(0);
      expect(day.precipitacionMm).toBeLessThanOrEqual(15);
    }
  });

  it('origen is always mock', () => {
    const result = generarClimaMock(LAT, LON, DESDE, DIAS);
    for (const day of result) {
      expect(day.origen).toBe('mock');
    }
  });

  it('has 3-5 rain days with precipitation > 0', () => {
    const result = generarClimaMock(LAT, LON, DESDE, DIAS);
    const rainDays = result.filter((d) => d.precipitacionMm > 0);
    expect(rainDays.length).toBeGreaterThanOrEqual(3);
    expect(rainDays.length).toBeLessThanOrEqual(5);
  });

  it('fecha format is YYYY-MM-DD', () => {
    const result = generarClimaMock(LAT, LON, DESDE, DIAS);
    for (const day of result) {
      expect(day.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('different coordinates produce different output', () => {
    const a = generarClimaMock(LAT, LON, DESDE, DIAS);
    const b = generarClimaMock(-34.0, -71.0, DESDE, DIAS);
    expect(a).not.toEqual(b);
  });
});
