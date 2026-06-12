import { NextRequest, NextResponse } from 'next/server';
import { dbDisponible } from '@/lib/db/client';
import { ejecutarBackfillZona, estadoBackfillZona } from '@/lib/balance/backfill';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!dbDisponible()) return NextResponse.json({ disponible: false });
  const { id } = await params;

  try {
    const resumen = await ejecutarBackfillZona(id);
    return NextResponse.json({ disponible: true, ...resumen });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    console.error('[backfill]', msg);
    // Los jobs quedan con cursor: re-POSTear reanuda desde donde falló
    const jobs = await estadoBackfillZona(id).catch(() => []);
    return NextResponse.json({ error: msg, jobs }, { status: 500 });
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!dbDisponible()) return NextResponse.json({ disponible: false });
  const { id } = await params;
  try {
    return NextResponse.json({ disponible: true, jobs: await estadoBackfillZona(id) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
