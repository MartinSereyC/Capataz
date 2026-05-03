// Sentinel-1 GRD SAR evalscript.
// Requests VV and VH bands in LINEAR_POWER units, encodes to UINT8.
// VV range for agricultural soils: roughly -30..0 dB → mapped to 0..255.
// Decode: vv_dB = (pixel / 255) * 30 - 30

export const SAR_EVALSCRIPT = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["VV", "VH"], units: "LINEAR_POWER" }],
    output: { bands: 2, sampleType: "UINT8" }
  };
}
function evaluatePixel(s) {
  var vvDb = 10 * Math.log10(Math.max(s.VV, 1e-9));
  var vhDb = 10 * Math.log10(Math.max(s.VH, 1e-9));
  // Map -30..0 dB to 0..255
  var vvNorm = Math.round(Math.max(0, Math.min(255, (vvDb + 30) / 30 * 255)));
  var vhNorm = Math.round(Math.max(0, Math.min(255, (vhDb + 30) / 30 * 255)));
  return [vvNorm, vhNorm];
}`;

// Convert UINT8 pixel value back to dB
export function pixelToDb(pixel: number): number {
  return (pixel / 255) * 30 - 30;
}
