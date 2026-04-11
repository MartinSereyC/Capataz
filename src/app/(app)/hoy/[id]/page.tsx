import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { obtenerSesionActual } from "@/lib/auth/server-helpers";
import { obtenerRecomendacion } from "@/lib/recomendaciones/repo";
import { SemaforoDot } from "../semaforo";
import { FeedbackForm } from "../feedback-form";
import type { Confianza } from "@/lib/db/types";

const descripcionConfianza: Record<Confianza, string> = {
  baja: "Baja — datos limitados, usar como referencia",
  media: "Media — estimación basada en datos parciales",
  alta: "Alta — datos completos y consistentes",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function DetalleRecomendacionPage({ params }: PageProps) {
  const { id } = await params;

  const sesion = await obtenerSesionActual();
  if (!sesion) {
    redirect("/login");
  }

  const rec = await obtenerRecomendacion(id, sesion.usuarioId);
  if (!rec) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/hoy"
          className="text-sm text-blue-600 hover:underline flex items-center gap-1"
        >
          ‹ Volver
        </Link>
      </div>

      <div className="rounded-xl bg-white border border-gray-200 p-5 space-y-4">
        <div className="flex items-center gap-3">
          <SemaforoDot valor={rec.semaforo} grande />
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{rec.zonaNombre}</h1>
            <p className="text-sm text-gray-500">{rec.predioNombre}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Cuándo regar</p>
            <p className="font-medium text-gray-900">{rec.timing_etiqueta}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Cultivo</p>
            <p className="font-medium text-gray-900">{rec.cultivo}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Prioridad</p>
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium
              ${rec.prioridad === "alta" ? "bg-red-100 text-red-700" :
                rec.prioridad === "media" ? "bg-yellow-100 text-yellow-700" :
                "bg-gray-100 text-gray-600"}`}>
              {rec.prioridad}
            </span>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">
              Confianza{" "}
              <span
                title={descripcionConfianza[rec.confianza]}
                className="cursor-help underline decoration-dotted"
              >
                (?)
              </span>
            </p>
            <p className="font-medium text-gray-900 capitalize">{rec.confianza}</p>
          </div>
        </div>

        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Razón</p>
          <p className="text-sm text-gray-700">{rec.razon_breve}</p>
        </div>

        {rec.postergada_por_escasez && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
            <p className="text-xs text-amber-700">
              Prioridad menor — regar cuando alcance la fuente hídrica.
            </p>
          </div>
        )}
      </div>

      <div className="rounded-xl bg-white border border-gray-200 p-5">
        <FeedbackForm recomendacionId={rec.id} />
      </div>
    </div>
  );
}
