import { redirect } from "next/navigation";
import { obtenerSesionActual } from "@/lib/auth/server-helpers";

export default async function RootPage() {
  const sesion = await obtenerSesionActual();
  if (sesion) {
    redirect("/hoy");
  } else {
    redirect("/login");
  }
}
