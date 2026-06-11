import type { Tarea } from "@/db/schema";

// Paleta tomada del HTML original.
export const COLORS = {
  morado: "#5e55fe",
  verde: "#10b981",
  rojo: "#dc2626",
  amarillo: "#f59e0b",
  azul: "#3b82f6",
  gris: "#6b7280",
};

export function PrioridadChip({ prioridad }: { prioridad: Tarea["prioridad"] }) {
  const estilos: Record<string, string> = {
    ALTA: "bg-red-100 text-red-700",
    MEDIA: "bg-amber-100 text-amber-700",
    BAJA: "bg-gray-100 text-gray-600",
  };
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${estilos[prioridad]}`}
    >
      {prioridad}
    </span>
  );
}

export function EstadoChip({ estado }: { estado: Tarea["estado"] }) {
  const estilos: Record<string, string> = {
    NUEVA: "bg-gray-100 text-gray-600",
    EN_PROGRESO: "bg-blue-100 text-blue-700",
    BLOQUEADA: "bg-red-100 text-red-700",
    COMPLETADA: "bg-emerald-100 text-emerald-700",
  };
  const etiqueta: Record<string, string> = {
    NUEVA: "Nueva",
    EN_PROGRESO: "En progreso",
    BLOQUEADA: "Bloqueada",
    COMPLETADA: "Completada",
  };
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${estilos[estado]}`}
    >
      {etiqueta[estado]}
    </span>
  );
}

// Orden: prioridad (ALTA primero) y luego deadline más cercano.
export const RANGO_PRIORIDAD: Record<string, number> = {
  ALTA: 0,
  MEDIA: 1,
  BAJA: 2,
};

export function ordenarTareas(lista: Tarea[]): Tarea[] {
  return [...lista].sort((a, b) => {
    const p = RANGO_PRIORIDAD[a.prioridad] - RANGO_PRIORIDAD[b.prioridad];
    if (p !== 0) return p;
    // Sin deadline va al final.
    if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return 0;
  });
}

export function formatearFecha(fecha: string | null): string {
  if (!fecha) return "";
  // fecha viene como YYYY-MM-DD
  const [y, m, d] = fecha.split("-");
  return `${d}/${m}/${y}`;
}
