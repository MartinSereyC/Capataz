import { SatelliteLayerType } from "@/types";

export interface SatelliteLayerMeta {
  id: SatelliteLayerType;
  name: string;
  description: string;
  iconColor: string;
  mockColor: string;
  legend: { color: string; label: string }[];
  help: { title: string; body: string };
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
    help: {
      title: "Foto satelital",
      body: "Es la foto real del terreno, igual a lo que verías desde un avión. El satélite combina los colores rojo, verde y azul que capta del suelo para armar la imagen.",
    },
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
    help: {
      title: "Salud de la vegetación",
      body: "Detecta la clorofila de las plantas. Las hojas sanas reflejan mucha luz infrarroja y poca luz roja; el satélite compara las dos y pinta de verde oscuro lo más vigoroso, y de rojo lo más estresado.",
    },
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
    help: {
      title: "Humedad del cultivo",
      body: "Mide cuánta agua hay dentro de las hojas y la capa superior del suelo. Usa una luz infrarroja especial que el agua absorbe: mientras más café, más seco; mientras más azul, más húmedo.",
    },
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
    help: {
      title: "Detección de agua",
      body: "Encuentra cuerpos de agua como canales, lagunas y zonas de riego. El agua refleja el verde y absorbe el infrarrojo; el satélite resta uno del otro para marcar el agua en tonos azules.",
    },
  },
  {
    id: "radar",
    name: "Radar (todo clima)",
    description: "Funciona incluso con nubes o lluvia",
    iconColor: "#6366f1",
    mockColor: "#6366f1",
    legend: [
      { color: "#0a1033", label: "Agua" },
      { color: "#8c6b3f", label: "Suelo" },
      { color: "#2f8f3f", label: "Vegetación" },
    ],
    help: {
      title: "Radar (todo clima)",
      body: "Usa ondas de radar que atraviesan las nubes, por eso funciona incluso en días lluviosos. La vegetación densa se ve verde, el suelo desnudo café, y el agua casi negra porque rebota las ondas lejos del satélite.",
    },
  },
];

export function getLayerMeta(id: SatelliteLayerType): SatelliteLayerMeta {
  return SATELLITE_LAYERS.find((l) => l.id === id)!;
}
