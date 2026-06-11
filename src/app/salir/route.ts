// Cerrar sesión: borra la cookie y vuelve a /login.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_SESION } from "@/lib/sesion";

export async function GET() {
  (await cookies()).delete(COOKIE_SESION);
  redirect("/login");
}
