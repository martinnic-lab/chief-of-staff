import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tareas } from "@/db/schema";
import { PrioridadChip, EstadoChip, formatearFecha } from "@/components/ui";
import DetalleAcciones from "./DetalleAcciones";

export const dynamic = "force-dynamic";

export default async function DetalleTareaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isInteger(idNum)) notFound();

  const [tarea] = await db.select().from(tareas).where(eq(tareas.id, idNum));
  if (!tarea) notFound();

  const notas = tarea.notas
    ? tarea.notas.split("\n").filter((l) => l.trim())
    : [];

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/"
        className="text-sm font-semibold text-gray-500 hover:text-gray-700"
      >
        ← Volver al tablero
      </Link>

      <div className="mt-2 rounded-2xl border border-[#eef0f7] bg-white p-6 shadow-[0_4px_12px_rgba(0,0,0,0.06)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-extrabold tracking-tight">
            {tarea.titulo}
          </h1>
          <div className="flex gap-1.5">
            <PrioridadChip prioridad={tarea.prioridad} />
            <EstadoChip estado={tarea.estado} />
          </div>
        </div>

        {tarea.descripcion && (
          <p className="mt-3 text-sm leading-relaxed text-gray-600">
            {tarea.descripcion}
          </p>
        )}

        <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-gray-100 pt-5 text-sm">
          <div>
            <dt className="text-[11px] font-extrabold uppercase tracking-wide text-gray-400">
              Asignada a
            </dt>
            <dd className="mt-0.5 font-semibold">{tarea.asignado_a}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-extrabold uppercase tracking-wide text-gray-400">
              Deadline
            </dt>
            <dd className="mt-0.5 font-semibold">
              {tarea.deadline ? formatearFecha(tarea.deadline) : "Sin deadline"}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-extrabold uppercase tracking-wide text-gray-400">
              Creada
            </dt>
            <dd className="mt-0.5 font-semibold">
              {new Date(tarea.creada_en).toLocaleString("es-CO")}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-extrabold uppercase tracking-wide text-gray-400">
              Último movimiento
            </dt>
            <dd className="mt-0.5 font-semibold">
              {new Date(tarea.actualizada_en).toLocaleString("es-CO")}
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-5 rounded-2xl border border-[#eef0f7] bg-white p-6 shadow-[0_4px_12px_rgba(0,0,0,0.06)]">
        <DetalleAcciones id={tarea.id} estadoActual={tarea.estado} />
      </div>

      <div className="mt-5 rounded-2xl border border-[#eef0f7] bg-white p-6 shadow-[0_4px_12px_rgba(0,0,0,0.06)]">
        <p className="mb-3 text-[11px] font-extrabold uppercase tracking-wide text-gray-500">
          Historial de notas
        </p>
        {notas.length === 0 ? (
          <p className="text-sm text-gray-400">Todavía no hay notas.</p>
        ) : (
          <ul className="space-y-2">
            {notas.map((n, i) => (
              <li
                key={i}
                className="rounded-lg border-l-[3px] border-[#e2e2ec] bg-[#fbfbfd] px-3 py-2 text-sm text-gray-600"
              >
                {n}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
