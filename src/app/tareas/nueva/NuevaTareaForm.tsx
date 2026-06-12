"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { crearTarea } from "@/app/actions";

type Persona = { id: string; nombre: string };

function BotonCrear() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-xl bg-[#5e55fe] px-6 py-3 text-sm font-bold text-white shadow-[0_8px_20px_rgba(94,85,254,0.3)] transition hover:brightness-105 disabled:opacity-60"
    >
      {pending ? "Creando…" : "Crear y notificar"}
    </button>
  );
}

export default function NuevaTareaForm({ personas }: { personas: Persona[] }) {
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [asignado, setAsignado] = useState("");
  const [sugerencia, setSugerencia] = useState<{
    persona: string | null;
    razon: string;
  } | null>(null);
  const [cargandoSug, setCargandoSug] = useState(false);

  // Pide la sugerencia cuando cambian título/descripción (con un pequeño retraso).
  useEffect(() => {
    if (titulo.trim().length < 3) {
      setSugerencia(null);
      return;
    }
    setCargandoSug(true);
    const t = setTimeout(async () => {
      try {
        const resp = await fetch("/api/sugerir", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ titulo, descripcion }),
        });
        const data = await resp.json();
        setSugerencia({ persona: data.persona, razon: data.razon });
      } catch {
        setSugerencia(null);
      } finally {
        setCargandoSug(false);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [titulo, descripcion]);

  const labelCls = "block text-sm font-bold text-gray-700 mb-1.5";
  const inputCls =
    "w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#5e55fe] focus:ring-2 focus:ring-[#5e55fe]/20";

  return (
    <form action={crearTarea} className="space-y-5">
      <div>
        <label className={labelCls}>Título *</label>
        <input
          name="titulo"
          required
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Ej: Estructurar crédito para apertura de sala"
          className={inputCls}
        />
      </div>

      <div>
        <label className={labelCls}>Descripción</label>
        <textarea
          name="descripcion"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          rows={3}
          placeholder="Detalle de la tarea…"
          className={inputCls}
        />
      </div>

      {/* Bloque de sugerencia */}
      <div className="rounded-xl border border-[#e0eaff] bg-[#f5f7ff] p-4">
        <p className="text-[11px] font-extrabold uppercase tracking-wide text-[#5e55fe]">
          💡 Sugerencia de asignación
        </p>
        {cargandoSug ? (
          <p className="mt-1.5 text-sm text-gray-500">Analizando…</p>
        ) : sugerencia ? (
          <div className="mt-1.5">
            <p className="text-sm text-gray-700">{sugerencia.razon}</p>
            {sugerencia.persona && (
              <button
                type="button"
                onClick={() => {
                  const p = personas.find((x) => x.nombre === sugerencia.persona);
                  if (p) setAsignado(p.id);
                }}
                className="mt-2 rounded-lg bg-[#5e55fe] px-3 py-1.5 text-xs font-bold text-white hover:brightness-105"
              >
                Usar a {sugerencia.persona}
              </button>
            )}
          </div>
        ) : (
          <p className="mt-1.5 text-sm text-gray-500">
            Escribí el título y la descripción para recibir una sugerencia.
          </p>
        )}
      </div>

      <div>
        <label className={labelCls}>Asignar a *</label>
        <select
          name="asignado_id"
          required
          value={asignado}
          onChange={(e) => setAsignado(e.target.value)}
          className={inputCls}
        >
          <option value="" disabled>
            Elegí una persona…
          </option>
          {personas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Prioridad</label>
          <select name="prioridad" defaultValue="MEDIA" className={inputCls}>
            <option value="ALTA">ALTA</option>
            <option value="MEDIA">MEDIA</option>
            <option value="BAJA">BAJA</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Deadline (opcional)</label>
          <input type="date" name="deadline" className={inputCls} />
        </div>
      </div>

      <BotonCrear />
    </form>
  );
}
