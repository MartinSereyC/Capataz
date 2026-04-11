import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock auth
vi.mock("@/lib/auth/server-helpers", () => ({
  requerirSesion: vi.fn().mockResolvedValue({ usuarioId: "user-admin-1", jti: "t1", expiraEn: Date.now() + 9999999 }),
}));

// Mock DB to confirm rol=admin
vi.mock("@/lib/db/client", () => ({
  sql: vi.fn().mockResolvedValue([{ rol: "admin" }]),
}));

// Mock observabilidad
vi.mock("@/lib/cron/observabilidad", () => ({
  contarRecomendacionesHoy: vi.fn().mockResolvedValue({ generadas: 5, esperadas: 5 }),
  contarErroresUltimas24h: vi.fn().mockResolvedValue(0),
  agruparFeedbackUltimas24h: vi.fn().mockResolvedValue({ razonable: 3, mas_o_menos: 1, no_acerto: 0 }),
  errorReconciliacionUltimaImagen: vi.fn().mockResolvedValue({ "p-001": 0.05 }),
  estadoQuotas: vi.fn().mockResolvedValue({ sentinelRequestsHoy: 7, keepaliveUltimo: "2026-04-10T08:00:00.000Z" }),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

import AdminPage from "@/app/(admin)/admin/page";

describe("AdminPage", () => {
  it("renders the 5 metric cards with Spanish labels", async () => {
    const element = await AdminPage();
    render(element);

    expect(screen.getByTestId("card-reportes")).toBeInTheDocument();
    expect(screen.getByTestId("card-errores")).toBeInTheDocument();
    expect(screen.getByTestId("card-feedback")).toBeInTheDocument();
    expect(screen.getByTestId("card-reconciliacion")).toBeInTheDocument();
    expect(screen.getByTestId("card-quotas")).toBeInTheDocument();
  });

  it("card-reportes shows Spanish label 'Reportes de hoy'", async () => {
    const element = await AdminPage();
    render(element);
    expect(screen.getByTestId("card-reportes")).toHaveTextContent("Reportes de hoy");
  });

  it("card-errores shows Spanish label 'Errores últimas 24 h'", async () => {
    const element = await AdminPage();
    render(element);
    expect(screen.getByTestId("card-errores")).toHaveTextContent("Errores últimas 24 h");
  });

  it("card-feedback shows three Spanish bar labels", async () => {
    const element = await AdminPage();
    render(element);
    const card = screen.getByTestId("card-feedback");
    expect(card).toHaveTextContent("Razonable");
    expect(card).toHaveTextContent("Más o menos");
    expect(card).toHaveTextContent("No acertó");
  });

  it("card-reconciliacion shows predio id in table", async () => {
    const element = await AdminPage();
    render(element);
    const card = screen.getByTestId("card-reconciliacion");
    expect(card).toHaveTextContent("p-001");
  });

  it("card-quotas shows sentinel count and keepalive timestamp", async () => {
    const element = await AdminPage();
    render(element);
    const card = screen.getByTestId("card-quotas");
    expect(card).toHaveTextContent("7");
    expect(card).toHaveTextContent("2026-04-10T08:00:00.000Z");
  });
});
