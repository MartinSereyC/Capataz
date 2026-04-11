import type { SueloEstimado, SueloPredio } from './types';

export async function muestrearPredioYZonas(
  predioLat: number,
  predioLon: number,
  zonas: Array<{ id: string; lat: number; lon: number }>,
  client: (lat: number, lon: number) => Promise<SueloEstimado>
): Promise<SueloPredio> {
  const [centroidePredio, ...zonasResults] = await Promise.all([
    client(predioLat, predioLon),
    ...zonas.map((z) => client(z.lat, z.lon)),
  ]);

  const centroidesZonas = zonas.map((z, i) => ({
    zonaId: z.id,
    suelo: zonasResults[i],
  }));

  const todasLasMuestras = [centroidePredio, ...zonasResults];
  const valores = todasLasMuestras.map((s) => s.capacidadCampoPct);
  const max = Math.max(...valores);
  const min = Math.min(...valores);

  // Divergence as percentage of the mean
  const media = valores.reduce((a, b) => a + b, 0) / valores.length;
  const divergenciaMaxPct = media > 0 ? ((max - min) / media) * 100 : 0;

  return {
    centroidePredio,
    centroidesZonas,
    heterogeneo: divergenciaMaxPct > 20,
    divergenciaMaxPct,
  };
}
