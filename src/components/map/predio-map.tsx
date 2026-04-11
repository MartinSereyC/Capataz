"use client";

/**
 * PredioMap — thin wrapper over react-leaflet + Geoman.
 * Must be dynamically imported with { ssr: false } at the call site.
 *
 * Modes:
 *   view        — read-only, no edit controls
 *   edit        — Geoman drag/reshape on the predio polygon
 *   draw-zona   — Geoman polygon draw to create sub-zones
 */

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import type { Map as LeafletMap, Layer } from "leaflet";
import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import type { GeoJSONPolygon } from "@/types";
import {
  BASEMAP_TILES,
  BASEMAP_LABELS_URL,
  BASEMAP_TRANSPORT_URL,
  type BasemapType,
} from "@/lib/constants";
import { BasemapToggle } from "./BasemapToggle";
import {
  zonaDentroDePredio,
  sinTraslapesEntreZonas,
} from "@/lib/onboarding/validador";

// Leaflet icon fix for webpack/Next.js
import L from "leaflet";
// @ts-expect-error _getIconUrl missing from types
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export type MapMode = "view" | "edit" | "draw-zona" | "draw-predio";

interface PredioMapProps {
  geometriaInicial?: GeoJSONPolygon | null;
  modo: MapMode;
  onCambio?: (geom: GeoJSONPolygon) => void;
  /** Extra layers (zone polygons) to display in draw-zona mode */
  capasExtra?: GeoJSONPolygon[];
  /** Optional labels matched by index to capasExtra, shown as permanent tooltips */
  capasExtraLabels?: string[];
  /** Optional map center [lat, lng] used when no geometry exists */
  centro?: [number, number] | null;
  /** Zoom level for centro fallback */
  centroZoom?: number;
  /** Called when a draw attempt is rejected (e.g. zone outside predio) */
  onDrawError?: (mensaje: string) => void;
}

// Chile center
const CHILE_CENTER: [number, number] = [-33.5, -70.7];
const CHILE_ZOOM = 9;

