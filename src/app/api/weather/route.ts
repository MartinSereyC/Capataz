import { NextRequest, NextResponse } from 'next/server';
import { obtenerClimaHistoricoYForecast, hoyLocalSantiago } from '@/lib/clima/open-meteo';
import { mockClimaRange } from '@/lib/clima/mock';
import { isMockMode } from '@/lib/sentinel/mock';

function sumarDias(fecha: string, dias: number): string {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().split('T')[0];
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get('lat') ?? '');
  const lng = parseFloat(searchParams.get('lng') ?? '');

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: 'lat y lng requeridos' }, { status: 400 });
  }

  if (isMockMode()) {
    const hoy = hoyLocalSantiago();
    const pasado = mockClimaRange(lat, lng, sumarDias(hoy, -14), hoy);
    const futuro = mockClimaRange(lat, lng, sumarDias(hoy, 1), sumarDias(hoy, 7), true);
    return NextResponse.json([...pasado, ...futuro]);
  }

  try {
    // Last 14 days + 7 days forecast
    const data = await obtenerClimaHistoricoYForecast(lat, lng, 14, 7);
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    console.error('[weather] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
