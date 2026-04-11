import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { leerSesion } from "./session";
import type { SesionToken } from "./types";

const NOMBRE_COOKIE = "capataz_sesion";

export async function obtenerSesionActual(): Promise<SesionToken | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(NOMBRE_COOKIE);
  return leerSesion(cookie?.value);
}

export async function requerirSesion(): Promise<SesionToken> {
  const sesion = await obtenerSesionActual();
  if (!sesion) {
    redirect("/login");
  }
  return sesion;
}
