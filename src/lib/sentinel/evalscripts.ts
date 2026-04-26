import type { SatelliteLayerType } from "@/types";

export const EVALSCRIPTS: Record<SatelliteLayerType, string> = {
  "true-color": `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B04", "B03", "B02"] }],
    output: { bands: 3 }
  };
}
function evaluatePixel(sample) {
  return [3.5 * sample.B04, 3.5 * sample.B03, 3.5 * sample.B02];
}`,

  ndvi: `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B08", "B04"] }],
    output: { bands: 3 }
  };
}
function evaluatePixel(sample) {
  var ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04);

  if (ndvi < 0.1) {
    return [0.80, 0.10, 0.10];
  } else if (ndvi < 0.25) {
    return [0.90, 0.55, 0.10];
  } else if (ndvi < 0.45) {
    return [0.95, 0.85, 0.15];
  } else if (ndvi < 0.65) {
    return [0.30, 0.70, 0.15];
  } else {
    return [0.05, 0.40, 0.05];
  }
}`,

  ndmi: `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B08", "B11"] }],
    output: { bands: 3 }
  };
}
function evaluatePixel(sample) {
  var ndmi = (sample.B08 - sample.B11) / (sample.B08 + sample.B11);

  if (ndmi < -0.2) {
    return [0.65, 0.25, 0.05];
  } else if (ndmi < 0.0) {
    return [0.90, 0.60, 0.15];
  } else if (ndmi < 0.2) {
    return [0.95, 0.90, 0.30];
  } else if (ndmi < 0.4) {
    return [0.20, 0.55, 0.80];
  } else {
    return [0.10, 0.15, 0.60];
  }
}`,

  ndwi: `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B03", "B08"] }],
    output: { bands: 3 }
  };
}
function evaluatePixel(sample) {
  var ndwi = (sample.B03 - sample.B08) / (sample.B03 + sample.B08);

  if (ndwi < -0.3) {
    return [0.85, 0.80, 0.70];
  } else if (ndwi < 0.0) {
    return [0.70, 0.80, 0.60];
  } else if (ndwi < 0.15) {
    return [0.50, 0.75, 0.90];
  } else if (ndwi < 0.3) {
    return [0.15, 0.45, 0.80];
  } else {
    return [0.05, 0.15, 0.55];
  }
}`,

  radar: `//VERSION=3
// Sentinel-1 false-color radar composite.
// VV and VH are linear backscatter in power. We convert to dB, stretch to 0-1
// and build an RGB where:
//   Red   = VV (surface roughness / built / bare soil)
//   Green = VH (volume scattering / vegetation)
//   Blue  = VV/VH ratio (water + smooth surfaces)
// Result: vegetation -> green, bare soil -> brownish, water -> near black.
function setup() {
  return {
    input: [{ bands: ["VV", "VH"] }],
    output: { bands: 3 }
  };
}

function toDb(linear) {
  return 10 * Math.log(Math.max(linear, 1e-6)) / Math.LN10;
}

function stretch(db, minDb, maxDb) {
  var v = (db - minDb) / (maxDb - minDb);
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function evaluatePixel(sample) {
  var vvDb = toDb(sample.VV);
  var vhDb = toDb(sample.VH);

  // Typical Sentinel-1 IW GRD dB ranges for land scenes.
  var r = stretch(vvDb, -20, 0);
  var g = stretch(vhDb, -25, -5);
  var ratio = vvDb - vhDb; // dB ratio
  var b = stretch(ratio, 0, 15);

  return [r, g, b];
}`,
};

export default EVALSCRIPTS;
