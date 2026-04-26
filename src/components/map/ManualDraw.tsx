"use client";

import { useEffect, useCallback, useState, useRef, useMemo } from "react";
import { useMap, Polygon, CircleMarker, Marker, Tooltip } from "react-leaflet";
import L from "leaflet";
import type { Parcel, GeoJSONPolygon, BboxGeoJSON } from "@/types";
import { es } from "@/lib/i18n/es";

export interface ManualDrawApi {
  undo: () => void;
  clear: () => void;
  finish: () => void;
  toggleEdit: () => void;
  setEdit: (v: boolean) => void;
}

interface ManualDrawProps {
  onConfirm: (parcel: Parcel) => void;
  onCancel: () => void;
  /** When true, suppresses the floating instruction banner and action buttons.
   *  The host page is expected to provide its own UI. */
  hideControls?: boolean;
  /** Fires with an imperative API for the host page to drive undo/clear/finish/edit. */
  onApiReady?: (api: ManualDrawApi) => void;
  /** Fires whenever the number of placed vertices changes. */
  onPointsChange?: (count: number) => void;
  /** Fires whenever edit mode is toggled. */
  onEditChange?: (editing: boolean) => void;
}

/**
 * Rough area in hectares from a closed GeoJSON polygon ring (Shoelace on
 * lat/lng degrees, scaled for Chile ~35°S).
 */
function calcAreaHectares(points: [number, number][]): number {
  if (points.length < 4) return 0;
  const LAT_TO_M = 111_320;
  const LNG_TO_M = 111_320 * Math.cos((35 * Math.PI) / 180);
  let area = 0;
  const n = points.length - 1;
  for (let i = 0; i < n; i++) {
    const [lng1, lat1] = points[i];
    const [lng2, lat2] = points[(i + 1) % n];
    area += lng1 * LNG_TO_M * lat2 * LAT_TO_M;
    area -= lng2 * LNG_TO_M * lat1 * LAT_TO_M;
  }
  return Math.abs(area) / 2 / 10_000;
}

function buildParcelFromPoints(points: [number, number][]): Parcel {
  const closed: [number, number][] = [...points, points[0]];
  const lngs = points.map(([lng]) => lng);
  const lats = points.map(([, lat]) => lat);
  const bbox: BboxGeoJSON = [
    Math.min(...lngs),
    Math.min(...lats),
    Math.max(...lngs),
    Math.max(...lats),
  ];
  const polygon: GeoJSONPolygon = { type: "Polygon", coordinates: [closed] };
  return {
    coordinates: points,
    polygon,
    bbox,
    area_hectares: calcAreaHectares(closed),
    coordinate_format_detected: "LATLONG_DECIMAL",
    raw_coordinates: "Dibujado manualmente",
  };
}

// Draggable vertex icon — only built in the browser (L is not defined on SSR)
const vertexEditIcon =
  typeof window !== "undefined"
    ? L.divIcon({
        className: "",
        html: '<div style="width:14px;height:14px;border-radius:50%;background:#fff;border:2px solid #16a34a;box-shadow:0 1px 3px rgba(0,0,0,0.3);cursor:grab;"></div>',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      })
    : undefined;

/**
 * ManualDraw — lets the user click map points to define a parcel boundary.
 * In edit mode, each vertex becomes a draggable marker.
 * Exposes an imperative API via `onApiReady` so host pages can drive it from
 * their own toolbar.
 */
