import { NextResponse } from "next/server";
import { logEvento } from "@/lib/cron/logger";

export async function GET() {
  const ts = new Date().toISOString();
  logEvento("info", "keepalive_ping", { ts });
  return NextResponse.json({ ok: true, ts });
}
