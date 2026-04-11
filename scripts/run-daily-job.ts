#!/usr/bin/env tsx
// CLI para correr el job diario manualmente.
// Uso: tsx scripts/run-daily-job.ts [--fecha=YYYY-MM-DD] [--predio=uuid]

import { ejecutarJobDiario } from "@/lib/cron";

function parseArgs(argv: string[]): { fecha?: Date; predioIds?: string[] } {
  const out: { fecha?: Date; predioIds?: string[] } = {};
  for (const arg of argv.slice(2)) {
    if (arg.startsWith("--fecha=")) {
      const v = arg.slice("--fecha=".length);
      out.fecha = new Date(v);
    } else if (arg.startsWith("--predio=")) {
      const v = arg.slice("--predio=".length);
      out.predioIds = (out.predioIds ?? []).concat(v);
    }
  }
  return out;
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv);
  const r = await ejecutarJobDiario(opts);
  process.stdout.write(
    JSON.stringify(
      {
        prediosProcesados: r.prediosProcesados,
        recomendacionesCreadas: r.recomendacionesCreadas,
        errores: r.errores,
        duracionMs: r.duracionMs,
      },
      null,
      2,
    ) + "\n",
  );
  process.exit(r.errores.length > 0 ? 1 : 0);
}

main().catch((e) => {
  process.stderr.write("job_diario_crash: " + String(e) + "\n");
  process.exit(1);
});
