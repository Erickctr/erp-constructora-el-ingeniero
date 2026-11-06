import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Providers } from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "ERP Contable - Constructora El Ingeniero",
  description:
    "Sistema contable para Constructora El Ingeniero (SIC115 - Universidad de El Salvador, Grupo 04). NIIF para las PYMES, Código de Comercio y Código Tributario de El Salvador.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1B365D",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

