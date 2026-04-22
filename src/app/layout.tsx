import type { Metadata } from "next";
import { Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { ParcelProvider } from "@/context/ParcelContext";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Capataz — Prioriza tus zonas de riego con información satelital",
  description:
    "Monitoreo satelital para agricultores de Chile. Detecta estrés hídrico en tus cuarteles con imágenes Sentinel-2.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${inter.variable} ${ibmPlexMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <ParcelProvider>{children}</ParcelProvider>
      </body>
    </html>
  );
}
