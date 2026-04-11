import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

const SCHEMA_PATH = resolve(
  __dirname,
  "../../db/migrations/0001_init.sql",
);

const schema = readFileSync(SCHEMA_PATH, "utf8");

const TABLAS = [
  "usuarios",
  "predios",
  "zonas",
  "fuentes_hidricas",
  "fuente_zona",
  "clima_diario",
  "suelo_estimado",
  "fenologia_catalogo",
  "observaciones_satelitales",
  "estado_hidrico_interno",
  "recomendaciones_diarias",
  "feedback_agricultor",
] as const;

describe("schema 0001_init.sql", () => {
  it("crea las 12 tablas esperadas", () => {
    for (const tabla of TABLAS) {
      const regex = new RegExp(
        `CREATE TABLE IF NOT EXISTS\\s+${tabla}\\b`,
        "i",
      );
      expect(schema, `falta tabla ${tabla}`).toMatch(regex);
    }
  });

  it("declara las foreign keys principales", () => {
    const fks: Array<[string, string]> = [
      ["predios", "usuarios"],
      ["zonas", "predios"],
      ["fuentes_hidricas", "predios"],
      ["fuente_zona", "fuentes_hidricas"],
      ["fuente_zona", "zonas"],
      ["clima_diario", "predios"],
      ["suelo_estimado", "predios"],
      ["suelo_estimado", "zonas"],
      ["observaciones_satelitales", "zonas"],
      ["estado_hidrico_interno", "zonas"],
      ["recomendaciones_diarias", "zonas"],
      ["feedback_agricultor", "recomendaciones_diarias"],
    ];

    for (const [hijo, padre] of fks) {
      const idxHijo = schema.indexOf(`CREATE TABLE IF NOT EXISTS ${hijo}`);
      expect(idxHijo, `tabla ${hijo} no encontrada`).toBeGreaterThan(-1);
      const bloque = schema.slice(idxHijo, idxHijo + 2000);
      expect(
        bloque,
        `FK ${hijo} -> ${padre} no encontrada`,
      ).toMatch(new RegExp(`REFERENCES\\s+${padre}\\b`, "i"));
    }
  });

  it("usa SRID 4326 en todas las geometrías", () => {
    const matches = schema.match(/geometry\s*\(\s*Polygon\s*,\s*(\d+)\s*\)/gi);
    expect(matches).not.toBeNull();
    for (const m of matches!) {
      expect(m).toMatch(/4326/);
    }
  });

  it("recomendaciones_diarias no contiene columnas prohibidas (litros/mm/volumen)", () => {
    const idx = schema.indexOf(
      "CREATE TABLE IF NOT EXISTS recomendaciones_diarias",
    );
    expect(idx).toBeGreaterThan(-1);
    const bloque = schema.slice(idx, schema.indexOf(");", idx));
    expect(bloque).not.toMatch(/\blitros\b/i);
    expect(bloque).not.toMatch(/\bvolumen\b/i);
    // "mm" aparece sólo en CHECK / trigger, no como columna de esta tabla
    expect(bloque).not.toMatch(/^\s*\w*_mm\s+numeric/im);
  });

  it("habilita postgis y pgcrypto", () => {
    expect(schema).toMatch(/CREATE EXTENSION IF NOT EXISTS postgis/i);
    expect(schema).toMatch(/CREATE EXTENSION IF NOT EXISTS pgcrypto/i);
  });
});
