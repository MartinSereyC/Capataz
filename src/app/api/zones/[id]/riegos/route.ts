import { NextRequest, NextResponse } from 'next/server';
import { dbDisponible } from '@/lib/db/client';
import { insertRiego, listRiegos } from '@/lib/db/repos/riego';
import { ejecutarBalanceZona, calcularAdviceZona, hoyISO, sumarMeses } from '@/lib/balance/run';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!dbDisponible()) return NextResponse.json({ disponible: false });
  const { id } = await params;

  let body: { fecha: string; mmAplicados?: number | null; horas?: number | null; nota?: string | null };
  try {
    body = await req.json();
    if (!body.fecha || (body.mmAplicados == null && body.horas == null)) {
      throw new Error('fecha y mmAplicados u horas requeridos');
    }
  } catch {
    return NextResponse.json({ error: 'payload inválido' }, { status: 400 });
  }

  try {
    await insertRiego({
      zoneId: id,
      fecha: body.fecha,
      mmAplicados: body.mmAplicados ?? null,
      horas: body.horas ?? null,
      nota: body.nota ?? null,
    });

    // El riego cambia la trayectoria: rebalancear desde el inicio de ventana
    // (replay en memoria, barato) y devolver la recomendación actualizada.
    const hoy = hoyISO();
    await ejecutarBalanceZona(id, sumarMeses(hoy, -14), hoy);
    const advice = await calcularAdviceZona(id);

    return NextResponse.json({ disponible: true, advice });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    console.error('[riegos]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!dbDisponible()) return NextResponse.json({ disponible: false });
  const { id } = await params;
  try {
    return NextResponse.json({ disponible: true, riegos: await listRiegos(id) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
