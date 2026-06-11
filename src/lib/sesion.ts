// === Sesión del tablero ===
// La "llave" que se guarda en la cookie es una huella (SHA-256) de
// usuario + contraseña + un secreto del servidor. No se puede falsificar
// sin conocer los tres, y si cambiás la contraseña todas las sesiones
// viejas mueren solas. Usa Web Crypto: funciona en Node y en Edge (proxy).

export const COOKIE_SESION = "cos_sesion";

export async function tokenSesion(): Promise<string> {
  const base = [
    process.env.DASHBOARD_USER ?? "martin",
    process.env.DASHBOARD_PASSWORD ?? "",
    process.env.TELEGRAM_WEBHOOK_SECRET ?? "sin-secreto",
  ].join(":");

  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(base)
  );
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
