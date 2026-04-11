import { redirect } from "next/navigation";
import Link from "next/link";
import { obtenerSesionActual } from "@/lib/auth/server-helpers";
import {
  listarRecomendacionesDelDia,
  type RecomendacionConZona,
} from "@/lib/recomendaciones/repo";
import { SemaforoDot } from "./semaforo";

function formatearFecha(fecha: Date): string {
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(fecha);
}

function formatearHora(fecha: Date): string {
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago",
    hour: "2-digit",
    minute: "2-digit",
  }).format(fecha);
}

const semaforoOrden: Record<string, number> = { rojo: 1, amarillo: 2, verde: 3 };

function agruparPorPredio(
  recs: RecomendacionConZona[]
): Map<string, { nombre: string; items: RecomendacionConZona[] }> {
  const mapa = new Map<string, { nombre: string; items: RecomendacionConZona[] }>();
  for (const r of recs) {
    if (!mapa.has(r.predioId)) {
      mapa.set(r.predioId, { nombre: r.predioNombre, items: [] });
    }
    mapa.get(r.predioId)!.items.push(r);
  }
  for (const grupo of mapa.values()) {
    grupo.items.sort(
      (a, b) => (semaforoOrden[a.semaforo] ?? 4) - (semaforoOrden[b.semaforo] ?? 4)
    );
  }
  return mapa;
}

const etiquetaPrioridad: Record<string, string> = {
  alta: "alta",
  media: "media",
  baja: "baja",
};

export default async function HoyPage() {
  const sesion = await obtenerSesionActual();
  if (!sesion) {
    redirect("/login");
  }

  const ahora = new Date();
  const recomendaciones = await listarRecomendacionesDelDia(sesion.usuarioId);
  const porPredio = agruparPorPredio(recomendaciones);

  const ultimaActualizacion =
    recomendaciones.length > 0
      ? formatearHora(
          recomendaciones.reduce((max, r) =>
            r.creado_en > max.creado_en ? r : max
          ).creado_en
        )
      : null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-gray-900">
          {formatearFecha(ahora)}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Plan de riego del día</p>
      </header>

      {recomendaciones.length === 0 ? (
        <div className="rounded-xl bg-white border border-gray-200 p-6 text-center">
          <p className="text-gray-600 text-sm">
            Aún no hay recomendaciones para hoy. El reporte se genera a las 5:30 AM.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(porPredio.values()).map((predio) => (
            <section key={predio.nombre}>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                {predio.nombre}
              </h2>
              <div className="rounded-xl bg-white border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                {predio.items.map((rec) => (
                  <Link
                    key={rec.id}
                    href={`/hoy/${rec.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <SemaforoDot valor={rec.semaforo} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {rec.zonaNombre}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {rec.cultivo} · prioridad {etiquetaPrioridad[rec.prioridad]}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-gray-700 font-medium">
                        {rec.timing_etiqueta}
                      </p>
                      {rec.postergada_por_escasez && (
                        <p className="text-xs text-amber-600 mt-0.5">
                          regar cuando alcance fuente
                        </p>
                      )}
                    </div>
                    <span className="text-gray-300 text-sm">›</span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {ultimaActualizacion && (
        <p className="text-xs text-gray-400 text-center">
          Última actualización: {ultimaActualizacion}
        </p>
      )}
    </div>
  );
}
