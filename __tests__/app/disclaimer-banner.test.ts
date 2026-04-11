import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

const source = readFileSync(
  path.resolve(__dirname, "../../src/components/disclaimer-banner.tsx"),
  "utf-8"
);

describe("DisclaimerBanner", () => {
  it("contains the disclaimer Spanish string", () => {
    expect(source).toContain(
      "Herramienta de apoyo, no reemplaza el criterio del agricultor."
    );
  });

  it("uses teal background class", () => {
    expect(source).toMatch(/bg-teal-\d+/);
  });

  it("uses white text class", () => {
    expect(source).toContain("text-white");
  });

  it("is fixed position", () => {
    expect(source).toContain("fixed");
  });
});
