import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IMPI Lex — Agente de Propiedad Intelectual México",
  description: "Agente especializado en registro de marca, propiedad industrial e intelectual en México y marketing digital.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
