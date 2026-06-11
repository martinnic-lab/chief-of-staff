// === Portero del tablero (Next 16: "proxy", antes "middleware") ===
//
// Protege TODAS las pantallas con usuario y contraseña (Basic Auth del
// navegador). Quedan libres solo las rutas que necesitan entrar solas:
//   - /api/telegram  (la valida su propio secreto de Telegram)
//   - /api/cron/*    (las valida CRON_SECRET)
//
// Si DASHBOARD_PASSWORD no está configurada (desarrollo local), no bloquea.

import { NextRequest, NextResponse } from "next/server";

export function proxy(req: NextRequest) {
  const pass = process.env.DASHBOARD_PASSWORD;
  if (!pass) return NextResponse.next();

  const user = process.env.DASHBOARD_USER ?? "martin";
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    try {
      const [u, p] = atob(auth.slice(6)).split(":");
      if (u === user && p === pass) return NextResponse.next();
    } catch {
      // header malformado → cae al 401
    }
  }

  return new NextResponse("Acceso restringido — Chief of Staff", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Chief of Staff Nivel"' },
  });
}

export const config = {
  matcher: [
    "/((?!api/telegram|api/cron|_next/static|_next/image|favicon.ico).*)",
  ],
};
