// Reconciliación contra imagen Sentinel-2. El déficit proyectado se pondera
// contra lo observado vía NDMI/NDVI. El error queda registrado para ajustar
// la confianza del motor en fases siguientes.

function observadoDesdeIndices(ndvi: number, ndmi: number, fase: string): number {
  // NDMI mapea linealmente a % agotamiento: ndmi=0.4 -> 0%, ndmi=-0.1 -> 100%.
  const ndmiClamped = Math.max(-0.1, Math.min(0.4, ndmi));
  const baseNdmi = ((0.4 - ndmiClamped) / 0.5) * 100;

  // NDVI modula: vegetación sana (>0.6) reduce estrés percibido,
  // senescente (<0.3) lo amplifica salvo en fases de reposo/cosecha.
  const fasesSenescentes = new Set(["cosecha", "postcosecha", "reposo"]);
  let ajuste = 0;
  if (!fasesSenescentes.has(fase)) {
    if (ndvi < 0.3) ajuste = 10;
    else if (ndvi > 0.6) ajuste = -5;
  }

  return Math.max(0, Math.min(100, baseNdmi + ajuste));
}

export function calibrarContraSentinel(
  deficitProyectado: number,
  ndvi: number,
  ndmi: number,
  fase: string
): { deficitCalibrado: number; errorReconciliacion: number } {
  const observado = observadoDesdeIndices(ndvi, ndmi, fase);
  const deficitCalibrado = 0.6 * observado + 0.4 * deficitProyectado;
  const errorReconciliacion = Math.abs(deficitProyectado - observado) / 100;
  return {
    deficitCalibrado: Math.max(0, Math.min(100, deficitCalibrado)),
    errorReconciliacion,
  };
}
