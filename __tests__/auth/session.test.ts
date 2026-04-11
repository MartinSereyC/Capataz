import { describe, it, expect, beforeAll } from "vitest";
import { iniciarSesion, leerSesion } from "@/lib/auth/session";

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-para-pruebas-unitarias-seguro";
});

describe("session", () => {
  it("start/read round-trip returns correct usuarioId", async () => {
    const cookieValue = await iniciarSesion("usuario-999");
    const sesion = await leerSesion(cookieValue);
    expect(sesion).not.toBeNull();
    expect(sesion?.usuarioId).toBe("usuario-999");
  });

  it("leerSesion returns null for undefined", async () => {
    expect(await leerSesion(undefined)).toBeNull();
  });
});
