// Verificación con credenciales reales (MOCK_SENTINEL=false):
// token CDSE, Statistical API S2/S1, Open-Meteo archive + SoilGrids.
// Uso: npx tsx --env-file=.env.local scripts/verify-real-apis.ts
import { getSentinelToken } from '../src/lib/sentinel/auth';
import { getS2StatsHistory, getS1StatsHistory } from '../src/lib/sentinel/statistical';
import { obtenerClimaArchivo } from '../src/lib/clima/open-meteo-archive';
import { obtenerSuelo } from '../src/lib/suelo/soilgrids';

// Parcela agrícola real en el valle de Cachapoal (Región de O'Higgins)
const polygon = {
  type: 'Polygon' as const,
  coordinates: [[
    [-70.755, -34.170],
    [-70.748, -34.170],
    [-70.748, -34.164],
    [-70.755, -34.164],
    [-70.755, -34.170],
  ]] as [number, number][][],
};

async function main() {
  console.log('1. Token CDSE…');
  const { token } = await getSentinelToken();
  console.log('   OK (' + token.slice(0, 12) + '…)');

  console.log('2. Statistical API S2 (3 meses)…');
  const s2 = await getS2StatsHistory(polygon, '2026-03-01', '2026-06-01');
  console.log(`   ${s2.length} pasadas, origen=${s2[0]?.origen}`);
  console.log('   muestra:', JSON.stringify(s2.slice(-3)));

  console.log('3. Statistical API S1 (3 meses)…');
  const s1 = await getS1StatsHistory(polygon, '2026-03-01', '2026-06-01');
  console.log(`   ${s1.length} pasadas, origen=${s1[0]?.origen}`);
  console.log('   muestra:', JSON.stringify(s1.slice(-3)));

  console.log('4. Open-Meteo archive (1 mes)…');
  const clima = await obtenerClimaArchivo(-34.167, -70.751, '2026-05-01', '2026-05-31');
  console.log(`   ${clima.length} días, et0 presente: ${clima.filter((d) => d.et0Mm != null).length}`);
  console.log('   muestra:', JSON.stringify(clima.slice(-2).map(({ raw: _r, ...d }) => d)));

  console.log('5. SoilGrids…');
  const suelo = await obtenerSuelo(-34.167, -70.751);
  console.log(`   textura=${suelo.textura} CC=${suelo.capacidadCampoPct.toFixed(1)}% PM=${suelo.puntoMarchitezPct.toFixed(1)}%`);

  console.log('Todo OK con APIs reales.');
}

main().catch((err) => { console.error('FALLO:', err.message ?? err); process.exit(1); });
