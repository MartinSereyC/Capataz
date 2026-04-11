"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import type { GeoJSONPolygon } from "@/types";
import { extractTextFromPDF } from "@/lib/pdf/extract-text";
import { parseCoordinates } from "@/lib/pdf/parse-coordinates";
import { utmPairsToWGS84 } from "@/lib/geo/utm-converter";
import { buildPolygon } from "@/lib/geo/polygon-builder";
import { zonaDentroDePredio, sinTraslapesEntreZonas } from "@/lib/onboarding/validador";
import { REGIONES, REGIONES_COMUNAS } from "@/lib/constants/regiones-comunas";
import { guardarPredioCompleto } from "./actions";
import { useRouter } from "next/navigation";

// Lazy-load the map to avoid SSR issues with Leaflet
const PredioMap = dynamic(() => import("@/components/map/predio-map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-96 bg-gray-100 flex items-center justify-center text-gray-500">
      Cargando mapa...
    </div>
  ),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Cultivo =
  | "palto_hass"
  | "citricos"
  | "ciruela_dagen"
  | "nogales"
  | "uva_mesa"
  | "uva_vinifera"
  | "manzano"
  | "cerezo"
  | "arandano"
  | "duraznero"
  | "almendro"
  | "olivo"
  | "kiwi";
type Prioridad = "alta" | "media" | "baja";
type FuenteTipo = "pozo" | "canal" | "acumulador";

interface ZonaLocal {
  geometria: GeoJSONPolygon;
  nombre: string;
  cultivo: Cultivo;
  prioridad: Prioridad;
}

interface FuenteLocal {
  tipo: FuenteTipo;
  caudal_estimado_lh: number | null;
  capacidad_estimada_l: number | null;
  notas: string;
  zonaIndices: number[];
}

const PASOS = [
  "Subir PDF o dibujar",
  "Ajustar polígono",
  "Dibujar zonas",
  "Fuente hídrica",
  "Revisar y guardar",
] as const;

const CULTIVO_LABELS: Record<Cultivo, string> = {
  palto_hass: "Palto Hass",
  citricos: "Cítricos",
  ciruela_dagen: "Ciruela D'Agen",
  nogales: "Nogales",
  uva_mesa: "Uva de mesa",
  uva_vinifera: "Uva vinífera",
  manzano: "Manzano",
  cerezo: "Cerezo",
  arandano: "Arándano",
  duraznero: "Duraznero / Nectarino",
  almendro: "Almendro",
  olivo: "Olivo",
  kiwi: "Kiwi",
};

const PRIORIDAD_LABELS: Record<Prioridad, string> = {
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};

const FUENTE_LABELS: Record<FuenteTipo, string> = {
  pozo: "Pozo",
  canal: "Canal",
  acumulador: "Acumulador",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function NuevoPredioWizard() {
  const router = useRouter();
  const [paso, setPaso] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Step 1 — predio info + polygon source
  const [nombrePredio, setNombrePredio] = useState("");
  const [region, setRegion] = useState("");
  const [comuna, setComuna] = useState("");
  const [geometriaPredio, setGeometriaPredio] = useState<GeoJSONPolygon | null>(null);
  const [parseoError, setParseoError] = useState<string | null>(null);
  const [parseando, setParseando] = useState(false);
  const [centroMapa, setCentroMapa] = useState<[number, number] | null>(null);
  const [geocodificando, setGeocodificando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Step 3 — zones
  const [zonas, setZonas] = useState<ZonaLocal[]>([]);
  const [zonaEnCurso, setZonaEnCurso] = useState<GeoJSONPolygon | null>(null);
  const [zonaForm, setZonaForm] = useState<{
    nombre: string;
    cultivo: Cultivo;
    prioridad: Prioridad;
  }>({ nombre: "", cultivo: "palto_hass", prioridad: "alta" });

  // Step 4 — fuente
  const [fuentes, setFuentes] = useState<FuenteLocal[]>([]);
  const [fuenteForm, setFuenteForm] = useState<FuenteLocal>({
    tipo: "pozo",
    caudal_estimado_lh: null,
    capacidad_estimada_l: null,
    notas: "",
    zonaIndices: [],
  });

  // ---------------------------------------------------------------------------
  // Handlers — Step 1
  // ---------------------------------------------------------------------------

  async function handlePDF(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseando(true);
    setParseoError(null);
    try {
      const buf = Buffer.from(await file.arrayBuffer());
      const texto = await extractTextFromPDF(buf);
      const coords = parseCoordinates(texto);
      if (!coords || coords.rawPairs.length < 3) {
        setParseoError("No se encontraron coordenadas en el PDF. Puedes dibujar el predio manualmente.");
        setParseando(false);
        return;
      }
      let wgs84: [number, number][];
      if (coords.format === "UTM_18S" || coords.format === "UTM_19S") {
        wgs84 = utmPairsToWGS84(coords.rawPairs, coords.utmZone!);
      } else {
        wgs84 = coords.rawPairs as [number, number][];
      }
      const { polygon } = buildPolygon(wgs84);
      setGeometriaPredio(polygon);
    } catch (err) {
      setParseoError(err instanceof Error ? err.message : "Error al procesar el PDF");
    } finally {
      setParseando(false);
    }
  }

  async function handleDibujarManual() {
    setGeometriaPredio(null);
    setParseoError(null);
    if (comuna && region) {
      setGeocodificando(true);
      try {
        const query = encodeURIComponent(`${comuna}, ${region}, Chile`);
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`,
          { headers: { "Accept-Language": "es" } }
        );
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setCentroMapa([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
        } else {
          setCentroMapa(null);
        }
      } catch {
        setCentroMapa(null);
      } finally {
        setGeocodificando(false);
      }
    } else {
      setCentroMapa(null);
    }
    setPaso(1);
  }

  // ---------------------------------------------------------------------------
  // Handlers — Step 3
  // ---------------------------------------------------------------------------

  const handleNuevaZonaGeom = useCallback((geom: GeoJSONPolygon) => {
    setZonaEnCurso(geom);
  }, []);

  const capasExtraZonas = useMemo(
    () => zonas.map((z) => z.geometria),
    [zonas]
  );
  const capasExtraNombres = useMemo(
    () => zonas.map((z) => z.nombre),
    [zonas]
  );

  function agregarZona() {
    if (!zonaEnCurso) {
      setError("Dibuja el polígono de la zona en el mapa.");
      return;
    }
    if (!zonaForm.nombre.trim()) {
      setError("Ingresa un nombre para la zona.");
      return;
    }
    if (geometriaPredio && !zonaDentroDePredio(zonaEnCurso, geometriaPredio)) {
      setError("La zona debe estar dentro del predio.");
      return;
    }
    const nuevasZonas = [...zonas, { ...zonaForm, geometria: zonaEnCurso }];
    if (!sinTraslapesEntreZonas(nuevasZonas.map((z) => z.geometria))) {
      setError("La zona se traslapa con otra zona existente.");
      return;
    }
    setZonas(nuevasZonas);
    setZonaEnCurso(null);
    setZonaForm({ nombre: "", cultivo: "palto_hass", prioridad: "alta" });
    setError(null);
  }

  function eliminarZona(idx: number) {
    setZonas(zonas.filter((_, i) => i !== idx));
  }

  // ---------------------------------------------------------------------------
  // Handlers — Step 4
  // ---------------------------------------------------------------------------

  function agregarFuente() {
    setFuentes([...fuentes, { ...fuenteForm }]);
    setFuenteForm({
      tipo: "pozo",
      caudal_estimado_lh: null,
      capacidad_estimada_l: null,
      notas: "",
      zonaIndices: [],
    });
  }

  function toggleZonaFuente(idx: number) {
    const current = fuenteForm.zonaIndices;
    const updated = current.includes(idx)
      ? current.filter((i) => i !== idx)
      : [...current, idx];
    setFuenteForm({ ...fuenteForm, zonaIndices: updated });
  }

  // ---------------------------------------------------------------------------
  // Final save
  // ---------------------------------------------------------------------------

  async function handleGuardar() {
    if (!geometriaPredio) {
      setError("Falta el polígono del predio.");
      return;
    }
    if (zonas.length === 0) {
      setError("Agrega al menos una zona.");
      return;
    }
    setGuardando(true);
    setError(null);
    const result = await guardarPredioCompleto({
      nombre: nombrePredio,
      region,
      comuna,
      geometriaPredio,
      zonas: zonas.map((z) => ({
        nombre: z.nombre,
        geometria: z.geometria,
        cultivo: z.cultivo,
        prioridad: z.prioridad,
      })),
      fuentes: fuentes.map((f) => ({
        tipo: f.tipo,
        caudal_estimado_lh: f.caudal_estimado_lh,
        capacidad_estimada_l: f.capacidad_estimada_l,
        notas: f.notas || null,
        zonaIndices: f.zonaIndices,
      })),
    });
    setGuardando(false);
    if (result.ok && result.predioId) {
      router.push(`/predios/${result.predioId}`);
    } else {
      setError(result.error ?? "Error al guardar");
    }
  }

  // ---------------------------------------------------------------------------
  // Step navigation
  // ---------------------------------------------------------------------------

  function avanzar() {
    setError(null);
    if (paso === 0) {
      if (!nombrePredio.trim()) { setError("Ingresa el nombre del predio."); return; }
      if (!geometriaPredio) { setError("Sube un PDF con coordenadas o dibuja el predio manualmente."); return; }
    }
    if (paso === 2 && zonas.length === 0) {
      setError("Agrega al menos una zona antes de continuar.");
      return;
    }
    setPaso((p) => Math.min(p + 1, PASOS.length - 1));
  }

  function retroceder() {
    setError(null);
    setPaso((p) => Math.max(p - 1, 0));
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  function Stepper() {
    return (
      <nav className="flex gap-1 mb-6 overflow-x-auto">
        {PASOS.map((label, i) => (
          <div
            key={i}
            className={`flex items-center gap-1 text-xs whitespace-nowrap px-2 py-1 rounded ${
              i === paso
                ? "bg-blue-600 text-white font-semibold"
                : i < paso
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-400"
            }`}
          >
            <span>{i + 1}.</span>
            <span>{label}</span>
          </div>
        ))}
      </nav>
    );
  }

  // ---------------------------------------------------------------------------
  // Steps
  // ---------------------------------------------------------------------------

  const comunasDisponibles = region
    ? [...(REGIONES_COMUNAS[region] ?? [])].sort((a, b) => a.localeCompare(b, "es"))
    : [];

  const paso0 = (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Datos del predio</h2>
        <div>
          <label className="block text-sm font-medium mb-1">Nombre *</label>
          <input
            className="border rounded w-full px-3 py-2 text-sm"
            value={nombrePredio}
            onChange={(e) => setNombrePredio(e.target.value)}
            placeholder="Ej: Fundo La Esperanza"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Región</label>
            <select
              className="border rounded w-full px-3 py-2 text-sm bg-white"
              value={region}
              onChange={(e) => {
                setRegion(e.target.value);
                setComuna("");
              }}
            >
              <option value="">Selecciona una región</option>
              {REGIONES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Comuna</label>
            <select
              className="border rounded w-full px-3 py-2 text-sm bg-white disabled:bg-gray-100 disabled:text-gray-400"
              value={comuna}
              onChange={(e) => setComuna(e.target.value)}
              disabled={!region}
            >
              <option value="">
                {region ? "Selecciona una comuna" : "Primero elige una región"}
              </option>
              {comunasDisponibles.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="border rounded p-4 space-y-3">
          <p className="text-sm font-medium">Polígono del predio</p>
          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={handlePDF}
            />
            <button
              type="button"
              onClick={handleDibujarManual}
              className="bg-blue-600 text-white text-sm px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
              disabled={geocodificando}
            >
              {geocodificando ? "Ubicando comuna..." : "Dibujar manualmente"}
            </button>
            <span className="text-sm text-gray-500 ml-3">o bien</span>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="ml-3 text-sm text-blue-600 underline disabled:opacity-50"
              disabled={parseando}
            >
              {parseando ? "Procesando PDF..." : "Subir escritura (PDF)"}
            </button>
            {!comuna && (
              <p className="text-xs text-gray-500 mt-1">
                Tip: elige región y comuna para centrar el mapa en tu zona.
              </p>
            )}
          </div>
          {parseoError && (
            <p className="text-sm text-red-600">{parseoError}</p>
          )}
          {geometriaPredio && (
            <p className="text-sm text-green-700">
              Polígono cargado ({geometriaPredio.coordinates[0].length - 1} puntos).
            </p>
          )}
        </div>
      </div>
  );

  const paso1 = (
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">
          {geometriaPredio ? "Ajustar polígono del predio" : "Dibujar polígono del predio"}
        </h2>
        <p className="text-sm text-gray-600">
          {geometriaPredio
            ? "Usa los controles del mapa para editar los vértices si es necesario."
            : "Usa la herramienta de polígono en el mapa para dibujar los límites de tu predio."}
        </p>
        <div className="h-96 rounded overflow-hidden border">
          <PredioMap
            geometriaInicial={geometriaPredio}
            modo={geometriaPredio ? "edit" : "draw-predio"}
            onCambio={setGeometriaPredio}
            centro={centroMapa}
          />
        </div>
      </div>
  );

  const paso2 = (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Dibujar zonas</h2>
        <div className="h-80 rounded overflow-hidden border">
          <PredioMap
            geometriaInicial={geometriaPredio}
            modo="draw-zona"
            onCambio={handleNuevaZonaGeom}
            capasExtra={capasExtraZonas}
            capasExtraLabels={capasExtraNombres}
            onDrawError={setError}
          />
        </div>
        {zonaEnCurso && (
          <div className="border rounded p-3 space-y-3 bg-gray-50">
            <p className="text-sm font-medium text-gray-700">Configurar zona dibujada</p>
            <div className="grid grid-cols-1 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Nombre de la zona
                </label>
                <input
                  className="w-full border rounded px-3 py-2 text-sm"
                  placeholder="Ej: Cuartel norte"
                  value={zonaForm.nombre}
                  onChange={(e) => setZonaForm({ ...zonaForm, nombre: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Cultivo
                </label>
                <p className="text-xs text-gray-500 mb-1">
                  Qué está plantado en esta zona. Determina las necesidades de riego por mes.
                </p>
                <select
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={zonaForm.cultivo}
                  onChange={(e) =>
                    setZonaForm({ ...zonaForm, cultivo: e.target.value as Cultivo })
                  }
                >
                  {Object.entries(CULTIVO_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Prioridad económica
                </label>
                <p className="text-xs text-gray-500 mb-1">
                  Qué tan importante es esta zona para tu producción. Si falta agua, se riegan primero las de prioridad alta.
                </p>
                <select
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={zonaForm.prioridad}
                  onChange={(e) =>
                    setZonaForm({ ...zonaForm, prioridad: e.target.value as Prioridad })
                  }
                >
                  {Object.entries(PRIORIDAD_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={agregarZona}
                className="bg-green-600 text-white text-sm px-4 py-2 rounded hover:bg-green-700"
              >
                Agregar zona
              </button>
            </div>
          </div>
        )}
        {zonas.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-medium">Zonas agregadas ({zonas.length})</p>
            {zonas.map((z, i) => (
              <div key={i} className="flex items-center justify-between border rounded px-3 py-2 text-sm">
                <span>{z.nombre} — {CULTIVO_LABELS[z.cultivo]} / {PRIORIDAD_LABELS[z.prioridad]}</span>
                <button
                  type="button"
                  onClick={() => eliminarZona(i)}
                  className="text-red-500 text-xs ml-2"
                >
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
  );

  const paso3 = (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Fuente hídrica</h2>
        <div className="border rounded p-4 space-y-3">
          <select
            className="border rounded px-3 py-2 text-sm w-full"
            value={fuenteForm.tipo}
            onChange={(e) =>
              setFuenteForm({ ...fuenteForm, tipo: e.target.value as FuenteTipo })
            }
          >
            {Object.entries(FUENTE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          {(fuenteForm.tipo === "pozo" || fuenteForm.tipo === "canal") && (
            <div>
              <label className="block text-sm font-medium mb-1">Caudal estimado (L/h)</label>
              <input
                type="number"
                className="border rounded px-3 py-2 text-sm w-full"
                value={fuenteForm.caudal_estimado_lh ?? ""}
                onChange={(e) =>
                  setFuenteForm({
                    ...fuenteForm,
                    caudal_estimado_lh: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
            </div>
          )}
          {fuenteForm.tipo === "acumulador" && (
            <div>
              <label className="block text-sm font-medium mb-1">Capacidad estimada (L)</label>
              <input
                type="number"
                className="border rounded px-3 py-2 text-sm w-full"
                value={fuenteForm.capacidad_estimada_l ?? ""}
                onChange={(e) =>
                  setFuenteForm({
                    ...fuenteForm,
                    capacidad_estimada_l: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">Notas</label>
            <textarea
              className="border rounded px-3 py-2 text-sm w-full"
              rows={2}
              value={fuenteForm.notas}
              onChange={(e) => setFuenteForm({ ...fuenteForm, notas: e.target.value })}
            />
          </div>
          <div>
            <p className="text-sm font-medium mb-1">Asignar a zonas</p>
            {zonas.map((z, i) => (
              <label key={i} className="flex items-center gap-2 text-sm mb-1">
                <input
                  type="checkbox"
                  checked={fuenteForm.zonaIndices.includes(i)}
                  onChange={() => toggleZonaFuente(i)}
                />
                {z.nombre}
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={agregarFuente}
            className="bg-blue-600 text-white text-sm px-4 py-2 rounded hover:bg-blue-700"
          >
            Agregar fuente
          </button>
        </div>
        {fuentes.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-medium">Fuentes agregadas ({fuentes.length})</p>
            {fuentes.map((f, i) => (
              <div key={i} className="border rounded px-3 py-2 text-sm text-gray-700">
                {FUENTE_LABELS[f.tipo]}
                {f.caudal_estimado_lh != null && ` — ${f.caudal_estimado_lh} L/h`}
                {f.capacidad_estimada_l != null && ` — ${f.capacidad_estimada_l} L`}
                {f.zonaIndices.length > 0 &&
                  ` → ${f.zonaIndices.map((idx) => zonas[idx]?.nombre).join(", ")}`}
              </div>
            ))}
          </div>
        )}
      </div>
  );

  const paso4 = (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Revisar y guardar</h2>
        <table className="w-full text-sm border-collapse">
          <tbody>
            <tr className="border-b">
              <td className="py-2 font-medium text-gray-600 pr-4">Nombre</td>
              <td className="py-2">{nombrePredio}</td>
            </tr>
            {region && (
              <tr className="border-b">
                <td className="py-2 font-medium text-gray-600 pr-4">Región</td>
                <td className="py-2">{region}</td>
              </tr>
            )}
            {comuna && (
              <tr className="border-b">
                <td className="py-2 font-medium text-gray-600 pr-4">Comuna</td>
                <td className="py-2">{comuna}</td>
              </tr>
            )}
            <tr className="border-b">
              <td className="py-2 font-medium text-gray-600 pr-4">Polígono</td>
              <td className="py-2">
                {geometriaPredio
                  ? `${geometriaPredio.coordinates[0].length - 1} vértices`
                  : "No definido"}
              </td>
            </tr>
            <tr className="border-b">
              <td className="py-2 font-medium text-gray-600 pr-4">Zonas</td>
              <td className="py-2">
                {zonas.length === 0
                  ? "Ninguna"
                  : zonas.map((z) => `${z.nombre} (${CULTIVO_LABELS[z.cultivo]})`).join(", ")}
              </td>
            </tr>
            <tr>
              <td className="py-2 font-medium text-gray-600 pr-4">Fuentes</td>
              <td className="py-2">
                {fuentes.length === 0
                  ? "Ninguna"
                  : fuentes.map((f) => FUENTE_LABELS[f.tipo]).join(", ")}
              </td>
            </tr>
          </tbody>
        </table>
        <button
          type="button"
          onClick={handleGuardar}
          disabled={guardando}
          className="w-full bg-green-600 text-white py-3 rounded font-semibold hover:bg-green-700 disabled:opacity-50"
        >
          {guardando ? "Guardando..." : "Guardar predio"}
        </button>
      </div>
  );

  const pasosJSX = [paso0, paso1, paso2, paso3, paso4];

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <Stepper />
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded px-4 py-2 text-sm">
          {error}
        </div>
      )}
      {pasosJSX[paso]}
      <div className="flex justify-between mt-6">
        {paso > 0 ? (
          <button
            type="button"
            onClick={retroceder}
            className="text-sm text-gray-600 underline"
          >
            Volver
          </button>
        ) : (
          <div />
        )}
        {paso < PASOS.length - 1 && (
          <button
            type="button"
            onClick={avanzar}
            className="bg-blue-600 text-white text-sm px-5 py-2 rounded hover:bg-blue-700"
          >
            Siguiente
          </button>
        )}
      </div>
    </div>
  );
}
