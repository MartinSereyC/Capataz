import { NextRequest, NextResponse } from "next/server";
import { exportarPredioJSON } from "@/lib/predios/export";
import { obtenerPredio } from "@/lib/predios/repo";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Try session-based auth (module built in parallel)
  let sesionUsuarioId: string | null = null;
  try {
    const { leerSesion } = await import("@/lib/auth/session");
    const cookie = req.cookies.get("sesion")?.value;
    const sesion = await leerSesion(cookie);
    if (sesion) sesionUsuarioId = sesion.usuarioId;
  } catch {
    // auth module not yet available — fall through to admin token check
  }

  // Admin token fallback for testing without auth
  const adminToken = req.nextUrl.searchParams.get("admin_token");
  const envToken = process.env.ADMIN_EXPORT_TOKEN;
  const isAdminToken = envToken && adminToken === envToken;

  if (!sesionUsuarioId && !isAdminToken) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // If authenticated via session, verify ownership
  if (sesionUsuarioId && !isAdminToken) {
    const predio = await obtenerPredio(id);
    if (!predio || predio.usuario_id !== sesionUsuarioId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  const data = await exportarPredioJSON(id);

  return NextResponse.json(data, {
    status: 200,
    headers: {
      "Content-Disposition": `attachment; filename="capataz-predio-${id}.json"`,
    },
  });
}
