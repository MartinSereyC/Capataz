import { getSentinelToken } from '@/lib/sentinel/auth';
import { isMockMode } from '@/lib/sentinel/mock';
import { SAR_EVALSCRIPT, pixelToDb } from './evalscript';
import type { GeoJSONPolygon } from '@/types';
import { inflateSync } from 'zlib';

const PROCESS_URL = 'https://sh.dataspace.copernicus.eu/api/v1/process';
const SAR_COLLECTION = 'sentinel-1-grd';
const IMG_SIZE = 32;

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

// Decodes a 2-band UINT8 PNG and returns mean values per band across all pixels.
function decodePngMean2Band(buf: Buffer): { band1: number; band2: number } | null {
  if (buf.length < 33 || buf.readUInt32BE(0) !== 0x89504e47) return null;

  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const colorType = buf[25]; // 2=RGB, 6=RGBA
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 4;

  const idatList: Buffer[] = [];
  let off = 8;
  while (off + 12 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    if (type === 'IDAT') idatList.push(buf.subarray(off + 8, off + 8 + len));
    if (type === 'IEND') break;
    off += 12 + len;
  }
  if (idatList.length === 0) return null;

  const raw = inflateSync(Buffer.concat(idatList));
  const stride = width * channels;
  const pixels = new Uint8Array(width * height * channels);

  for (let row = 0; row < height; row++) {
    const srcOff = row * (stride + 1);
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

  let sumB1 = 0, sumB2 = 0, count = 0;
  for (let i = 0; i < width * height; i++) {
    sumB1 += pixels[i * channels];
    sumB2 += pixels[i * channels + 1];
    count++;
  }
  return count > 0 ? { band1: sumB1 / count, band2: sumB2 / count } : null;
}

function mockSarForPolygon(polygon: GeoJSONPolygon): { vv: number; vh: number } {
  const coords = polygon.coordinates[0];
  if (!coords || coords.length === 0) return { vv: -15, vh: -22 };
  const [lng, lat] = coords[0];
  // Deterministic value in range -25..-10 dB
  const vv = -25 + Math.abs(Math.sin(lng * 91.3 + lat * 257.8)) * 15;
  const vh = vv - 7; // VH is typically ~7 dB lower than VV
  return { vv: parseFloat(vv.toFixed(1)), vh: parseFloat(vh.toFixed(1)) };
}

export interface SarStats {
  vv: number; // dB
  vh: number; // dB
}

// Fetches average VV and VH backscatter (in dB) for a zone polygon on a given date.
export async function getSarStats(
  polygon: GeoJSONPolygon,
  date: string,
): Promise<SarStats> {
  if (isMockMode()) {
    return mockSarForPolygon(polygon);
  }

  const { token } = await getSentinelToken();
  const [minLng, minLat, maxLng, maxLat] = bboxFromPolygon(polygon);

  const body = {
    input: {
      bounds: {
        bbox: [minLng, minLat, maxLng, maxLat],
        geometry: polygon,
        properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/4326' },
      },
      data: [{
        type: SAR_COLLECTION,
        dataFilter: {
          timeRange: {
            from: `${date}T00:00:00Z`,
            to: `${date}T23:59:59Z`,
          },
        },
      }],
    },
    output: {
      width: IMG_SIZE,
      height: IMG_SIZE,
      responses: [{ identifier: 'default', format: { type: 'image/png' } }],
    },
    evalscript: SAR_EVALSCRIPT,
  };

  const res = await fetch(PROCESS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'image/png',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`SAR Process API error ${res.status}: ${errText}`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  const avg = decodePngMean2Band(buf);

  if (!avg) throw new Error('SAR PNG decode failed or no pixels in response');

  return {
    vv: parseFloat(pixelToDb(avg.band1).toFixed(1)),
    vh: parseFloat(pixelToDb(avg.band2).toFixed(1)),
  };
}
