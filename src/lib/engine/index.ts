import { proyectarDeficit } from "./balance";
import { traducirASemaforo } from "./semaforo";
import { arbitrarEscasez } from "./escasez";
import { calcularConfianza } from "./confianza";
import type {
  ClimaDiario,
  EstadoHidricoPrevio,
  Kc,
  Recomendacion,
  RiegoRegistrado,
  SueloZona,
} from "./types";

export * from "./types";
export { calcularEt0Hargreaves, calcularRadiacionExtraterrestre } from "./et0";
export { proyectarDeficit } from "./balance";
export { calibrarContraSentinel } from "./calibracion";
export { traducirASemaforo } from "./semaforo";
export { arbitrarEscasez } from "./escasez";
export { calcularConfianza } from "./confianza";

export interface MotorInputs {
  zonas: SueloZona[];
  previos: EstadoHidricoPrevio[];
  clima: ClimaDiario;
  kcPorZona: Record<string, Kc>;
  riegos: RiegoRegistrado[];
  capacidadFuente: number;
}

export function ejecutarMotor(inputs: MotorInputs): Recomendacion[] {
  const { zonas, previos, clima, kcPorZona, riegos, capacidadFuente } = inputs;
  const previoPorZona = new Map(previos.map((p) => [p.zonaId, p]));
  const riegoPorZona = new Map(riegos.map((r) => [r.zonaId, r]));

  const proyectadas = zonas.map((z) => {
    const previo = previoPorZona.get(z.id);
    if (!previo) {
      throw new Error(`Falta estado previo para zona ${z.id}`);
    }
    const kc = kcPorZona[z.id];
    if (!kc) {
      throw new Error(`Falta Kc para zona ${z.id}`);
    }
    const riego = riegoPorZona.get(z.id) ?? null;
    const estado = proyectarDeficit(previo, clima, kc, riego);
    const sem = traducirASemaforo(estado.deficit, {
      rojo: z.umbralRojo,
      amarillo: z.umbralAmarillo,
    });
    const errorProm =
      previo.erroresReconciliacion.length === 0
        ? 0
        : previo.erroresReconciliacion.reduce((a, b) => a + b, 0) /
          previo.erroresReconciliacion.length;
    const confianza = calcularConfianza(previo.diasDesdeAlta, errorProm);
    return { zona: z, estado, sem, confianza };
  });

  const arbitraje = arbitrarEscasez(
    proyectadas.map((p) => ({
      id: p.zona.id,
      prioridad: p.zona.prioridad,
      semaforo: p.sem.semaforo,
      demandaEstimada: p.zona.demandaEstimada,
    })),
    capacidadFuente
  );
  const arbPorId = new Map(arbitraje.map((a) => [a.id, a]));

  return proyectadas.map((p): Recomendacion => {
    const arb = arbPorId.get(p.zona.id)!;
    return {
      zonaId: p.zona.id,
      semaforo: p.sem.semaforo,
      timing: p.sem.timing,
      confianza: p.confianza,
      postergada: arb.postergada,
      razon: arb.razon,
    };
  });
}
