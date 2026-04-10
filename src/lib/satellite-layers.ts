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
    description: "Verde = sana, rojo = estresada",
    iconColor: "#16a34a",
    mockColor: "#16a34a",
    legend: [
      { color: "#dc2626", label: "Estresada" },
      { color: "#eab308", label: "Moderada" },
      { color: "#16a34a", label: "Sana" },
    ],
  },
  {
    id: "ndmi",
    name: "Humedad del suelo",
    description: "Azul = húmedo, café = seco",
    iconColor: "#2563eb",
    mockColor: "#2563eb",
    legend: [
      { color: "#92400e", label: "Seco" },
      { color: "#eab308", label: "Moderado" },
      { color: "#2563eb", label: "Húmedo" },
    ],
  },
  {
    id: "ndwi",
    name: "Detección de agua",
    description: "Azul = agua, blanco = tierra seca",
    iconColor: "#0ea5e9",
    mockColor: "#0ea5e9",
    legend: [
      { color: "#f5f5f5", label: "Tierra seca" },
      { color: "#7dd3fc", label: "Humedad" },
      { color: "#0369a1", label: "Agua" },
    ],
  },
];

export function getLayerMeta(id: SatelliteLayerType): SatelliteLayerMeta {
  return SATELLITE_LAYERS.find((l) => l.id === id)!;
}
