import Link from "next/link";
import { requerirSesion } from "@/lib/auth/server-helpers";
import { listarPrediosPorUsuario } from "@/lib/predios/repo";

export const metadata = { title: "Mis Predios — Capataz" };

export default async function PrediosPage() {
  const sesion = await requerirSesion();
  const predios = await listarPrediosPorUsuario(sesion.usuarioId);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Mis Predios</h1>
        <Link
          href="/predios/nuevo"
          className="bg-blue-600 text-white text-sm px-4 py-2 rounded hover:bg-blue-700"
        >
          Agregar predio
        </Link>
      </div>
      {predios.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="mb-4">No tienes predios registrados.</p>
          <Link href="/predios/nuevo" className="text-blue-600 underline text-sm">
            Crear tu primer predio
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {predios.map((p) => (
            <li key={p.id}>
              <Link
                href={`/predios/${p.id}`}
                className="block border rounded px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <p className="font-medium">{p.nombre}</p>
                {(p.region || p.comuna) && (
                  <p className="text-sm text-gray-500 mt-0.5">
                    {[p.region, p.comuna].filter(Boolean).join(", ")}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
