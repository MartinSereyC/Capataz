"use client";

import { useState } from "react";
import { encolarFeedback } from "@/lib/pwa/feedback-queue";
import type { Valoracion } from "@/lib/db/types";

interface FeedbackFormProps {
  recomendacionId: string;
}

const opciones: { valor: Valoracion; etiqueta: string }[] = [
  { valor: "razonable", etiqueta: "Razonable" },
  { valor: "mas_o_menos", etiqueta: "Más o menos" },
  { valor: "no_acerto", etiqueta: "No acertó" },
];

export function FeedbackForm({ recomendacionId }: FeedbackFormProps) {
  const [seleccionado, setSeleccionado] = useState<Valoracion | null>(null);
  const [observacion, setObservacion] = useState("");
  const [estado, setEstado] = useState<"idle" | "enviando" | "ok" | "offline">("idle");

  async function enviar(valoracion: Valoracion) {
    setSeleccionado(valoracion);
    setEstado("enviando");

    const body = {
      recomendacionId,
      valoracion,
      observacion: observacion.trim() || null,
    };

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setEstado("ok");
        return;
      }

      // 404 or any non-ok response: fall back to queue
      await encolarFeedback({
        url: "/api/feedback",
        body,
        timestamp: Date.now(),
      });
      setEstado("offline");
    } catch {
      // network error: fall back to queue
      try {
        await encolarFeedback({
          url: "/api/feedback",
          body,
          timestamp: Date.now(),
        });
      } catch {
        // ignore queue errors
      }
      setEstado("offline");
    }
  }

  if (estado === "ok") {
    return (
      <p className="text-sm text-green-700 font-medium">
        Gracias, registrado.
      </p>
    );
  }

  if (estado === "offline") {
    return (
      <p className="text-sm text-amber-700">
        Guardado sin conexión, se enviará al reconectar.
      </p>
    );
  }

  const enviando = estado === "enviando";

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-gray-700">¿Qué tan acertada fue esta recomendación?</p>
      <div className="flex gap-2 flex-wrap">
        {opciones.map(({ valor, etiqueta }) => (
          <button
            key={valor}
            onClick={() => enviar(valor)}
            disabled={enviando}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors
              ${seleccionado === valor
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
              }
              disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {etiqueta}
          </button>
        ))}
      </div>
      <textarea
        value={observacion}
        onChange={(e) => setObservacion(e.target.value)}
        placeholder="Observación libre (opcional)"
        rows={2}
        disabled={enviando}
        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
      />
    </div>
  );
}
