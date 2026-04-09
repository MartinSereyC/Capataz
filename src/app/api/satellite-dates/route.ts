/**
 * GET /api/satellite-dates
 * Query params: bbox=minLng,minLat,maxLng,maxLat&from=YYYY-MM-DD&to=YYYY-MM-DD
 * Returns available Sentinel-2 acquisition dates with cloud coverage.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAvailableDates } from "@/lib/sentinel/dates";
import type { BboxGeoJSON } from "@/types";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const bboxParam = searchParams.get("bbox");
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  if (!bboxParam || !fromParam || !toParam) {
    return NextResponse.json(
      { error: "Missing required query params: bbox, from, to" },
      { status: 400 },
    );
  }

  const parts = bboxParam.split(",").map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) {
    return NextResponse.json(
      { error: "bbox must be four comma-separated numbers: minLng,minLat,maxLng,maxLat" },
      { status: 400 },
    );
  }

  const bbox = parts as BboxGeoJSON;

  try {
    const result = await getAvailableDates(bbox, fromParam, toParam);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