export function ManualDraw({
  onConfirm,
  onCancel,
  hideControls = false,
  onApiReady,
  onPointsChange,
  onEditChange,
}: ManualDrawProps) {
  const map = useMap();
  const [points, setPoints] = useState<[number, number][]>([]);
  const [editing, setEditing] = useState(false);
  const controlRef = useRef<HTMLDivElement>(null);

  const pointsRef = useRef<[number, number][]>(points);
  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

  const editingRef = useRef(editing);
  useEffect(() => {
    editingRef.current = editing;
  }, [editing]);

  // Click-vs-dblclick disambiguation: defer adding the point ~220ms so a
  // following dblclick can cancel it. Otherwise every dblclick injects two
  // extra stray vertices before closing the polygon.
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canConfirm = points.length >= 3;

  useEffect(() => {
    onPointsChange?.(points.length);
  }, [points.length, onPointsChange]);

  useEffect(() => {
    onEditChange?.(editing);
  }, [editing, onEditChange]);

  useEffect(() => {
    const el = controlRef.current;
    if (el) L.DomEvent.disableClickPropagation(el);
  }, []);

  const handleMapClick = useCallback((e: L.LeafletMouseEvent) => {
    if (editingRef.current) return;
    const { lat, lng } = e.latlng;
    if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
    clickTimeoutRef.current = setTimeout(() => {
      setPoints((prev) => [...prev, [lng, lat]]);
      clickTimeoutRef.current = null;
    }, 220);
  }, []);

  const handleMapDblClick = useCallback(() => {
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }
    if (editingRef.current) return;
    const current = pointsRef.current;
    if (current.length < 3) return;
    onConfirm(buildParcelFromPoints(current));
  }, [onConfirm]);

  useEffect(() => {
    map.on("click", handleMapClick);
    map.on("dblclick", handleMapDblClick);
    map.getContainer().style.cursor = editing ? "" : "crosshair";
    return () => {
      map.off("click", handleMapClick);
      map.off("dblclick", handleMapDblClick);
      map.getContainer().style.cursor = "";
    };
  }, [map, handleMapClick, handleMapDblClick, editing]);

  const handleReset = useCallback(() => {
    setPoints([]);
    setEditing(false);
  }, []);

  const handleConfirm = useCallback(() => {
    if (pointsRef.current.length < 3) return;
    onConfirm(buildParcelFromPoints(pointsRef.current));
  }, [onConfirm]);

  const api = useMemo<ManualDrawApi>(
    () => ({
      undo: () =>
        setPoints((prev) => (prev.length === 0 ? prev : prev.slice(0, -1))),
      clear: () => {
        setPoints([]);
        setEditing(false);
      },
      finish: () => {
        const cur = pointsRef.current;
        if (cur.length < 3) return;
        onConfirm(buildParcelFromPoints(cur));
      },
      toggleEdit: () => {
        if (pointsRef.current.length < 3) return;
        setEditing((e) => !e);
      },
      setEdit: (v) => {
        if (v && pointsRef.current.length < 3) return;
        setEditing(v);
      },
    }),
    [onConfirm],
  );

  useEffect(() => {
    onApiReady?.(api);
  }, [api, onApiReady]);

  const previewPositions = points.map(([lng, lat]) => [lat, lng] as [number, number]);

  return (
    <>
      {points.length >= 2 && (
        <Polygon
          positions={previewPositions}
          pathOptions={{
            color: "#16a34a",
            weight: 2,
            dashArray: editing ? undefined : "6 4",
            fillColor: "#22c55e",
            fillOpacity: 0.15,
          }}
        />
      )}

      {!editing &&
        points.map(([lng, lat], i) => (
          <CircleMarker
            key={`v-${i}-${lng}-${lat}`}
            center={[lat, lng]}
            radius={5}
            pathOptions={{
              color: "#16a34a",
              fillColor: "#22c55e",
              fillOpacity: 0.9,
              weight: 2,
            }}
          >
            <Tooltip permanent direction="top">{`${i + 1}`}</Tooltip>
          </CircleMarker>
        ))}

      {editing &&
        vertexEditIcon &&
        points.map(([lng, lat], i) => (
          <Marker
            key={`e-${i}`}
            position={[lat, lng]}
            draggable
            icon={vertexEditIcon}
            eventHandlers={{
              dragend: (e) => {
                const ll = (e.target as L.Marker).getLatLng();
                setPoints((prev) => {
                  const next = [...prev];
                  next[i] = [ll.lng, ll.lat];
                  return next;
                });
              },
            }}
          />
        ))}

      {!hideControls && (
        <div
          ref={controlRef}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] flex flex-col items-center gap-3 pointer-events-none"
          style={{ pointerEvents: "none" }}
        >
          <div className="bg-white/95 backdrop-blur-sm rounded-xl px-4 py-2 shadow-lg text-sm text-gray-700 text-center max-w-xs pointer-events-auto">
            {es.map.drawInstructions}
            {points.length > 0 && (
              <span className="ml-2 font-semibold text-green-700">
                ({points.length} punto{points.length !== 1 ? "s" : ""})
              </span>
            )}
          </div>
          <div className="flex gap-2 pointer-events-auto">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!canConfirm}
              className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg shadow hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {es.map.confirmDraw}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 bg-white text-gray-700 text-sm font-semibold rounded-lg shadow border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              {es.map.resetDraw}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 bg-white text-gray-700 text-sm font-semibold rounded-lg shadow border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              {es.map.cancelDraw}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
