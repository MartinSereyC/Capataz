import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

describe("sw.js", () => {
  const sw = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf-8");

  it("contiene la versión de caché capataz-v1", () => {
    expect(sw).toContain("capataz-v1");
  });

  it("contiene el nombre de la cola capataz-feedback-queue", () => {
    expect(sw).toContain("capataz-feedback-queue");
  });

  it("registra listener para el evento install", () => {
    expect(sw).toContain('addEventListener("install"');
  });

  it("registra listener para el evento fetch", () => {
    expect(sw).toContain('addEventListener("fetch"');
  });

  it("registra listener para el evento activate", () => {
    expect(sw).toContain('addEventListener("activate"');
  });

  it("registra listener para el evento sync", () => {
    expect(sw).toContain('addEventListener("sync"');
  });
});
