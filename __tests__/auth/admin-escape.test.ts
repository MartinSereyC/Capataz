import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/client", () => ({
  sql: vi.fn(),
}));

// Also mock magic-link to avoid double sql calls in this unit test
vi.mock("@/lib/auth/magic-link", () => ({
  generarMagicLink: vi.fn().mockResolvedValue({
    url: "http://localhost:3000/api/auth/callback?token=fake",
    enviado: false,
    canal: "stub",
  }),
}));

import { sql } from "@/lib/db/client";
import { generarMagicLinkAdmin } from "@/lib/auth/admin-escape";

const mockSql = sql as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env.AUTH_SECRET = "test-secret-para-pruebas-unitarias-seguro";
  vi.clearAllMocks();
  mockSql.mockResolvedValue([]);
});

describe("generarMagicLinkAdmin", () => {
  it("marks usuario login_method as admin_manual", async () => {
    const resultado = await generarMagicLinkAdmin("admin@ejemplo.cl", "http://localhost:3000");

    // Should have called sql twice: INSERT + UPDATE
    expect(mockSql).toHaveBeenCalledTimes(2);

    // Second call should be the UPDATE setting login_method='admin_manual'
    const secondCallArgs = mockSql.mock.calls[1];
    const queryParts = secondCallArgs[0] as TemplateStringsArray;
    const fullQuery = queryParts.join("?");
    expect(fullQuery).toContain("admin_manual");

    expect(resultado.canal).toBe("stub");
    expect(resultado.url).toContain("token=");
  });
});
