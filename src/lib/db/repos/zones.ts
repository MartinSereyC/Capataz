import { getSql } from '../client';
import { centroide } from '../../geo/centroid';
import type { GeoJSONPolygon } from '@/types';

export interface FarmInput {
  id: string;
  nombre: string;
}

export interface ZoneInput {
  id: string; // uuid generado en cliente
  farmId: string;
  legacyId: number | null;
  nombre: string | null;
  cultivo: string;
  areaHa: number;
  polygon: GeoJSONPolygon;
}

export interface ZoneRow {
  id: string;
  farmId: string;
  legacyId: number | null;
  nombre: string | null;
  cultivo: string;
  areaHa: number;
  polygon: GeoJSONPolygon;
  centroidLat: number;
  centroidLng: number;
}

export async function upsertFarm(farm: FarmInput): Promise<void> {
  const sql = getSql();
  await sql`
    insert into farms (id, nombre) values (${farm.id}, ${farm.nombre})
    on conflict (id) do update set nombre = excluded.nombre
  `;
}

// Devuelve los IDs de zonas nuevas (candidatas a backfill).
export async function upsertZones(zones: ZoneInput[]): Promise<string[]> {
  if (zones.length === 0) return [];
  const sql = getSql();
  const nuevas: string[] = [];

  for (const z of zones) {
    const { lat, lng } = centroide(z.polygon);
    const rows = await sql`
      insert into zones (id, farm_id, legacy_id, nombre, cultivo, area_ha, geom_geojson, centroid_lat, centroid_lng)
      values (${z.id}, ${z.farmId}, ${z.legacyId}, ${z.nombre}, ${z.cultivo}, ${z.areaHa},
              ${sql.json(z.polygon as never)}, ${lat}, ${lng})
      on conflict (id) do update set
        nombre = excluded.nombre,
        cultivo = excluded.cultivo,
        area_ha = excluded.area_ha,
        geom_geojson = excluded.geom_geojson,
        centroid_lat = excluded.centroid_lat,
        centroid_lng = excluded.centroid_lng,
        updated_at = now()
      returning (xmax = 0) as inserted
    `;
    if (rows[0]?.inserted) nuevas.push(z.id);
  }
  return nuevas;
}

function rowToZone(r: Record<string, unknown>): ZoneRow {
  return {
    id: r.id as string,
    farmId: r.farm_id as string,
    legacyId: r.legacy_id as number | null,
    nombre: r.nombre as string | null,
    cultivo: r.cultivo as string,
    areaHa: Number(r.area_ha),
    polygon: r.geom_geojson as GeoJSONPolygon,
    centroidLat: r.centroid_lat as number,
    centroidLng: r.centroid_lng as number,
  };
}

export async function getZone(zoneId: string): Promise<ZoneRow | null> {
  const sql = getSql();
  const rows = await sql`select * from zones where id = ${zoneId}`;
  return rows.length > 0 ? rowToZone(rows[0]) : null;
}

export async function listZones(farmId: string): Promise<ZoneRow[]> {
  const sql = getSql();
  const rows = await sql`
    select * from zones where farm_id = ${farmId} and activo order by legacy_id nulls last, created_at
  `;
  return rows.map(rowToZone);
}
