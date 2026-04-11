import { requerirSesion } from "@/lib/auth/server-helpers";
import NuevoPredioWizard from "./wizard";

export const metadata = { title: "Nuevo Predio — Capataz" };

export default async function NuevoPredioPage() {
  await requerirSesion();
  return <NuevoPredioWizard />;
}
