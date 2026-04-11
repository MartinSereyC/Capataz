import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock auth
vi.mock("@/lib/auth/server-helpers", () => ({
  obtenerSesionActual: vi.fn(),
}));

// Mock feedback repo
vi.mock("@/lib/feedback/repo", () => ({
  guardarFeedback: vi.fn(),
}));

// Mock alertas
vi.mock("@/lib/feedback/alertas", () => ({
  emitirAlertaSiCorresponde: vi.fn(),
}));

// Mock db client for predioId lookup in route
const { mockSql, setMockSqlResult } = vi.hoisted(() => {
  let _result: unknown[] = [];
  const mockSql = Object.assign(
    (_strings: TemplateStringsArray, ..._values: unknown[]) =>
      Promise.resolve(_result),
    {}
  );
  function setMockSqlResult(rows: unknown[]) {
    _result = rows;
  }
  return { mockSql, setMockSqlResult };
});

vi.mock("@/lib/db/client", () => ({ sql: mockSql }));

import { obtenerSesionActual } from "@/lib/auth/server-helpers";
import { guardarFeedback } from "@/lib/feedback/repo";
import { emitirAlertaSiCorresponde } from "@/lib/feedback/alertas";
import { NextRequest } from "next/server";

const mockAuth = obtenerSesionActual as ReturnType<typeof vi.fn>;
const mockGuardar = guardarFeedback as ReturnType<typeof vi.fn>;
const mockEmitir = emitirAlertaSiCorresponde as ReturnType<typeof vi.fn>;

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/feedback", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setMockSqlResult([{ predio_id: "predio-1" }]);
  mockEmitir.mockResolvedValue(undefined);
});

describe("POST /api/feedback", () => {
  it("retorna 401 cuando no hay sesión", async () => {
    mockAuth.mockResolvedValue(null);
    const { POST } = await import("@/app/api/feedback/route");
    const res = await POST(makeRequest({ recomendacionId: "00000000-0000-0000-0000-000000000001", valoracion: "razonable" }));
    expect(res.status).toBe(401);
  });

  it("retorna 400 cuando el body es inválido", async () => {
    mockAuth.mockResolvedValue({ usuarioId: "user-1" });
    const { POST } = await import("@/app/api/feedback/route");
    const res = await POST(makeRequest({ recomendacionId: "not-a-uuid", valoracion: "invalida" }));
    expect(res.status).toBe(400);
  });

  it("retorna 200 con ok y id en happy path", async () => {
    mockAuth.mockResolvedValue({ usuarioId: "user-happy" });
    mockGuardar.mockResolvedValue({ id: "fb-ok", recomendacion_id: "00000000-0000-0000-0000-000000000001", valoracion: "razonable", observacion_libre: null, creado_en: new Date() });
    const { POST } = await import("@/app/api/feedback/route");
    const res = await POST(makeRequest({ recomendacionId: "00000000-0000-0000-0000-000000000001", valoracion: "razonable" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.id).toBe("fb-ok");
  });

  it("retorna 429 cuando se supera el límite de 20 llamadas diarias", async () => {
    mockAuth.mockResolvedValue({ usuarioId: "user-ratelimit" });
    mockGuardar.mockResolvedValue({ id: "fb-x", recomendacion_id: "00000000-0000-0000-0000-000000000001", valoracion: "razonable", observacion_libre: null, creado_en: new Date() });

    // Re-import to get a fresh module with its own rate limit state
    vi.resetModules();

    // Re-mock everything after resetModules
    vi.mock("@/lib/auth/server-helpers", () => ({
      obtenerSesionActual: vi.fn().mockResolvedValue({ usuarioId: "user-ratelimit" }),
    }));
    vi.mock("@/lib/feedback/repo", () => ({
      guardarFeedback: vi.fn().mockResolvedValue({ id: "fb-x", recomendacion_id: "00000000-0000-0000-0000-000000000001", valoracion: "razonable", observacion_libre: null, creado_en: new Date() }),
    }));
    vi.mock("@/lib/feedback/alertas", () => ({
      emitirAlertaSiCorresponde: vi.fn().mockResolvedValue(undefined),
    }));
    vi.mock("@/lib/db/client", () => ({ sql: mockSql }));

    const { POST: POST2 } = await import("@/app/api/feedback/route");

    const validBody = { recomendacionId: "00000000-0000-0000-0000-000000000001", valoracion: "razonable" };
    // Make 20 successful calls
    for (let i = 0; i < 20; i++) {
      const res = await POST2(makeRequest(validBody));
      expect(res.status).toBe(200);
    }
    // 21st call should be rate limited
    const res21 = await POST2(makeRequest(validBody));
    expect(res21.status).toBe(429);
  });
});
