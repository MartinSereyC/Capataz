import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock next/navigation (redirect is called by requerirSesion when no session)
// ---------------------------------------------------------------------------
vi.mock("next/navigation", () => ({ redirect: vi.fn(() => { throw new Error("redirect"); }) }));

// ---------------------------------------------------------------------------
// Mock next/headers (used by obtenerSesionActual)
// ---------------------------------------------------------------------------
vi.mock("next/headers", () => ({
  cookies: vi.fn(() =>
    Promise.resolve({ get: () => undefined })
  ),
}));

// ---------------------------------------------------------------------------
// Mock leerSesion — controls whether a session exists
// ---------------------------------------------------------------------------
const { mockLeerSesion } = vi.hoisted(() => {
  let _sesion: { jti: string; usuarioId: string; expiraEn: number } | null = null;
  return {
    mockLeerSesion: {
      set(v: typeof _sesion) { _sesion = v; },
      get() { return Promise.resolve(_sesion); },
    },
  };
});

vi.mock("@/lib/auth/session", () => ({
  leerSesion: () => mockLeerSesion.get(),
}));

// ---------------------------------------------------------------------------
// Mock sql — captures sql.begin calls
// ---------------------------------------------------------------------------
const { mockSqlBegin } = vi.hoisted(() => {
  let _shouldThrow = false;
  const mockSqlBegin = {
    shouldThrow(v: boolean) { _shouldThrow = v; },
    fn: async (cb: (tx: unknown) => Promise<void>) => {
      if (_shouldThrow) throw new Error("DB error");
      // Minimal tx mock that returns a single row with id
      const tx = Object.assign(
        (_strings: TemplateStringsArray, ..._values: unknown[]) =>
          Promise.resolve([{ id: "generated-id" }]),
        {}
      );
      await cb(tx);
    },
  };
  return { mockSqlBegin };
});

vi.mock("@/lib/db/client", () => ({
  sql: Object.assign(
    (_strings: TemplateStringsArray, ..._values: unknown[]) =>
      Promise.resolve([]),
    { begin: mockSqlBegin.fn }
  ),
}));

// ---------------------------------------------------------------------------
// Import the action under test AFTER all mocks
// ---------------------------------------------------------------------------
import { guardarPredioCompleto } from "@/app/(app)/predios/nuevo/actions";

const basePayload = {
  nombre: "Fundo Test",
  region: "Coquimbo",
  comuna: "La Serena",
  geometriaPredio: {
    type: "Polygon" as const,
    coordinates: [
      [
        [-70.7, -33.5],
        [-70.6, -33.5],
        [-70.6, -33.4],
        [-70.7, -33.4],
        [-70.7, -33.5],
      ],
    ],
  },
  zonas: [
    {
      nombre: "Zona A",
      geometria: {
        type: "Polygon" as const,
        coordinates: [
          [
            [-70.69, -33.49],
            [-70.65, -33.49],
            [-70.65, -33.45],
            [-70.69, -33.45],
            [-70.69, -33.49],
          ],
        ],
      },
      cultivo: "palto_hass" as const,
      prioridad: "alta" as const,
    },
    {
      nombre: "Zona B",
      geometria: {
        type: "Polygon" as const,
        coordinates: [
          [
            [-70.64, -33.49],
            [-70.61, -33.49],
            [-70.61, -33.45],
            [-70.64, -33.45],
            [-70.64, -33.49],
          ],
        ],
      },
      cultivo: "citricos" as const,
      prioridad: "media" as const,
    },
  ],
  fuentes: [
    {
      tipo: "pozo" as const,
      caudal_estimado_lh: 500,
      capacidad_estimada_l: null,
      notas: "Pozo principal",
      zonaIndices: [0, 1],
    },
  ],
};

beforeEach(() => {
  mockLeerSesion.set({ jti: "tok-1", usuarioId: "user-1", expiraEn: Date.now() + 3600_000 });
  mockSqlBegin.shouldThrow(false);
});

describe("guardarPredioCompleto — happy path", () => {
  it("returns ok:true with a predioId when predio + 2 zonas + 1 fuente", async () => {
    const result = await guardarPredioCompleto(basePayload);
    expect(result.ok).toBe(true);
    expect(typeof result.predioId).toBe("string");
  });
});

describe("guardarPredioCompleto — validation rejection", () => {
  it("returns ok:false when zonas array is empty", async () => {
    const result = await guardarPredioCompleto({ ...basePayload, zonas: [] });
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("returns ok:false when nombre is empty", async () => {
    const result = await guardarPredioCompleto({ ...basePayload, nombre: "" });
    expect(result.ok).toBe(false);
  });
});

describe("guardarPredioCompleto — ownership / auth", () => {
  it("returns ok:false when session is null", async () => {
    mockLeerSesion.set(null);
    const result = await guardarPredioCompleto(basePayload);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/autenticado/i);
  });
});
