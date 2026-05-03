import { NextRequest, NextResponse } from 'next/server';
import { obtenerClimaHistoricoYForecast } from '@/lib/clima/open-meteo';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get('lat') ?? '');
  const lng = parseFloat(searchParams.get('lng') ?? '');

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: 'lat y lng requeridos' }, { status: 400 });
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
