import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ParcelProvider } from "@/context/ParcelContext";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <ParcelProvider>{children}</ParcelProvider>
      </body>
    </html>
  );
}
