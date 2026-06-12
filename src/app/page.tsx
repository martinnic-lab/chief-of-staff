import Link from "next/link";
import { listarTareas, listarPersonas, type TareaVista } from "@/db/tareas";
import {
  PrioridadChip,
  EstadoChip,
  ordenarTareas,
  formatearFecha,
} from "@/components/ui";
import { revisarAtrasos } from "./actions";

// Siempre datos frescos (no cachear el tablero).
export const dynamic = "force-dynamic";

async function accionRevisarAtrasos() {
  "use server";
  await revisarAtrasos();
}

function Card({ t }: { t: TareaVista }) {
  return (
    <Link
      href={`/tareas/${t.id}`}
      className="block rounded-2xl border border-[#eef0f7] bg-white p-3.5 shadow-[0_4px_12px_rgba(0,0,0,0.06)] transition hover:shadow-[0_6px_18px_rgba(0,0,0,0.12)]"
    >
      <p className="mb-2 text-sm font-bold leading-snug">{t.titulo}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        <PrioridadChip prioridad={t.prioridad} />
        <EstadoChip estado={t.estado} />
      </div>
      {t.deadline && (
        <p className="mt-2 text-[11px] font-semibold text-gray-500">
          📅 {formatearFecha(t.deadline)}
        </p>
      )}
    </Link>
  );
}

function Columna({
  titulo,
  tareas,
}: {
  titulo: string;
  tareas: TareaVista[];
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-[#ececf3] bg-[#f9fafb] p-3">
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="text-[13px] font-extrabold uppercase tracking-wide text-gray-600">
          {titulo}
        </h2>
        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-gray-500">
          {tareas.length}
        </span>
      </div>
      <div className="flex flex-col gap-2.5">
        {tareas.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-gray-400">
            Sin tareas
          </p>
        ) : (
          tareas.map((t) => <Card key={t.id} t={t} />)
        )}
      </div>
    </div>
  );
}

export default async function Home() {
  const [todas, personas] = await Promise.all([
    listarTareas(),
    listarPersonas(),
  ]);
  const sinAsignar = ordenarTareas(todas.filter((t) => !t.asignado_id));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight">
          Tablero del equipo
        </h1>
        <div className="flex items-center gap-3">
          <form action={accionRevisarAtrasos}>
            <button
              type="submit"
              className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-700 transition hover:bg-amber-100"
              title="Revisa qué tareas llevan +6h sin movimiento y te avisa por Telegram"
            >
              ⚠️ Revisar atrasos
            </button>
          </form>
          <Link
            href="/tareas/nueva"
            className="rounded-xl bg-[#5e55fe] px-5 py-2.5 text-sm font-bold text-white shadow-[0_8px_20px_rgba(94,85,254,0.3)] transition hover:brightness-105"
          >
            + Nueva tarea
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {personas.map((p) => (
          <Columna
            key={p.id}
            titulo={p.nombre}
            tareas={ordenarTareas(todas.filter((t) => t.asignado_id === p.id))}
          />
        ))}
        {sinAsignar.length > 0 && (
          <Columna titulo="Sin asignar" tareas={sinAsignar} />
        )}
      </div>
    </div>
  );
}
