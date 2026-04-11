// Quota gate para Sentinel Hub. Techo diario configurable.
// El motor de job pregunta debePausar() antes de cada fetch.

import { logEvento } from "./logger";

const UMBRAL_CORTE_DEFAULT = 25;

export class SentinelBudget {
  private count = 0;
  private readonly techo: number;
  private readonly umbralCorte: number;
  private alertaDisparada = false;

  constructor(techo: number = 30) {
    this.techo = techo;
    // Umbral de corte = techo - 5 (o mínimo 1) para dejar colchón.
    this.umbralCorte = Math.max(1, Math.min(UMBRAL_CORTE_DEFAULT, techo - 5));
  }

  incrementar(): void {
    this.count += 1;
  }

  debePausar(): boolean {
    const pausar = this.count >= this.umbralCorte;
    if (pausar && !this.alertaDisparada) {
      this.alertaDisparada = true;
      logEvento("warn", "CIRCUIT_BREAKER_SENTINEL_ACTIVO", {
        count: this.count,
        techo: this.techo,
        umbralCorte: this.umbralCorte,
      });
    }
    return pausar;
  }

  resetearDiario(): void {
    this.count = 0;
    this.alertaDisparada = false;
  }

  get requestsHoy(): number {
    return this.count;
  }
}
