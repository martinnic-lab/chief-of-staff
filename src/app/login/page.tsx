// Pantalla de inicio de sesión del tablero (reemplaza el pop-up del navegador).

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_SESION, tokenSesion } from "@/lib/sesion";

export const dynamic = "force-dynamic";

async function entrar(formData: FormData) {
  "use server";

  const usuario = String(formData.get("usuario") ?? "").trim();
  const clave = String(formData.get("clave") ?? "");

  const usuarioOk = usuario === (process.env.DASHBOARD_USER ?? "martin");
  const claveOk =
    Boolean(process.env.DASHBOARD_PASSWORD) &&
    clave === process.env.DASHBOARD_PASSWORD;

  if (usuarioOk && claveOk) {
    (await cookies()).set(COOKIE_SESION, await tokenSesion(), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 días
      path: "/",
    });
    redirect("/");
  }

  redirect("/login?error=1");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-sm rounded-2xl border border-[#eef0f7] bg-white p-8 shadow-[0_4px_12px_rgba(0,0,0,0.06)]">
        <div className="mb-6 text-center">
          <div className="text-3xl">🤖</div>
          <h1 className="mt-2 text-xl font-extrabold tracking-tight">
            Chief of Staff
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Tablero privado de Nivel — iniciá sesión para continuar.
          </p>
        </div>

        {error && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">
            Usuario o contraseña incorrectos.
          </p>
        )}

        <form action={entrar} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-gray-500">
              Usuario
            </label>
            <input
              name="usuario"
              autoComplete="username"
              required
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#5e55fe]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-gray-500">
              Contraseña
            </label>
            <input
              name="clave"
              type="password"
              autoComplete="current-password"
              required
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#5e55fe]"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-[#5e55fe] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#4c43e8]"
          >
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}
