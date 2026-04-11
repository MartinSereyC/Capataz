import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock auth
vi.mock("@/lib/auth/server-helpers", () => ({
  obtenerSesionActual: vi.fn().mockResolvedValue({ usuarioId: "user-1" }),
}));

// Mock repo
vi.mock("@/lib/recomendaciones/repo", () => ({
  listarRecomendacionesDelDia: vi.fn(),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

import { listarRecomendacionesDelDia } from "@/lib/recomendaciones/repo";
import HoyPage from "@/app/(app)/hoy/page";

const makeRec = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: "rec-1",
  zona_id: "zona-1",
  fecha: "2026-04-10",
  semaforo: "verde" as const,
  timing_etiqueta: "regar en 3-4 días",
  confianza: "media" as const,
  razon_breve: "sin déficit relevante",
  postergada_por_escasez: false,
  creado_en: new Date("2026-04-10T05:30:00Z"),
  zonaNombre: "Zona A",
  predioNombre: "Fundo Norte",
  predioId: "predio-1",
  cultivo: "vid",
  prioridad: "media" as const,
  ...overrides,
});

const mockData = [
  // Predio 1 — 3 zonas
  makeRec({ id: "rec-1", semaforo: "verde", zonaNombre: "Zona A", predioId: "predio-1", predioNombre: "Fundo Norte" }),
  makeRec({ id: "rec-2", semaforo: "rojo", zonaNombre: "Zona B", predioId: "predio-1", predioNombre: "Fundo Norte" }),
  makeRec({ id: "rec-3", semaforo: "amarillo", zonaNombre: "Zona C", predioId: "predio-1", predioNombre: "Fundo Norte" }),
  // Predio 2 — 3 zonas
  makeRec({ id: "rec-4", semaforo: "verde", zonaNombre: "Zona D", predioId: "predio-2", predioNombre: "Fundo Sur" }),
  makeRec({ id: "rec-5", semaforo: "rojo", zonaNombre: "Zona E", predioId: "predio-2", predioNombre: "Fundo Sur" }),
  makeRec({ id: "rec-6", semaforo: "amarillo", zonaNombre: "Zona F", predioId: "predio-2", predioNombre: "Fundo Sur" }),
];

describe("HoyPage", () => {
  it("renders both predios with their zones", async () => {
    vi.mocked(listarRecomendacionesDelDia).mockResolvedValue(mockData as never);
    const element = await HoyPage();
    render(element);

    expect(screen.getByText("Fundo Norte")).toBeInTheDocument();
    expect(screen.getByText("Fundo Sur")).toBeInTheDocument();
    expect(screen.getByText("Zona A")).toBeInTheDocument();
    expect(screen.getByText("Zona F")).toBeInTheDocument();
  });

  it("shows rojo items before verde items in rendered order", async () => {
    vi.mocked(listarRecomendacionesDelDia).mockResolvedValue(mockData as never);
    const element = await HoyPage();
    const { container } = render(element);

    // Find all zone name elements in DOM order
    const zoneEls = Array.from(
      container.querySelectorAll("p.text-sm.font-medium.text-gray-900")
    );
    const zonaNames = zoneEls.map((el) => el.textContent ?? "");

    // Zona B (rojo) should appear before Zona A (verde) within Fundo Norte group
    const idxB = zonaNames.findIndex((t) => t.includes("Zona B"));
    const idxA = zonaNames.findIndex((t) => t.includes("Zona A"));
    expect(idxB).toBeGreaterThanOrEqual(0);
    expect(idxA).toBeGreaterThanOrEqual(0);
    expect(idxB).toBeLessThan(idxA);
  });

  it("shows Spanish date in header", async () => {
    vi.mocked(listarRecomendacionesDelDia).mockResolvedValue(mockData as never);
    const element = await HoyPage();
    render(element);
    // Date should appear — check for "de" which appears in Spanish dates
    const header = screen.getByRole("heading", { level: 1 });
    expect(header.textContent).toMatch(/de/);
  });

  it("does not render litros, mm, or volumen text anywhere", async () => {
    vi.mocked(listarRecomendacionesDelDia).mockResolvedValue(mockData as never);
    const element = await HoyPage();
    const { container } = render(element);
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/litros/i);
    expect(text).not.toMatch(/\bmm\b/i);
    expect(text).not.toMatch(/volumen/i);
  });
});
