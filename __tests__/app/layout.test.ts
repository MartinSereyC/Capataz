import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

const layoutPath = path.resolve(__dirname, "../../src/app/layout.tsx");
const layoutSource = readFileSync(layoutPath, "utf-8");

const disclaimerPath = path.resolve(
  __dirname,
  "../../src/components/disclaimer-banner.tsx"
);

describe("root layout", () => {
  it("references /manifest.json", () => {
    expect(layoutSource).toContain("/manifest.json");
  });

  it("sets lang to es-CL", () => {
    expect(layoutSource).toContain('lang="es-CL"');
  });

  it("mounts DisclaimerBanner", () => {
    expect(layoutSource).toContain("DisclaimerBanner");
  });

  it("mounts RegisterSW", () => {
    expect(layoutSource).toContain("RegisterSW");
  });

  it("disclaimer-banner component file exists", () => {
    const fs = require("fs");
    expect(fs.existsSync(disclaimerPath)).toBe(true);
  });
});
