"use client";

import { createContext, useContext } from "react";
import type { SesionToken } from "@/lib/auth/types";

const SesionContext = createContext<SesionToken | null>(null);

export function SesionProvider({
  value,
  children,
}: {
  value: SesionToken | null;
  children: React.ReactNode;
}) {
  return (
    <SesionContext.Provider value={value}>{children}</SesionContext.Provider>
  );
}

export function useSesion(): SesionToken | null {
  return useContext(SesionContext);
}
