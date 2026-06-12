import { getSql } from '../client';
import type { SueloEstimado, TexturaSuelo } from '../../suelo/types';

export interface SoilSnapshotRow {
  zoneId: string;
  textura: TexturaSuelo;
  capacidadCampoPct: number;
  puntoMarchitezPct: number;
  profundidadRaizM: number;
  tawMm: number;
  origen: string;
}

export async function insertSoilSnapshot(
  zoneId: string,
  suelo: SueloEstimado,
  profundidadRaizM: number,
  tawMm: number,
): Promise<void> {
  const sql = getSql();
  await sql`
    insert into soil_snapshots (zone_id, textura, capacidad_campo_pct, punto_marchitez_pct,
                                profundidad_raiz_m, taw_mm, origen, raw)
    values (${zoneId}, ${suelo.textura}, ${suelo.capacidadCampoPct}, ${suelo.puntoMarchitezPct},
            ${profundidadRaizM}, ${tawMm}, ${suelo.origen}, ${suelo.raw ? sql.json(suelo.raw as never) : null})
  `;
}

export async function getLatestSoilSnapshot(zoneId: string): Promise<SoilSnapshotRow | null> {
  const sql = getSql();
  const rows = await sql`
    select * from soil_snapshots where zone_id = ${zoneId}
    order by fetched_at desc limit 1
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    zoneId: r.zone_id as string,
    textura: r.textura as TexturaSuelo,
    capacidadCampoPct: Number(r.capacidad_campo_pct),
    puntoMarchitezPct: Number(r.punto_marchitez_pct),
    profundidadRaizM: Number(r.profundidad_raiz_m),
    tawMm: Number(r.taw_mm),
    origen: r.origen as string,
  };
}
