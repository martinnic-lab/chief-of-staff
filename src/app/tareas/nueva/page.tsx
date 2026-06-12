import Link from "next/link";
import { listarPersonas } from "@/db/tareas";
import NuevaTareaForm from "./NuevaTareaForm";

export const dynamic = "force-dynamic";

export default async function NuevaTareaPage() {
  const personas = await listarPersonas();

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/"
        className="text-sm font-semibold text-gray-500 hover:text-gray-700"
      >
        ← Volver al tablero
      </Link>
      <h1 className="mb-6 mt-2 text-2xl font-extrabold tracking-tight">
        Nueva tarea
      </h1>
      <div className="rounded-2xl border border-[#eef0f7] bg-white p-6 shadow-[0_4px_12px_rgba(0,0,0,0.06)]">
        <NuevaTareaForm personas={personas} />
      </div>
    </div>
  );
}
