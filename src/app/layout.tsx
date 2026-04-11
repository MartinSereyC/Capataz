import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ParcelProvider } from "@/context/ParcelContext";
import { SesionProvider } from "@/components/session-context";
import { obtenerSesionActual } from "@/lib/auth/server-helpers";
import DisclaimerBanner from "@/components/disclaimer-banner";
import RegisterSW from "@/components/pwa/register-sw";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Capataz — Ojos remotos para tu terreno",
  description:
    "Sube tu escritura digital y visualiza tu terreno con imágenes satelitales de los últimos 6 meses.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const sesion = await obtenerSesionActual();

  return (
    <html lang="es-CL" className={`${inter.variable} h-full antialiased`}>
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <SesionProvider value={sesion}>
          <ParcelProvider>{children}</ParcelProvider>
        </SesionProvider>
        <DisclaimerBanner />
        <RegisterSW />
      </body>
    </html>
  );
}
