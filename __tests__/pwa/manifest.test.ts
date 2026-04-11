import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

describe("manifest.json", () => {
  const raw = readFileSync(resolve(process.cwd(), "public/manifest.json"), "utf-8");
  const manifest = JSON.parse(raw);

  it("es JSON válido", () => {
    expect(manifest).toBeTruthy();
  });

  it("tiene name", () => {
    expect(manifest.name).toBe("Capataz");
  });

  it("tiene short_name", () => {
    expect(manifest.short_name).toBe("Capataz");
  });

  it("tiene start_url /hoy", () => {
    expect(manifest.start_url).toBe("/hoy");
  });

  it("tiene display standalone", () => {
    expect(manifest.display).toBe("standalone");
  });

  it("tiene theme_color", () => {
    expect(manifest.theme_color).toBeDefined();
  });

  it("tiene al menos un icono", () => {
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThan(0);
  });

  it("tiene lang es-CL", () => {
    expect(manifest.lang).toBe("es-CL");
  });
});
