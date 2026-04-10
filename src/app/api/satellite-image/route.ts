/**
 * POST /api/satellite-image
 * Body: { bbox: [minLng, minLat, maxLng, maxLat], polygon: GeoJSONPolygon, date: "YYYY-MM-DD" }
 * Returns: PNG image binary
 *
 * Proxies requests to the Sentinel Hub Process API so OAuth credentials stay server-side.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSentinelToken } from "@/lib/sentinel/auth";
import { buildProcessApiBody, calculateDimensions } from "@/lib/sentinel/process-layer";
import { isMockMode } from "@/lib/sentinel/mock";
import type { BboxGeoJSON, GeoJSONPolygon, SatelliteLayerType } from "@/types";

// Minimal 1×1 green PNG (valid PNG binary)
const MOCK_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("bbox" in body) ||
    !("polygon" in body) ||
    !("date" in body)
  ) {
    return NextResponse.json(
      { error: "Request body must contain bbox, polygon, and date" },
      { status: 400 },
    );
  }

  const { bbox, polygon, date, layerType: rawLayerType } = body as {
    bbox: unknown;
    polygon: unknown;
    date: unknown;
    layerType?: unknown;
  };

  // Validate bbox
  if (
    !Array.isArray(bbox) ||
    bbox.length !== 4 ||
    bbox.some((v) => typeof v !== "number")
  ) {
    return NextResponse.json(
      { error: "bbox must be an array of 4 numbers: [minLng, minLat, maxLng, maxLat]" },
      { status: 400 },
    );
  }

  // Validate polygon
  if (typeof polygon !== "object" || polygon === null) {
    return NextResponse.json({ error: "polygon must be a GeoJSON Polygon object" }, { status: 400 });
  }

  // Validate date
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "date must be a string in YYYY-MM-DD format" },
      { status: 400 },
    );
  }

  const VALID_LAYERS: SatelliteLayerType[] = ["true-color", "ndvi", "ndmi", "ndwi"];
  const layerType: SatelliteLayerType = (
    typeof rawLayerType === "string" && VALID_LAYERS.includes(rawLayerType as SatelliteLayerType)
      ? rawLayerType as SatelliteLayerType
      : "true-color"
  );

  const validBbox = bbox as BboxGeoJSON;
  const validPolygon = polygon as GeoJSONPolygon;

  // Mock mode — return placeholder PNG
  if (isMockMode()) {
    return new NextResponse(MOCK_PNG, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Length": String(MOCK_PNG.length),
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  try {
    const { token } = await getSentinelToken();
    const { width, height } = calculateDimensions(validBbox);
    const requestBody = buildProcessApiBody(validBbox, validPolygon, date, width, height, layerType);

    const sentinelRes = await fetch("https://sh.dataspace.copernicus.eu/api/v1/process", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "image/png",
      },
      body: JSON.stringify(requestBody),
    });

    if (!sentinelRes.ok) {
      const errText = await sentinelRes.text().catch(() => "");
      return NextResponse.json(
        { error: `Sentinel Hub Process API error: ${sentinelRes.status} ${sentinelRes.statusText}`, detail: errText },
        { status: sentinelRes.status >= 500 ? 502 : sentinelRes.status },
      );
    }

    const imageBuffer = await sentinelRes.arrayBuffer();
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Length": String(imageBuffer.byteLength),
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
