import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chief of Staff · Nivel",
  description: "Tablero personal de gestión del equipo",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-[#fcfcfe] text-[#1f2330] antialiased">
        <header className="bg-gradient-to-br from-[#5e55fe] to-[#7d75ff] text-white">
          <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-4">
            <Link href="/" className="text-lg font-extrabold tracking-tight">
              🤖 Chief of Staff
            </Link>
            <nav className="flex items-center gap-4 text-sm font-semibold">
              <Link href="/" className="opacity-90 hover:opacity-100">
                Tablero
              </Link>
              <Link href="/config" className="opacity-90 hover:opacity-100">
                Configuración
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-[1400px] px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