function GeomanController({
  geometriaInicial,
  modo,
  onCambio,
  capasExtra,
  capasExtraLabels,
  onDrawError,
}: PredioMapProps) {
  const map = useMap() as LeafletMap & {
    pm: {
      addControls: (opts: object) => void;
      removeControls: () => void;
      setGlobalOptions: (opts: object) => void;
      enableDraw: (shape: string) => void;
    };
  };

  useEffect(() => {
    if (!map) return;

    const createdLayers: Layer[] = [];
    let cancelled = false;

    let predioLayer: L.GeoJSON | null = null;
    if (geometriaInicial) {
      predioLayer = L.geoJSON(geometriaInicial as GeoJSON.GeoJsonObject, {
        style: { color: "#2563eb", weight: 2, fillOpacity: 0.15 },
      }).addTo(map);
      createdLayers.push(predioLayer);
      try {
        map.fitBounds(predioLayer.getBounds(), { padding: [20, 20] });
      } catch {
        // Ignore if bounds are invalid
      }
    }

    if (modo === "draw-zona" && geometriaInicial) {
      const predioRing = geometriaInicial.coordinates[0];
      const worldRing: [number, number][] = [
        [-85, -180],
        [-85, 180],
        [85, 180],
        [85, -180],
        [-85, -180],
      ];
      const holeRing: [number, number][] = predioRing.map(
        ([lng, lat]) => [lat, lng] as [number, number]
      );
      const dimLayer = L.polygon([worldRing, holeRing], {
        color: "#000",
        weight: 0,
        fillColor: "#000",
        fillOpacity: 0.4,
        interactive: false,
      }).addTo(map);
      createdLayers.push(dimLayer);
    }

    if (capasExtra && capasExtra.length > 0) {
      capasExtra.forEach((z, idx) => {
        const layer = L.geoJSON(z as GeoJSON.GeoJsonObject, {
          style: { color: "#16a34a", weight: 1.5, fillOpacity: 0.2 },
        }).addTo(map);
        createdLayers.push(layer);

        const label = capasExtraLabels?.[idx]
          ? `${idx + 1}. ${capasExtraLabels[idx]}`
          : `Zona ${idx + 1}`;

        try {
          const center = layer.getBounds().getCenter();
          const marker = L.marker(center, {
            interactive: false,
            icon: L.divIcon({
              className: "zona-label",
              html: `<div style="background:rgba(255,255,255,0.9);border:1px solid #16a34a;border-radius:4px;padding:2px 6px;font-size:11px;font-weight:600;color:#166534;white-space:nowrap;box-shadow:0 1px 2px rgba(0,0,0,0.15);">${label}</div>`,
              iconSize: [0, 0],
              iconAnchor: [0, 0],
            }),
          }).addTo(map);
          createdLayers.push(marker);
        } catch {
          layer.bindTooltip(label, { permanent: true, direction: "center" });
        }
      });
    }

    if (modo === "view") {
      return () => {
        createdLayers.forEach((l) => {
          try {
            map.removeLayer(l);
          } catch {
            // noop
          }
        });
      };
    }

    const onEdit = (e: { layer: { toGeoJSON: () => GeoJSON.Feature } }) => {
      const geojson = e.layer.toGeoJSON();
      if (geojson.geometry?.type === "Polygon" && onCambio) {
        onCambio(geojson.geometry as GeoJSONPolygon);
      }
    };

    const onCreate = (e: {
      layer: Layer & { toGeoJSON: () => GeoJSON.Feature };
    }) => {
      const geojson = e.layer.toGeoJSON();
      if (geojson.geometry?.type !== "Polygon") return;
      const geom = geojson.geometry as GeoJSONPolygon;
      if (
        modo === "draw-zona" &&
        geometriaInicial &&
        !zonaDentroDePredio(geom, geometriaInicial)
      ) {
        map.removeLayer(e.layer);
        onDrawError?.(
          "La zona debe estar dentro del predio. Dibújala nuevamente sobre el área iluminada."
        );
        return;
      }
      if (
        modo === "draw-zona" &&
        capasExtra &&
        capasExtra.length > 0 &&
        !sinTraslapesEntreZonas([...capasExtra, geom])
      ) {
        map.removeLayer(e.layer);
        onDrawError?.(
          "La zona no puede traslaparse con otra zona. Los bordes pueden tocarse, pero no superponerse."
        );
        return;
      }
      onCambio?.(geom);
    };

    const setupGeoman = () => {
      if (cancelled) return;

      try {
        map.pm.removeControls();
      } catch {
        // no controls yet — fine
      }

      if (modo === "edit") {
        map.pm.addControls({
          position: "topleft",
          drawPolygon: false,
          drawMarker: false,
          drawPolyline: false,
          drawCircle: false,
          drawCircleMarker: false,
          drawRectangle: false,
          drawText: false,
          editMode: true,
          dragMode: true,
          cutPolygon: false,
          removalMode: false,
          rotateMode: false,
        });
      }

      if (modo === "draw-predio") {
        map.pm.addControls({
          position: "topleft",
          drawPolygon: true,
          drawMarker: false,
          drawPolyline: false,
          drawCircle: false,
          drawCircleMarker: false,
          drawRectangle: false,
          drawText: false,
          editMode: true,
          dragMode: true,
          cutPolygon: false,
          removalMode: true,
          rotateMode: false,
        });
      }

      if (modo === "draw-zona") {
        map.pm.addControls({
          position: "topleft",
          drawPolygon: true,
          drawMarker: false,
          drawPolyline: false,
          drawCircle: false,
          drawCircleMarker: false,
          drawRectangle: false,
          drawText: false,
          editMode: false,
          dragMode: false,
          cutPolygon: false,
          removalMode: true,
          rotateMode: false,
        });
      }

      map.on("pm:edit", onEdit);
      map.on("pm:create", onCreate);
    };

    setupGeoman();

    return () => {
      cancelled = true;
      map.off("pm:edit", onEdit);
      map.off("pm:create", onCreate);
      try {
        map.pm?.removeControls();
      } catch {
        // noop
      }
      createdLayers.forEach((l) => {
        try {
          map.removeLayer(l);
        } catch {
          // noop
        }
      });
    };
  }, [
    map,
    modo,
    geometriaInicial,
    capasExtra,
    capasExtraLabels,
    onCambio,
    onDrawError,
  ]);

  return null;
}

export default function PredioMap(props: PredioMapProps) {
  const initialCenter = props.centro ?? CHILE_CENTER;
  const initialZoom = props.centro ? (props.centroZoom ?? 13) : CHILE_ZOOM;
  const [basemap, setBasemap] = useState<BasemapType>("hybrid");
  const base = BASEMAP_TILES[basemap];
  return (
    <MapContainer
      center={initialCenter}
      zoom={initialZoom}
      className="w-full h-full"
      style={{ minHeight: "400px" }}
    >
      <TileLayer
        key={basemap}
        url={base.url}
        attribution={base.attribution}
        maxZoom={base.maxZoom ?? 19}
      />
      {basemap === "hybrid" && (
        <>
          <TileLayer
            key="hybrid-transport"
            url={BASEMAP_TRANSPORT_URL}
            attribution=""
          />
          <TileLayer
            key="hybrid-labels"
            url={BASEMAP_LABELS_URL}
            attribution=""
          />
        </>
      )}
      <BasemapToggle basemap={basemap} onChange={setBasemap} />
      <GeomanController {...props} />
    </MapContainer>
  );
}
