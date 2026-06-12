import { NextRequest, NextResponse } from 'next/server';
import { dbDisponible } from '@/lib/db/client';
import { upsertFarm, upsertZones, type ZoneInput } from '@/lib/db/repos/zones';
import type { GeoJSONPolygon } from '@/types';

interface SyncBody {
  farm: { id: string; nombre: string };
  zones: Array<{
    uuid: string;
    id: number;
    name?: string;
    crop: string;
    ha: number;
    polygon: GeoJSONPolygon;
  }>;
}

export async function POST(req: NextRequest) {
  if (!dbDisponible()) {
    return NextResponse.json({ disponible: false });
  }

  let body: SyncBody;
  try {
    body = (await req.json()) as SyncBody;
    if (!body.farm?.id || !Array.isArray(body.zones)) throw new Error('payload inválido');
  } catch {
    return NextResponse.json({ error: 'payload inválido' }, { status: 400 });
  }

  try {
    await upsertFarm({ id: body.farm.id, nombre: body.farm.nombre || 'Mi Campo' });
    const inputs: ZoneInput[] = body.zones.map((z) => ({
      id: z.uuid,
      farmId: body.farm.id,
      legacyId: z.id ?? null,
      nombre: z.name ?? null,
      cultivo: z.crop,
      areaHa: z.ha,
      polygon: z.polygon,
    }));
    const nuevas = await upsertZones(inputs);
    return NextResponse.json({ disponible: true, zonasNuevas: nuevas });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    console.error('[zones/sync]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
