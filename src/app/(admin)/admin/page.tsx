import { redirect } from "next/navigation";
import { requerirSesion } from "@/lib/auth/server-helpers";
import { sql } from "@/lib/db/client";
import type { UsuarioRow } from "@/lib/db/types";
import {
  contarRecomendacionesHoy,
  contarErroresUltimas24h,
  agruparFeedbackUltimas24h,
  errorReconciliacionUltimaImagen,
  estadoQuotas,
} from "@/lib/cron/observabilidad";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const sesion = await requerirSesion();

  const rows = await sql<UsuarioRow[]>`
    SELECT rol FROM usuarios WHERE id = ${sesion.usuarioId}
  `;
  if (!rows[0] || rows[0].rol !== "admin") {
    redirect("/");
  }

  const [recomendaciones, errores, feedback, reconciliacion, quotas] =
    await Promise.all([
      contarRecomendacionesHoy(),
      contarErroresUltimas24h(),
      agruparFeedbackUltimas24h(),
      errorReconciliacionUltimaImagen(),
      estadoQuotas(),
    ]);

  const totalFeedback =
    feedback.razonable + feedback.mas_o_menos + feedback.no_acerto;

  function barWidth(n: number): string {
    if (totalFeedback === 0) return "0%";
    return `${Math.round((n / totalFeedback) * 100)}%`;
  }

  const recomColor =
    recomendaciones.generadas === recomendaciones.esperadas
      ? "bg-green-100 border-green-400"
      : "bg-red-100 border-red-400";

  const erroresColor =
    errores === 0
      ? "bg-green-100 border-green-400"
      : errores <= 3
        ? "bg-yellow-100 border-yellow-400"
        : "bg-red-100 border-red-400";

  const sentinelMax = 30;
  const sentinelPct = Math.min(
    100,
    Math.round((quotas.sentinelRequestsHoy / sentinelMax) * 100),
  );

  const predioIds = Object.keys(reconciliacion);

  return (
    <>
      <meta httpEquiv="refresh" content="60" />
      <h1 className="text-2xl font-bold mb-6 text-gray-800">
        Dashboard de operaciones
      </h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">

        {/* Tarjeta 1: Reportes de hoy */}
        <div
          data-testid="card-reportes"
          className={`rounded-lg border p-4 ${recomColor}`}
        >
          <h2 className="font-semibold text-gray-700 mb-1">Reportes de hoy</h2>
          <p className="text-3xl font-bold">
            {recomendaciones.generadas}{" "}
            <span className="text-base font-normal text-gray-500">
              / {recomendaciones.esperadas} esperados
            </span>
          </p>
        </div>

        {/* Tarjeta 2: Errores últimas 24 h */}
        <div
          data-testid="card-errores"
          className={`rounded-lg border p-4 ${erroresColor}`}
        >
          <h2 className="font-semibold text-gray-700 mb-1">
            Errores últimas 24 h
          </h2>
          <p className="text-3xl font-bold">{errores}</p>
        </div>

        {/* Tarjeta 3: Feedback últimas 24 h */}
        <div
          data-testid="card-feedback"
          className="rounded-lg border p-4 bg-white border-gray-200"
        >
          <h2 className="font-semibold text-gray-700 mb-3">
            Feedback últimas 24 h
          </h2>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-gray-600">Razonable</span>
              <div className="mt-1 h-4 bg-gray-100 rounded overflow-hidden">
                <div
                  className="h-full bg-green-500"
                  style={{ width: barWidth(feedback.razonable) }}
                />
              </div>
              <span className="text-xs text-gray-500">{feedback.razonable}</span>
            </div>
            <div>
              <span className="text-gray-600">Más o menos</span>
              <div className="mt-1 h-4 bg-gray-100 rounded overflow-hidden">
                <div
                  className="h-full bg-yellow-400"
                  style={{ width: barWidth(feedback.mas_o_menos) }}
                />
              </div>
              <span className="text-xs text-gray-500">{feedback.mas_o_menos}</span>
            </div>
            <div>
              <span className="text-gray-600">No acertó</span>
              <div className="mt-1 h-4 bg-gray-100 rounded overflow-hidden">
                <div
                  className="h-full bg-red-400"
                  style={{ width: barWidth(feedback.no_acerto) }}
                />
              </div>
              <span className="text-xs text-gray-500">{feedback.no_acerto}</span>
            </div>
          </div>
        </div>

        {/* Tarjeta 4: Error de reconciliación */}
        <div
          data-testid="card-reconciliacion"
          className="rounded-lg border p-4 bg-white border-gray-200 sm:col-span-2 xl:col-span-1"
        >
          <h2 className="font-semibold text-gray-700 mb-3">
            Error de reconciliación última imagen
          </h2>
          {predioIds.length === 0 ? (
            <p className="text-sm text-gray-400">Sin datos</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-1">Predio</th>
                  <th className="pb-1 text-right">Error %</th>
                </tr>
              </thead>
              <tbody>
                {predioIds.map((predioId) => (
                  <tr key={predioId} className="border-b last:border-0">
                    <td className="py-1 font-mono text-xs">{predioId}</td>
                    <td className="py-1 text-right">
                      {(reconciliacion[predioId] * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Tarjeta 5: Quotas externas */}
        <div
          data-testid="card-quotas"
          className="rounded-lg border p-4 bg-white border-gray-200"
        >
          <h2 className="font-semibold text-gray-700 mb-3">Quotas externas</h2>
          <div className="space-y-3 text-sm">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-gray-600">Sentinel Hub hoy</span>
                <span className="text-gray-800 font-medium">
                  {quotas.sentinelRequestsHoy} / {sentinelMax}
                </span>
              </div>
              <div className="h-3 bg-gray-100 rounded overflow-hidden">
                <div
                  className={`h-full ${sentinelPct >= 90 ? "bg-red-500" : sentinelPct >= 70 ? "bg-yellow-400" : "bg-blue-500"}`}
                  style={{ width: `${sentinelPct}%` }}
                />
              </div>
            </div>
            <div>
              <span className="text-gray-600">Keepalive último ping: </span>
              <span className="font-mono text-xs text-gray-800">
                {quotas.keepaliveUltimo ?? "—"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
