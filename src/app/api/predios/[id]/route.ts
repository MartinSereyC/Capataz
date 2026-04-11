import { NextRequest, NextResponse } from "next/server";
import { obtenerPredio, listarZonasPorPredio } from "@/lib/predios/repo";
import { leerSesion } from "@/lib/auth/session";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const cookie = req.cookies.get("capataz_sesion")?.value;
  const sesion = await leerSesion(cookie);
  if (!sesion) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const predio = await obtenerPredio(id);
  if (!predio || predio.usuario_id !== sesion.usuarioId) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const zonas = await listarZonasPorPredio(id);

  const parseGeom = (raw: string | null) => {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  return NextResponse.json({
    id: predio.id,
    nombre: predio.nombre,
    region: predio.region,
    comuna: predio.comuna,
    geometria: parseGeom(predio.geometria),
    zonas: zonas.map((z) => ({
      id: z.id,
      nombre: z.nombre,
      cultivo: z.cultivo,
      prioridad: z.prioridad,
      fase_fenologica_override: z.fase_fenologica_override,
      geometria: parseGeom(z.geometria),
    })),
  });
}
