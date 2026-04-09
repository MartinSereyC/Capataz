import { describe, it, expect } from "vitest";
import { parseCoordinates, detectUTMZone } from "@/lib/pdf/parse-coordinates";

describe("parseCoordinates", () => {
  // --- UTM Norte/Este format ---
  it("extracts UTM Zone 19S coordinates with Norte/Este labels", () => {
    const text = `
      Punto 1: Norte: 6,297,515 Este: 344,899
      Punto 2: Norte: 6,297,600 Este: 344,950
      Punto 3: Norte: 6,297,450 Este: 345,010
    `;
    const result = parseCoordinates(text);
    expect(result).not.toBeNull();
    expect(result!.format).toBe("UTM_19S");
    expect(result!.utmZone).toBe(19);
    expect(result!.rawPairs).toHaveLength(3);
    // [easting, northing] pairs
    expect(result!.rawPairs[0][0]).toBe(344899); // easting
    expect(result!.rawPairs[0][1]).toBe(6297515); // northing
  });

  // --- UTM N/E format ---
  it("extracts UTM Zone 18S coordinates with N/E labels", () => {
    const text = `
      N: 7,234,100, E: 512,300
      N: 7,234,200, E: 512,400
      N: 7,234,050, E: 512,500
    `;
    const result = parseCoordinates(text);
    expect(result).not.toBeNull();
    expect(result!.format).toBe("UTM_18S");
    expect(result!.utmZone).toBe(18);
    expect(result!.rawPairs).toHaveLength(3);
  });

  // --- Zone detection from "Huso 18" keyword ---
  it("detects Zone 18S from Huso 18 keyword", () => {
    const text = `
      Coordenadas en Huso 18 S
      Norte: 7,000,000 Este: 344,000
      Norte: 7,000,100 Este: 344,100
      Norte: 7,000,050 Este: 344,200
    `;
    const result = parseCoordinates(text);
    expect(result).not.toBeNull();
    expect(result!.utmZone).toBe(18);
    expect(result!.format).toBe("UTM_18S");
  });

  // --- Zone detection via easting heuristic ---
  it("detects Zone 18S from easting value above 500000", () => {
    // Explicit N/E with high easting values (> 500 000)
    const text = `
      N: 7,100,000, E: 650,000
      N: 7,100,100, E: 650,100
      N: 7,100,050, E: 650,200
    `;
    const result = parseCoordinates(text);
    expect(result).not.toBeNull();
    expect(result!.utmZone).toBe(18);
  });

  // --- Decimal lat/long ---
  it("extracts decimal lat/long coordinates", () => {
    const text = `
      Vértice A: -33.4489, -70.6693
      Vértice B: -33.4500, -70.6700
      Vértice C: -33.4480, -70.6710
    `;
    const result = parseCoordinates(text);
    expect(result).not.toBeNull();
    expect(result!.format).toBe("LATLONG_DECIMAL");
    expect(result!.rawPairs).toHaveLength(3);
    // stored as [lng, lat]
    expect(result!.rawPairs[0][0]).toBeCloseTo(-70.6693, 4);
    expect(result!.rawPairs[0][1]).toBeCloseTo(-33.4489, 4);
  });

  // --- DMS format ---
  it("extracts DMS format coordinates", () => {
    const text = `
      33°26'56"S 70°40'10"O
      33°27'00"S 70°40'20"O
      33°26'50"S 70°40'30"O
    `;
    const result = parseCoordinates(text);
    expect(result).not.toBeNull();
    expect(result!.format).toBe("LATLONG_DMS");
    expect(result!.rawPairs).toHaveLength(3);
    // Lat should be negative (S), Lng should be negative (O = Oeste = West)
    expect(result!.rawPairs[0][1]).toBeLessThan(0); // lat negative
    expect(result!.rawPairs[0][0]).toBeLessThan(0); // lng negative
  });

  // --- No coordinates found ---
  it("returns null when no coordinates are found", () => {
    const text = "Este es un documento sin coordenadas. Texto de prueba.";
    const result = parseCoordinates(text);
    expect(result).toBeNull();
  });

  // --- Garbled/partial coordinates ---
  it("returns null gracefully for garbled partial coordinates", () => {
    const text = `
      Norte: abc Este: xyz
      N: , E:
      33°abc'def"S
    `;
    const result = parseCoordinates(text);
    expect(result).toBeNull();
  });

  // --- Empty text ---
  it("returns null for empty text", () => {
    expect(parseCoordinates("")).toBeNull();
    expect(parseCoordinates("   ")).toBeNull();
  });
});

describe("detectUTMZone", () => {
  it("detects zone 18 from Huso 18 keyword", () => {
    expect(detectUTMZone("Coordenadas Huso 18S", [])).toBe(18);
  });

  it("detects zone 19 from Huso 19 keyword", () => {
    expect(detectUTMZone("Sistema UTM Huso 19", [])).toBe(19);
  });

  it("detects zone 18 from easting heuristic above 500000", () => {
    expect(detectUTMZone("sin zona explícita", [650000, 640000])).toBe(18);
  });

  it("detects zone 19 from easting heuristic below 500000", () => {
    expect(detectUTMZone("sin zona explícita", [344000, 345000])).toBe(19);
  });

  it("defaults to zone 19 when ambiguous", () => {
    expect(detectUTMZone("texto sin info de zona", [])).toBe(19);
  });
});
