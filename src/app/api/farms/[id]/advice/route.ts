import { NextRequest, NextResponse } from 'next/server';
import { dbDisponible } from '@/lib/db/client';
import { listZones } from '@/lib/db/repos/zones';
import { insertAdviceSnapshot } from '@/lib/db/repos/advice';
import { calcularAdviceZona, hoyISO } from '@/lib/balance/run';
import { priorizarZonas } from '@/lib/balance/recomendacion';
import { ENGINE_VERSION } from '@/lib/balance/version';
import type { AdviceZona } from '@/lib/balance/run';

export interface FarmAdviceResponse {
  disponible: boolean;
  zonas?: Array<AdviceZona & { prioridad: number }>;
}

// Recomendación por zona + ranking del predio. Punto único de inserción de
// advice_snapshots (auditoría / dataset ML futuro).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!dbDisponible()) return NextResponse.json({ disponible: false });
  const { id } = await params;

  try {
    const zones = await listZones(id);
    const advices: AdviceZona[] = [];
    for (const z of zones) {
      const a = await calcularAdviceZona(z.id);
      if (a) advices.push(a); // zonas sin backfill aún: se omiten (sin dato no se muestra)
    }

    const ranking = priorizarZonas(advices.map((a) => ({ zoneId: a.zoneId, rec: a.rec })));
    const prioridadPorZona = new Map(ranking.map((r) => [r.zoneId, r.prioridad]));

    const hoy = hoyISO();
    const zonas = advices.map((a) => ({
      ...a,
      prioridad: prioridadPorZona.get(a.zoneId) ?? advices.length,
    }));

    await Promise.all(zonas.map((z) =>
      insertAdviceSnapshot(z.zoneId, hoy, z.rec, z.fuentes, z.prioridad, ENGINE_VERSION),
    ));

    return NextResponse.json({ disponible: true, zonas } satisfies FarmAdviceResponse);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    console.error('[farms/advice]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
