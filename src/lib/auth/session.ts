import { firmarToken, verificarToken } from "./tokens";
import type { SesionToken } from "./types";

const TREINTA_DIAS_MS = 30 * 24 * 60 * 60 * 1000;

export async function iniciarSesion(usuarioId: string): Promise<string> {
  return firmarToken({
    usuarioId,
    expiraEn: Date.now() + TREINTA_DIAS_MS,
  });
}

export async function leerSesion(
  cookieValue: string | undefined
): Promise<SesionToken | null> {
  if (!cookieValue) return null;
  return verificarToken(cookieValue);
}
