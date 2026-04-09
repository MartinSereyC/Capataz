/**
 * GET /api/sentinel-token
 * Returns a valid Sentinel Hub access token.
 * In mock mode: returns a dummy token.
 * In live mode: returns a cached or freshly-fetched OAuth2 token.
 */

import { NextResponse } from "next/server";
import { getSentinelToken } from "@/lib/sentinel/auth";

export async function GET() {
  try {
    const result = await getSentinelToken();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
