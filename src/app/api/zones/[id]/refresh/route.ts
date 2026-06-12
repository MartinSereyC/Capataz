import { NextRequest, NextResponse } from 'next/server';
import { dbDisponible } from '@/lib/db/client';
import { refreshZona } from '@/lib/balance/backfill';
import { calcularAdviceZona } from '@/lib/balance/run';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!dbDisponible()) return NextResponse.json({ disponible: false });
  const { id } = await params;

  try {
    await refreshZona(id);
    const advice = await calcularAdviceZona(id);
    return NextResponse.json({ disponible: true, advice });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    console.error('[refresh]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
