// === Portero del tablero (Next 16: "proxy", antes "middleware") ===
//
// Protege las pantallas con una sesión por cookie: quien no la tenga va a
// la pantalla /login. Quedan libres solo las rutas que entran solas:
//   - /login         (la propia puerta)
//   - /api/telegram  (la valida su propio secreto de Telegram)
//   - /api/cron/*    (las valida CRON_SECRET)
//
// Si DASHBOARD_PASSWORD no está configurada (desarrollo local), no bloquea.

import { NextRequest, NextResponse } from "next/server";
import { COOKIE_SESION, tokenSesion } from "@/lib/sesion";

export async function proxy(req: NextRequest) {
  if (!process.env.DASHBOARD_PASSWORD) return NextResponse.next();

  const cookie = req.cookies.get(COOKIE_SESION)?.value;
  if (cookie && cookie === (await tokenSesion())) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
  matcher: [
    "/((?!login|api/telegram|api/cron|_next/static|_next/image|favicon.ico).*)",
  ],
};
