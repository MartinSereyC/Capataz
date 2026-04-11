import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the db client
vi.mock("@/lib/db/client", () => ({
  sql: vi.fn(),
}));

import { sql } from "@/lib/db/client";
import { generarMagicLink } from "@/lib/auth/magic-link";

const mockSql = sql as unknown as ReturnType<typeof vi.fn>;

const fakeUsuario = {
  id: "uuid-001",
  email: "test@ejemplo.cl",
  login_method: "magic_link",
  idioma: "es",
  rol: "agricultor",
  creado_en: new Date(),
  actualizado_en: new Date(),
};

beforeEach(() => {
  process.env.AUTH_SECRET = "test-secret-para-pruebas-unitarias-seguro";
  delete process.env.RESEND_API_KEY;
  vi.clearAllMocks();
});

afterEach(() => {
  delete process.env.RESEND_API_KEY;
});

describe("generarMagicLink", () => {
  it("creates new user and returns stub link when no RESEND_API_KEY", async () => {
    // INSERT returns the new user
    mockSql.mockResolvedValueOnce([fakeUsuario]);

    const resultado = await generarMagicLink("nuevo@ejemplo.cl", "http://localhost:3000");

    expect(resultado.canal).toBe("stub");
    expect(resultado.enviado).toBe(false);
    expect(resultado.url).toContain("/api/auth/callback?token=");
  });

  it("reuses existing user when INSERT returns empty (conflict)", async () => {
    // INSERT returns nothing (conflict), then SELECT returns existing
    mockSql
      .mockResolvedValueOnce([]) // INSERT ... ON CONFLICT DO NOTHING → no rows
      .mockResolvedValueOnce([fakeUsuario]); // SELECT fallback

    const resultado = await generarMagicLink("existente@ejemplo.cl", "http://localhost:3000");

    expect(resultado.canal).toBe("stub");
    expect(resultado.url).toContain("token=");
    expect(mockSql).toHaveBeenCalledTimes(2);
  });

  it("returns canal=stub when RESEND_API_KEY is empty string", async () => {
    process.env.RESEND_API_KEY = "";
    mockSql.mockResolvedValueOnce([fakeUsuario]);

    const resultado = await generarMagicLink("test@ejemplo.cl", "http://localhost:3000");
    expect(resultado.canal).toBe("stub");
  });

  it("calls Resend API and returns canal=email when key is present", async () => {
    process.env.RESEND_API_KEY = "re_fake_key_123";
    mockSql.mockResolvedValueOnce([fakeUsuario]);

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "email-id" }) });
    vi.stubGlobal("fetch", fetchMock);

    const resultado = await generarMagicLink("test@ejemplo.cl", "http://localhost:3000");

    expect(resultado.canal).toBe("email");
    expect(resultado.enviado).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({ method: "POST" })
    );

    vi.unstubAllGlobals();
  });
});
