"use client";

import { useEffect } from "react";

export default function RegisterSW() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("[SW] Registrado con scope:", registration.scope);
      })
      .catch((err) => {
        console.error("[SW] Error al registrar:", err);
      });

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      console.log("[SW] Nuevo controlador activo, recargando...");
      window.location.reload();
    });
  }, []);

  return null;
}
