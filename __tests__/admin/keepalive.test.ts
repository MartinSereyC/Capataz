import { describe, it, expect, vi, beforeEach } from "vitest";

const loggedLines: Array<Record<string, unknown>> = [];

vi.mock("@/lib/cron/logger", () => ({
  logEvento: vi.fn((nivel: string, evento: string, contexto: Record<string, unknown> = {}) => {
    loggedLines.push({ nivel, evento, ...contexto });
  }),
}));

import { GET } from "@/app/api/keepalive/route";

describe("GET /api/keepalive", () => {
  beforeEach(() => {
    loggedLines.length = 0;
  });

  it("returns 200 with ok:true and a ts string", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.ts).toBe("string");
  });

  it("ts is a valid ISO date string", async () => {
    const res = await GET();
    const body = await res.json();
    expect(new Date(body.ts).toISOString()).toBe(body.ts);
  });

  it("logs a keepalive_ping event", async () => {
    await GET();
    expect(loggedLines.length).toBeGreaterThanOrEqual(1);
    const ping = loggedLines.find((l) => l.evento === "keepalive_ping");
    expect(ping).toBeDefined();
    expect(ping?.nivel).toBe("info");
  });
});
