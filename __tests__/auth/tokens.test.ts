import { describe, it, expect, beforeAll } from "vitest";
import { firmarToken, verificarToken } from "@/lib/auth/tokens";

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-para-pruebas-unitarias-seguro";
});

describe("tokens", () => {
  it("sign and verify round-trip", () => {
    const payload = { usuarioId: "user-123", expiraEn: Date.now() + 60_000 };
    const token = firmarToken(payload);
    const result = verificarToken(token);
    expect(result).not.toBeNull();
    expect(result?.usuarioId).toBe("user-123");
  });

  it("rejects expired token", () => {
    const token = firmarToken({ usuarioId: "user-abc", expiraEn: Date.now() - 1 });
    expect(verificarToken(token)).toBeNull();
  });

  it("rejects tampered token", () => {
    const token = firmarToken({ usuarioId: "user-xyz", expiraEn: Date.now() + 60_000 });
    const parts = token.split(".");
    // Tamper the body
    const tamperedBody = Buffer.from(JSON.stringify({ usuarioId: "hacker", expiraEn: Date.now() + 999_999 })).toString("base64url");
    const tampered = `${parts[0]}.${tamperedBody}.${parts[2]}`;
    expect(verificarToken(tampered)).toBeNull();
  });

  it("rejects token signed with wrong secret", () => {
    const originalSecret = process.env.AUTH_SECRET;
    process.env.AUTH_SECRET = "secret-correcto";
    const token = firmarToken({ usuarioId: "user-1", expiraEn: Date.now() + 60_000 });
    process.env.AUTH_SECRET = "secret-incorrecto";
    expect(verificarToken(token)).toBeNull();
    process.env.AUTH_SECRET = originalSecret;
  });

  it("returns null for malformed token", () => {
    expect(verificarToken("not.a.valid.token.at.all")).toBeNull();
    expect(verificarToken("")).toBeNull();
    expect(verificarToken("abc")).toBeNull();
  });
});
