"use client";

import type { Semaforo } from "@/lib/db/types";

interface SemaforoProps {
  valor: Semaforo;
  grande?: boolean;
}

const colorClases: Record<Semaforo, string> = {
  rojo: "bg-red-500",
  amarillo: "bg-yellow-400",
  verde: "bg-green-500",
};

const etiquetas: Record<Semaforo, string> = {
  rojo: "urgente",
  amarillo: "próximo",
  verde: "sin urgencia",
};

export function SemaforoDot({ valor, grande = false }: SemaforoProps) {
  const base = grande ? "w-5 h-5" : "w-3 h-3";
  return (
    <span
      className={`inline-block rounded-full flex-shrink-0 ${base} ${colorClases[valor]}`}
      aria-label={etiquetas[valor]}
      title={etiquetas[valor]}
    />
  );
}
