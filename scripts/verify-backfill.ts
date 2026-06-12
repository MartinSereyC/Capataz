// Verificación e2e del pipeline (sin UI): zona sintética → backfill 14 meses
// → backtest → advice. Uso:
//   MOCK_SENTINEL=true DATABASE_URL=... npx tsx scripts/verify-backfill.ts
import { upsertFarm, upsertZones } from '../src/lib/db/repos/zones';
import { ejecutarBackfillZona } from '../src/lib/balance/backfill';
import { calcularAdviceZona } from '../src/lib/balance/run';
import { getSql } from '../src/lib/db/client';

const FARM_ID = '00000000-0000-4000-8000-000000000001';
const ZONE_ID = '00000000-0000-4000-8000-000000000002';

const polygon = {
  type: 'Polygon' as const,
  coordinates: [[
    [-70.75, -34.05],
    [-70.74, -34.05],
    [-70.74, -34.04],
    [-70.75, -34.04],
    [-70.75, -34.05],
  ]] as [number, number][][],
};

async function main() {
  await upsertFarm({ id: FARM_ID, nombre: 'Predio de prueba' });
  const nuevas = await upsertZones([{
    id: ZONE_ID,
    farmId: FARM_ID,
    legacyId: 1,
    nombre: 'Cuartel Norte',
    cultivo: 'Palta Hass',
    areaHa: 12.5,
    polygon,
  }]);
  console.log('Zonas nuevas:', nuevas);

  const t0 = Date.now();
  const resumen = await ejecutarBackfillZona(ZONE_ID);
  console.log(`Backfill en ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log('Jobs:', resumen.jobs.map((j) => `${j.tipo}:${j.estado}`).join(' '));
  console.log('Backtest:', JSON.stringify(resumen.backtest, null, 2));

  const sql = getSql();
  const counts = await sql`
    select
      (select count(*) from weather_daily where farm_id = ${FARM_ID}) as clima,
      (select count(*) from satellite_observations where zone_id = ${ZONE_ID} and sensor = 's2') as s2,
      (select count(*) from satellite_observations where zone_id = ${ZONE_ID} and sensor = 's1') as s1,
      (select count(*) from water_balance_daily where zone_id = ${ZONE_ID}) as balance,
      (select count(*) from zone_calibrations where zone_id = ${ZONE_ID}) as calibraciones,
      (select count(*) from model_evaluations where zone_id = ${ZONE_ID}) as evaluaciones
  `;
  console.log('Conteos:', counts[0]);

  const advice = await calcularAdviceZona(ZONE_ID);
  console.log('Advice:', JSON.stringify(advice, null, 2));

  // Idempotencia: segundo backfill no debe duplicar nada
  await ejecutarBackfillZona(ZONE_ID);
  const counts2 = await sql`
    select
      (select count(*) from weather_daily where farm_id = ${FARM_ID}) as clima,
      (select count(*) from water_balance_daily where zone_id = ${ZONE_ID}) as balance
  `;
  console.log('Tras re-backfill (idempotente):', counts2[0]);

  await sql.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
