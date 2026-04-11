import type { Prioridad } from "./types";

interface ZonaEscasez {
  id: string;
  prioridad: Prioridad;
  semaforo: string;
  demandaEstimada: number;
}

interface ResultadoEscasez {
  id: string;
  postergada: boolean;
  razon: string;
}

const ORDEN_PRIORIDAD: Record<Prioridad, number> = {
  alta: 0,
  media: 1,
  baja: 2,
};

export function arbitrarEscasez(
  zonas: ZonaEscasez[],
  capacidadFuente: number
): ResultadoEscasez[] {
  // Solo las "rojo" compiten por la fuente; el resto no genera conflicto.
  const rojas = zonas.filter((z) => z.semaforo === "rojo");
  const otras = zonas.filter((z) => z.semaforo !== "rojo");

  const resultados = new Map<string, ResultadoEscasez>();
  for (const z of otras) {
    resultados.set(z.id, { id: z.id, postergada: false, razon: "sin conflicto" });
  }

  // Orden de atención: prioridad alta primero; dentro de la misma prioridad,
  // mayor demanda primero (gesto hacia lo más crítico productivamente).
  const ordenadas = [...rojas].sort((a, b) => {
    const dp = ORDEN_PRIORIDAD[a.prioridad] - ORDEN_PRIORIDAD[b.prioridad];
    if (dp !== 0) return dp;
    return b.demandaEstimada - a.demandaEstimada;
  });

  let consumido = 0;
  for (const z of ordenadas) {
    if (consumido + z.demandaEstimada <= capacidadFuente) {
      consumido += z.demandaEstimada;
      resultados.set(z.id, { id: z.id, postergada: false, razon: "dentro de capacidad" });
    } else {
      resultados.set(z.id, {
        id: z.id,
        postergada: true,
        razon: `fuente insuficiente, prioridad ${z.prioridad}`,
      });
    }
  }

  // Preservar orden original de entrada.
  return zonas.map((z) => resultados.get(z.id)!);
}
