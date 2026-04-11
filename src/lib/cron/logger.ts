// Structured JSON line logger for the daily job.
// One line per event, written to stdout so operators can grep/tail.

export type NivelLog = "info" | "warn" | "error";

export interface LogLine {
  ts: string;
  nivel: NivelLog;
  evento: string;
  [k: string]: unknown;
}

type Escritor = (linea: string) => void;

let escritor: Escritor = (linea) => {
  process.stdout.write(linea + "\n");
};

export function _setEscritor(fn: Escritor): void {
  escritor = fn;
}

export function _resetEscritor(): void {
  escritor = (linea) => {
    process.stdout.write(linea + "\n");
  };
}

export function logEvento(
  nivel: NivelLog,
  evento: string,
  contexto: Record<string, unknown> = {},
): void {
  const linea: LogLine = {
    ts: new Date().toISOString(),
    nivel,
    evento,
    ...contexto,
  };
  escritor(JSON.stringify(linea));
}

export function logJobCorrida(
  predioId: string,
  zonaId: string,
  inputs: unknown,
  output: unknown,
  duracionMs: number,
  error?: unknown,
): void {
  const nivel: NivelLog = error ? "error" : "info";
  logEvento(nivel, "job_corrida_zona", {
    predioId,
    zonaId,
    inputs,
    output,
    duracionMs,
    error: error ? String((error as Error)?.message ?? error) : null,
  });
}
