"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cambiarEstado, agregarNota } from "@/app/actions";

type Estado = "NUEVA" | "EN_PROGRESO" | "BLOQUEADA" | "COMPLETADA";

const ESTADOS: { valor: Estado; etiqueta: string; clase: string }[] = [
  { valor: "NUEVA", etiqueta: "Nueva", clase: "bg-gray-100 text-gray-700" },
  {
    valor: "EN_PROGRESO",
    etiqueta: "En progreso",
    clase: "bg-blue-100 text-blue-700",
  },
  {
    valor: "BLOQUEADA",
    etiqueta: "Bloqueada",
    clase: "bg-red-100 text-red-700",
  },
  {
    valor: "COMPLETADA",
    etiqueta: "Completada",
    clase: "bg-emerald-100 text-emerald-700",
  },
];

export default function DetalleAcciones({
  id,
  estadoActual,
}: {
  id: string;
  estadoActual: string;
}) {
  const [pendiente, startTransition] = useTransition();
  const [nota, setNota] = useState("");
  const router = useRouter();

  function moverA(estado: Estado) {
    if (estado === estadoActual) return;
    startTransition(async () => {
      await cambiarEstado(id, estado);
      router.refresh();
    });
  }

  function guardarNota() {
    if (!nota.trim()) return;
    startTransition(async () => {
      await agregarNota(id, nota);
      setNota("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-gray-500">
          Cambiar estado
        </p>
        <div className="flex flex-wrap gap-2">
          {ESTADOS.map((e) => {
            const activo = e.valor === estadoActual;
            return (
              <button
                key={e.valor}
                onClick={() => moverA(e.valor)}
                disabled={pendiente || activo}
                className={`rounded-xl px-4 py-2 text-sm font-bold transition disabled:opacity-100 ${
                  activo
                    ? `${e.clase} ring-2 ring-[#5e55fe] ring-offset-1`
                    : "border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {e.etiqueta}
                {activo && " ✓"}
              </button>
            );
          })}
        </div>
        {pendiente && (
          <p className="mt-2 text-xs text-gray-400">Guardando y notificando…</p>
        )}
      </div>

      <div>
        <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-gray-500">
          Agregar nota
        </p>
        <textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          rows={2}
          placeholder="Escribí un comentario…"
          className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#5e55fe] focus:ring-2 focus:ring-[#5e55fe]/20"
        />
        <button
          onClick={guardarNota}
          disabled={pendiente || !nota.trim()}
          className="mt-2 rounded-xl bg-[#1f2330] px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-60"
        >
          Guardar nota
        </button>
      </div>
    </div>
  );
}
