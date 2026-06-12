"use client";

// Sincroniza las zonas de localStorage con la DB y obtiene la recomendación
// cuantificada por zona. Flujo al montar el dashboard:
//   1. Asigna uuid a zonas/predio legados y reescribe localStorage
//   2. POST /api/zones/sync (upsert farms/zones; devuelve zonas nuevas)
//   3. POST backfill para zonas nuevas (14 meses + backtest)
//   4. POST refresh por zona (catch-up) y GET advice del predio
// Si no hay DB (disponible:false) el hook reporta advice=null y la UI
// simplemente no muestra los campos cuantificados.
import { useEffect, useState } from 'react';
import type { SavedZone } from '@/types';
import type { AdviceZona } from '@/lib/balance/run';

export type ZoneAdvice = AdviceZona & { prioridad: number };

export interface ZoneSyncState {
  fase: 'inactivo' | 'sincronizando' | 'backfill' | 'listo' | 'sin_db' | 'error';
  advicePorUuid: Record<string, ZoneAdvice>;
  error: string | null;
  refrescar: () => void;
}

interface FarmMeta {
  uuid?: string;
  farmName?: string;
}

function asegurarUuids(): { farmId: string; farmName: string; zones: SavedZone[] } | null {
  try {
    const farmRaw = localStorage.getItem('capataz_farm');
    const zonesRaw = localStorage.getItem('capataz_zones');
    if (!zonesRaw) return null;

    const farm: FarmMeta = farmRaw ? JSON.parse(farmRaw) : {};
    if (!farm.uuid) {
      farm.uuid = crypto.randomUUID();
      localStorage.setItem('capataz_farm', JSON.stringify(farm));
    }

    const zones: SavedZone[] = JSON.parse(zonesRaw);
    let cambio = false;
    for (const z of zones) {
      if (!z.uuid) {
        z.uuid = crypto.randomUUID();
        cambio = true;
      }
    }
    if (cambio) localStorage.setItem('capataz_zones', JSON.stringify(zones));

    return { farmId: farm.uuid, farmName: farm.farmName ?? 'Mi Campo', zones };
  } catch {
    return null;
  }
}

export function useZoneSync(): ZoneSyncState {
  const [fase, setFase] = useState<ZoneSyncState['fase']>('inactivo');
  const [advicePorUuid, setAdvice] = useState<Record<string, ZoneAdvice>>({});
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelado = false;

    async function correr() {
      const datos = asegurarUuids();
      if (!datos || datos.zones.length === 0) return;
      setFase('sincronizando');

      try {
        const syncRes = await fetch('/api/zones/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            farm: { id: datos.farmId, nombre: datos.farmName },
            zones: datos.zones.map((z) => ({
              uuid: z.uuid, id: z.id, name: z.name, crop: z.crop, ha: z.ha, polygon: z.polygon,
            })),
          }),
        });
        const sync = await syncRes.json();
        if (cancelado) return;
        if (sync.disponible === false) {
          setFase('sin_db');
          return;
        }
        if (!syncRes.ok) throw new Error(sync.error ?? 'sync falló');

        const nuevas: string[] = sync.zonasNuevas ?? [];
        if (nuevas.length > 0) {
          setFase('backfill');
          for (const zoneId of nuevas) {
            if (cancelado) return;
            await fetch(`/api/zones/${zoneId}/backfill`, { method: 'POST' });
          }
        }

        // Catch-up diario para las existentes (idempotente, barato)
        for (const z of datos.zones) {
          if (cancelado) return;
          if (!nuevas.includes(z.uuid!)) {
            await fetch(`/api/zones/${z.uuid}/refresh`, { method: 'POST' });
          }
        }

        const advRes = await fetch(`/api/farms/${datos.farmId}/advice`);
        const adv = await advRes.json();
        if (cancelado) return;
        if (adv.disponible && Array.isArray(adv.zonas)) {
          const map: Record<string, ZoneAdvice> = {};
          for (const z of adv.zonas as ZoneAdvice[]) map[z.zoneId] = z;
          setAdvice(map);
        }
        setFase('listo');
      } catch (err) {
        if (!cancelado) {
          setError(err instanceof Error ? err.message : 'Error desconocido');
          setFase('error');
        }
      }
    }

    correr();
    return () => { cancelado = true; };
  }, [tick]);

  return { fase, advicePorUuid, error, refrescar: () => setTick((t) => t + 1) };
}
