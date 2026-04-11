// Scheduler wrapper alrededor de node-cron.
// Corre el job diario a las 05:30 America/Santiago.
// Gated con ENABLE_CRON=true para no arrancar en tests.

import cron from "node-cron";
import { ejecutarJobDiario } from "./daily-job";
import { logEvento } from "./logger";

const EXPRESION = "30 5 * * *";
const ZONA = "America/Santiago";

let tareaActiva: cron.ScheduledTask | null = null;

export function iniciarScheduler(): void {
  if (process.env.ENABLE_CRON !== "true") {
    logEvento("info", "scheduler_desactivado", {
      razon: "ENABLE_CRON no es true",
    });
    return;
  }
  if (tareaActiva) {
    logEvento("warn", "scheduler_ya_activo", {});
    return;
  }
  tareaActiva = cron.schedule(
    EXPRESION,
    async () => {
      try {
        const r = await ejecutarJobDiario();
        logEvento("info", "scheduler_corrida_ok", {
          prediosProcesados: r.prediosProcesados,
          recomendacionesCreadas: r.recomendacionesCreadas,
          errores: r.errores.length,
          duracionMs: r.duracionMs,
        });
      } catch (e) {
        logEvento("error", "scheduler_corrida_fallo", {
          mensaje: String((e as Error)?.message ?? e),
        });
      }
    },
    { timezone: ZONA },
  );
  logEvento("info", "scheduler_iniciado", { expresion: EXPRESION, zona: ZONA });
}

export function detenerScheduler(): void {
  if (tareaActiva) {
    tareaActiva.stop();
    tareaActiva = null;
    logEvento("info", "scheduler_detenido", {});
  }
}
