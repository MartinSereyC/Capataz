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

  // Color ramp: red (-0.2 and below) → yellow (0.2) → dark green (0.8+)
  if (ndvi <= -0.2) {
    return [0.8, 0.0, 0.0];
  } else if (ndvi <= 0.2) {
    var t = (ndvi + 0.2) / 0.4;
    return [0.8 - 0.0 * t, 0.0 + 0.8 * t, 0.0];
  } else if (ndvi <= 0.8) {
    var t = (ndvi - 0.2) / 0.6;
    return [0.8 - 0.8 * t, 0.8 - 0.6 * t, 0.0];
  } else {
    return [0.0, 0.2, 0.0];
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

  // Color ramp: brown/dry (-0.2 and below) → yellow (0.2) → blue/wet (0.6+)
  if (ndmi <= -0.2) {
    return [0.6, 0.3, 0.0];
  } else if (ndmi <= 0.2) {
    var t = (ndmi + 0.2) / 0.4;
    return [0.6 - 0.6 * t, 0.3 + 0.5 * t, 0.0 + 0.0 * t];
  } else if (ndmi <= 0.6) {
    var t = (ndmi - 0.2) / 0.4;
    return [0.0, 0.8 - 0.8 * t, 0.0 + 1.0 * t];
  } else {
    return [0.0, 0.0, 1.0];
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

  // Color ramp: white/dry land (below 0) → light blue (0.1) → deep blue (0.5+)
  if (ndwi < 0.0) {
    var t = Math.max(0, (ndwi + 0.5) / 0.5);
    return [1.0 - 0.0 * t, 1.0 - 0.0 * t, 1.0];
  } else if (ndwi <= 0.1) {
    var t = ndwi / 0.1;
    return [1.0 - 0.6 * t, 1.0 - 0.4 * t, 1.0];
  } else if (ndwi <= 0.5) {
    var t = (ndwi - 0.1) / 0.4;
    return [0.4 - 0.4 * t, 0.6 - 0.4 * t, 1.0];
  } else {
    return [0.0, 0.2, 1.0];
  }
}`,
};

export default EVALSCRIPTS;
