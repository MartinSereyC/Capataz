"use client";

import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [estado, setEstado] = useState<"idle" | "enviado" | "error">("idle");
  const [canal, setCanal] = useState<"email" | "stub" | null>(null);
  const [cargando, setCargando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    try {
      const res = await fetch("/api/auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.ok) {
        setCanal(data.canal);
        setEstado("enviado");
      } else {
        setEstado("error");
      }
    } catch {
      setEstado("error");
    } finally {
      setCargando(false);
    }
  }

  if (estado === "enviado") {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <div className="max-w-sm w-full space-y-4 text-center">
          <h1 className="text-2xl font-bold">Revisa tu email</h1>
          {canal === "stub" ? (
            <p className="text-gray-600">
              Pide al administrador que te envíe el enlace por WhatsApp.
            </p>
          ) : (
            <p className="text-gray-600">
              Te enviamos un enlace mágico a <strong>{email}</strong>. Expira en 15 minutos.
            </p>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="max-w-sm w-full space-y-6">
        <h1 className="text-2xl font-bold text-center">Ingresar a Capataz</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              Ingresa tu email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder="tu@correo.cl"
            />
          </div>
          {estado === "error" && (
            <p className="text-red-600 text-sm">Ocurrió un error. Intenta nuevamente.</p>
          )}
          <button
            type="submit"
            disabled={cargando}
            className="w-full bg-green-700 text-white rounded px-4 py-2 font-medium disabled:opacity-50"
          >
            {cargando ? "Enviando..." : "Enviar enlace mágico"}
          </button>
        </form>
      </div>
    </main>
  );
}
