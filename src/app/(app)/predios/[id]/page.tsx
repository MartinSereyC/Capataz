"use client";

/**
 * Predio detail page — lists zones with inline priority/fenology edit.
 * This is a client component so it can manage local edit state without
 * needing an extra client wrapper.
 */

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { actualizarZonaConfig } from "../nuevo/actions";
import type { Prioridad } from "@/lib/db/types";
import type { GeoJSONPolygon } from "@/types";

const PredioMap = dynamic(() => import("@/components/map/predio-map"), {
  ssr: false,
  loading: () => (
    <div className="h-[400px] rounded bg-gray-100 animate-pulse" />
  ),
});

interface ZonaResumen {
  id: string;
  nombre: string;
  cultivo: string;
  prioridad: Prioridad;
  fase_fenologica_override: string | null;
  geometria: GeoJSONPolygon | null;
}

interface PredioResumen {
  id: string;
  nombre: string;
  region: string | null;
  comuna: string | null;
  geometria: GeoJSONPolygon | null;
  zonas: ZonaResumen[];
}

const PRIORIDAD_OPTIONS: Prioridad[] = ["alta", "media", "baja"];
const PRIORIDAD_LABELS: Record<Prioridad, string> = {
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};

export default function PredioDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [predioId, setPredioId] = useState<string | null>(null);
  const [predio, setPredio] = useState<PredioResumen | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState<Record<string, boolean>>({});
  const [guardandoZona, setGuardandoZona] = useState<Record<string, boolean>>(
    {}
  );
  const [localZonas, setLocalZonas] = useState<ZonaResumen[]>([]);

  useEffect(() => {
    params.then((p) => setPredioId(p.id));
  }, [params]);

  useEffect(() => {
    if (!predioId) return;
    fetch(`/api/predios/${predioId}`)
      .then((r) => r.json())
      .then((data: PredioResumen) => {
        setPredio(data);
        setLocalZonas(data.zonas ?? []);
        setCargando(false);
      })
      .catch(() => {
        setError("No se pudo cargar el predio.");
        setCargando(false);
      });
  }, [predioId]);

  const zonasGeometrias = useMemo(
    () =>
      localZonas
        .map((z) => z.geometria)
        .filter((g): g is GeoJSONPolygon => g !== null),
    [localZonas]
  );
  const zonasNombres = useMemo(
    () =>
      localZonas
        .filter((z) => z.geometria !== null)
        .map((z) => z.nombre),
    [localZonas]
  );

  async function guardarZona(zonaId: string, cambios: Partial<ZonaResumen>) {
    setGuardandoZona((g) => ({ ...g, [zonaId]: true }));
    const result = await actualizarZonaConfig({
      zonaId,
      prioridad: cambios.prioridad,
      fase_fenologica_override: cambios.fase_fenologica_override,
    });
    setGuardandoZona((g) => ({ ...g, [zonaId]: false }));
    if (result.ok) {
      setLocalZonas((prev) =>
        prev.map((z) => (z.id === zonaId ? { ...z, ...cambios } : z))
      );
      setEditando((e) => ({ ...e, [zonaId]: false }));
    } else {
      setError(result.error ?? "Error al guardar");
    }
  }

  if (cargando) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 text-gray-500">
        Cargando...
      </div>
    );
  }

  if (error && !predio) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 text-red-600">{error}</div>
    );
  }

  if (!predio) return null;

  return (
    <div className="h-screen w-full px-4 py-4 flex flex-col gap-3 overflow-hidden">
      <div className="flex items-center gap-3">
        <Link href="/predios" className="text-sm text-blue-600 underline">
          Mis Predios
        </Link>
        <span className="text-gray-400">/</span>
        <h1 className="text-xl font-bold">{predio.nombre}</h1>
      </div>
      {(predio.region || predio.comuna) && (
        <p className="text-sm text-gray-500">
          {[predio.region, predio.comuna].filter(Boolean).join(", ")}
        </p>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded px-4 py-2 text-sm">
          {error}
        </div>
      )}
      <div className="flex flex-row gap-4 flex-1 min-h-0">
        <aside className="w-1/4 flex-shrink-0 overflow-y-auto space-y-4 pr-2">
          <Link
            href="/hoy"
            className="block text-center bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded"
          >
            Ver plan de riego de hoy
          </Link>
          <section>
            <h2 className="text-base font-semibold mb-3">Zonas</h2>
            {localZonas.length === 0 ? (
              <p className="text-sm text-gray-500">Sin zonas registradas.</p>
            ) : (
              <ul className="space-y-3">
                {localZonas.map((z) => (
                  <ZonaItem
                    key={z.id}
                    zona={z}
                    editando={!!editando[z.id]}
                    guardando={!!guardandoZona[z.id]}
                    onEditar={() =>
                      setEditando((e) => ({ ...e, [z.id]: true }))
                    }
                    onCancelar={() =>
                      setEditando((e) => ({ ...e, [z.id]: false }))
                    }
                    onGuardar={(cambios) => guardarZona(z.id, cambios)}
                  />
                ))}
              </ul>
            )}
          </section>
        </aside>
        {predio.geometria && (
          <section className="flex-1 h-full rounded overflow-hidden border border-gray-200">
            <PredioMap
              modo="view"
              geometriaInicial={predio.geometria}
              capasExtra={zonasGeometrias}
              capasExtraLabels={zonasNombres}
            />
          </section>
        )}
      </div>
    </div>
  );
}

function ZonaItem({
  zona,
  editando,
  guardando,
  onEditar,
  onCancelar,
  onGuardar,
}: {
  zona: ZonaResumen;
  editando: boolean;
  guardando: boolean;
  onEditar: () => void;
  onCancelar: () => void;
  onGuardar: (cambios: Partial<ZonaResumen>) => void;
}) {
  const [prioridad, setPrioridad] = useState<Prioridad>(zona.prioridad);
  const [fenologia, setFenologia] = useState<string>(
    zona.fase_fenologica_override ?? ""
  );

  return (
    <li className="border rounded px-4 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-sm">{zona.nombre}</p>
          <p className="text-xs text-gray-500">{zona.cultivo}</p>
        </div>
        {!editando && (
          <button
            type="button"
            onClick={onEditar}
            className="text-xs text-blue-600 underline"
          >
            Editar
          </button>
        )}
      </div>
      {!editando ? (
        <div className="text-sm text-gray-700 space-y-0.5">
          <p>
            Prioridad:{" "}
            <span className="font-medium">{PRIORIDAD_LABELS[zona.prioridad]}</span>
          </p>
          {zona.fase_fenologica_override && (
            <p>
              Fenología override:{" "}
              <span className="font-medium">{zona.fase_fenologica_override}</span>
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div>
            <label className="text-xs font-medium block mb-1">Prioridad</label>
            <select
              className="border rounded px-2 py-1 text-sm"
              value={prioridad}
              onChange={(e) => setPrioridad(e.target.value as Prioridad)}
            >
              {PRIORIDAD_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {PRIORIDAD_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">
              Override fenología (opcional)
            </label>
            <input
              type="text"
              className="border rounded px-2 py-1 text-sm w-full"
              value={fenologia}
              onChange={(e) => setFenologia(e.target.value)}
              placeholder="Ej: floracion"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={guardando}
              onClick={() =>
                onGuardar({
                  prioridad,
                  fase_fenologica_override: fenologia || null,
                })
              }
              className="bg-blue-600 text-white text-xs px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {guardando ? "Guardando..." : "Guardar"}
            </button>
            <button
              type="button"
              onClick={onCancelar}
              className="text-xs text-gray-500 underline"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
