import { NextRequest, NextResponse } from "next/server";
import { getSentinelToken } from "@/lib/sentinel/auth";
import { isMockMode } from "@/lib/sentinel/mock";
import { inflateSync } from "zlib";
import type { GeoJSONPolygon } from "@/types";

const PROCESS_URL = "https://sh.dataspace.copernicus.eu/api/v1/process";
const IMG_SIZE = 32;

// Encode NDVI in R, NDMI in G. Alpha=0 for no-data pixels (outside polygon or cloud-masked).
const EVALSCRIPT = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B04", "B08", "B11", "dataMask"] }],
    output: { bands: 4, sampleType: "UINT8" }
  };
}
function evaluatePixel(s) {
  if (!s.dataMask) return [0, 0, 0, 0];
  var d1 = s.B08 + s.B04, d2 = s.B08 + s.B11;
  var ndvi = d1 > 0 ? (s.B08 - s.B04) / d1 : 0;
  var ndmi = d2 > 0 ? (s.B08 - s.B11) / d2 : 0;
  return [
    Math.max(0, Math.min(255, Math.round((ndvi + 1) / 2 * 255))),
    Math.max(0, Math.min(255, Math.round((ndmi + 1) / 2 * 255))),
    0,
    255,
  ];
}`;

function bboxFromPolygon(polygon: GeoJSONPolygon): [number, number, number, number] {
  const coords = polygon.coordinates[0];
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  }
  return [minLng, minLat, maxLng, maxLat];
}

// Parse a PNG buffer and return the mean R and G values across all opaque pixels.
// Handles all PNG filter types (0–4) using Node.js built-in zlib.
function decodePngMean(buf: Buffer): { r: number; g: number } | null {
  if (buf.length < 33 || buf.readUInt32BE(0) !== 0x89504e47) return null;

  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const colorType = buf[25]; // 6 = RGBA, 2 = RGB
  const channels = colorType === 6 ? 4 : 3;

  const idatList: Buffer[] = [];
  let off = 8;
  while (off + 12 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    if (type === "IDAT") idatList.push(buf.subarray(off + 8, off + 8 + len));
    if (type === "IEND") break;
    off += 12 + len;
  }
  if (idatList.length === 0) return null;

  const raw = inflateSync(Buffer.concat(idatList));
  const stride = width * channels;
  const pixels = new Uint8Array(width * height * channels);

  for (let row = 0; row < height; row++) {
    const srcOff = row * (stride + 1); // +1 for filter byte
    const dstOff = row * stride;
    const filter = raw[srcOff];
    for (let i = 0; i < stride; i++) {
      const x = raw[srcOff + 1 + i];
      const a = i >= channels ? pixels[dstOff + i - channels] : 0;
      const b = row > 0 ? pixels[dstOff - stride + i] : 0;
      const c = row > 0 && i >= channels ? pixels[dstOff - stride + i - channels] : 0;
      let v: number;
      if (filter === 0) v = x;
      else if (filter === 1) v = x + a;
      else if (filter === 2) v = x + b;
      else if (filter === 3) v = x + Math.floor((a + b) / 2);
      else {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      }
      pixels[dstOff + i] = v & 0xff;
    }
  }

  let sumR = 0, sumG = 0, count = 0;
  for (let i = 0; i < width * height; i++) {
    if (pixels[i * 4 + 3] === 255) {
      sumR += pixels[i * 4];
      sumG += pixels[i * 4 + 1];
      count++;
    }
  }
  return count > 0 ? { r: sumR / count, g: sumG / count } : null;
}

function mockNdviForPolygon(polygon: GeoJSONPolygon): number {
  const coords = polygon.coordinates[0];
  if (!coords || coords.length === 0) return 0.45;
  const [lng, lat] = coords[0];
  return 0.2 + Math.abs(Math.sin(lng * 127.1 + lat * 311.7)) * 0.6;
}

function mockNdmiForPolygon(polygon: GeoJSONPolygon): number {
  const coords = polygon.coordinates[0];
  if (!coords || coords.length === 0) return 0.15;
  const [lng, lat] = coords[0];
  return -0.1 + Math.abs(Math.sin(lng * 83.3 + lat * 197.5)) * 0.5;
}

export async function POST(req: NextRequest) {
  let polygon: GeoJSONPolygon;
  let date: string;

  try {
    ({ polygon, date } = await req.json() as { polygon: GeoJSONPolygon; date: string });
    if (!polygon || !date) throw new Error("missing fields");
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (isMockMode()) {
    return NextResponse.json({
      ndvi: parseFloat(mockNdviForPolygon(polygon).toFixed(3)),
      ndmi: parseFloat(mockNdmiForPolygon(polygon).toFixed(3)),
    });
  }

  try {
    const { token } = await getSentinelToken();
    const [minLng, minLat, maxLng, maxLat] = bboxFromPolygon(polygon);

    const body = {
      input: {
        bounds: {
          bbox: [minLng, minLat, maxLng, maxLat],
          properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/4326" },
        },
        data: [{
          type: "sentinel-2-l2a",
          dataFilter: {
            timeRange: {
              from: `${date}T00:00:00Z`,
              to: `${date}T23:59:59Z`,
            },
            maxCloudCoverage: 80,
          },
        }],
      },
      output: {
        width: IMG_SIZE,
        height: IMG_SIZE,
        responses: [{ identifier: "default", format: { type: "image/png" } }],
      },
      evalscript: EVALSCRIPT,
    };

    const res = await fetch(PROCESS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "image/png",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[zone-stats] Sentinel Process API error ${res.status}:`, errText);
      return NextResponse.json({ ndvi: null, ndmi: null });
    }

    const buf = Buffer.from(await res.arrayBuffer());
    const avg = decodePngMean(buf);

    if (!avg) {
      console.error("[zone-stats] PNG decode failed or no valid pixels in response");
      return NextResponse.json({ ndvi: null, ndmi: null });
    }

    const ndvi = parseFloat(((avg.r / 255) * 2 - 1).toFixed(3));
    const ndmi = parseFloat(((avg.g / 255) * 2 - 1).toFixed(3));

    return NextResponse.json({ ndvi, ndmi });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[zone-stats] Unexpected error:", msg);
    return NextResponse.json({ ndvi: null, ndmi: null });
  }
}
