import { SatelliteLayerType } from "@/types";

export interface SatelliteLayerMeta {
  id: SatelliteLayerType;
  name: string;
  description: string;
  iconColor: string;
  mockColor: string;
  legend: { color: string; label: string }[];
}

export const SATELLITE_LAYERS: SatelliteLayerMeta[] = [
  {
    id: "true-color",
    name: "Foto satelital",
    description: "Imagen real del terreno",
    iconColor: "#22c55e",
    mockColor: "#22c55e",
    legend: [
      { color: "#4a7c59", label: "Vegetación" },
      { color: "#c4a35a", label: "Suelo" },
      { color: "#5b8bd4", label: "Agua" },
    ],
  },
  {
    id: "ndvi",
    name: "Salud de la vegetación",
    description: "5 zonas de acción según vigor del cultivo",
    iconColor: "#16a34a",
    mockColor: "#16a34a",
    legend: [
      { color: "#CC1A1A", label: "Crítico" },
      { color: "#E68C1A", label: "Estresado" },
      { color: "#F2D926", label: "Moderado" },
      { color: "#4DB326", label: "Sano" },
      { color: "#0D660D", label: "Muy sano" },
    ],
  },
  {
    id: "ndmi",
    name: "Humedad del cultivo",
    description: "5 zonas de acción según nivel de humedad",
    iconColor: "#2563eb",
    mockColor: "#2563eb",
    legend: [
      { color: "#A6400D", label: "Muy seco" },
      { color: "#E69926", label: "Seco" },
      { color: "#F2E64D", label: "Adecuado" },
      { color: "#338CCC", label: "Húmedo" },
      { color: "#1A2699", label: "Saturado" },
    ],
  },
  {
    id: "ndwi",
    name: "Detección de agua",
    description: "5 zonas según presencia de agua",
    iconColor: "#0ea5e9",
    mockColor: "#0ea5e9",
    legend: [
      { color: "#D9CCB3", label: "Tierra seca" },
      { color: "#B3CC99", label: "Suelo húmedo" },
      { color: "#80BFE6", label: "Agua baja" },
      { color: "#2673CC", label: "Agua moderada" },
      { color: "#0D268C", label: "Agua profunda" },
    ],
  },
];

export function getLayerMeta(id: SatelliteLayerType): SatelliteLayerMeta {
  return SATELLITE_LAYERS.find((l) => l.id === id)!;
}
