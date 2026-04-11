import { describe, it, expect, vi, beforeAll } from "vitest";

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-para-pruebas-unitarias-seguro";
});

// Mock next/headers
vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

import { cookies } from "next/headers";
import { obtenerSesionActual, requerirSesion } from "@/lib/auth/server-helpers";
import { iniciarSesion } from "@/lib/auth/session";

describe("obtenerSesionActual", () => {
  it("returns null when cookie is absent", async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: () => undefined,
    } as never);

    const result = await obtenerSesionActual();
    expect(result).toBeNull();
  });

  it("returns decoded token when valid cookie present", async () => {
    const cookieValue = await iniciarSesion("usuario-42");

    vi.mocked(cookies).mockResolvedValue({
      get: () => ({ name: "capataz_sesion", value: cookieValue }),
    } as never);

    const result = await obtenerSesionActual();
    expect(result).not.toBeNull();
    expect(result?.usuarioId).toBe("usuario-42");
  });
});

describe("requerirSesion", () => {
  it("redirects to /login when no session", async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: () => undefined,
    } as never);

    await expect(requerirSesion()).rejects.toThrow("REDIRECT:/login");
  });

  it("returns session when valid cookie present", async () => {
    const cookieValue = await iniciarSesion("usuario-99");

    vi.mocked(cookies).mockResolvedValue({
      get: () => ({ name: "capataz_sesion", value: cookieValue }),
    } as never);

    const result = await requerirSesion();
    expect(result.usuarioId).toBe("usuario-99");
  });
});
