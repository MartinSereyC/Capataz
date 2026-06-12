import { NextRequest, NextResponse } from "next/server";
import { getZoneStats } from "@/lib/sentinel/zone-stats";
import type { GeoJSONPolygon } from "@/types";

export async function POST(req: NextRequest) {
  let polygon: GeoJSONPolygon;
  let date: string;

  try {
    ({ polygon, date } = await req.json() as { polygon: GeoJSONPolygon; date: string });
    if (!polygon || !date) throw new Error("missing fields");
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const stats = await getZoneStats(polygon, date);
    return NextResponse.json(stats);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[zone-stats] Unexpected error:", msg);
    return NextResponse.json({ ndvi: null, ndmi: null });
  }
}
