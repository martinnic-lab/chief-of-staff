"use server";

import { db } from "@/db";
import { tareas, TEAM } from "@/db/schema";
import { enviarTelegram, enviarMensajeLibre } from "@/lib/telegram";
import { eq, and, ne, lt } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type Prioridad = "ALTA" | "MEDIA" | "BAJA";
type Estado = "NUEVA" | "EN_PROGRESO" | "BLOQUEADA" | "COMPLETADA";
type Persona = (typeof TEAM)[number];

// --- Crear tarea (desde el formulario) ---
export async function crearTarea(formData: FormData) {
  const titulo = String(formData.get("titulo") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim();
  const asignado_a = String(formData.get("asignado_a") ?? "") as Persona;
  const prioridad = String(formData.get("prioridad") ?? "MEDIA") as Prioridad;
  const deadlineRaw = String(formData.get("deadline") ?? "").trim();
  const deadline = deadlineRaw === "" ? null : deadlineRaw;

  if (!titulo) throw new Error("El título es obligatorio.");
  if (!TEAM.includes(asignado_a))
    throw new Error("Debés elegir a quién asignar la tarea.");

  const [creada] = await db
    .insert(tareas)
    .values({
      titulo,
      descripcion: descripcion || null,
      asignado_a,
      prioridad,
      estado: "NUEVA",
      deadline,
    })
    .returning();

  // Notificar a Martín por Telegram (no rompemos el flujo si Telegram falla).
  await enviarTelegram("nueva_tarea", {
    titulo: creada.titulo,
    asignado_a: creada.asignado_a,
    prioridad: creada.prioridad,
    deadline: creada.deadline,
  });

  revalidatePath("/");
  redirect(`/tareas/${creada.id}`);
}

// --- Cambiar estado ---
export async function cambiarEstado(id: number, nuevoEstado: Estado) {
  const [actualizada] = await db
    .update(tareas)
    .set({ estado: nuevoEstado, actualizada_en: new Date() })
    .where(eq(tareas.id, id))
    .returning();

  if (actualizada) {
    await enviarTelegram("cambio_estado", {
      titulo: actualizada.titulo,
      asignado_a: actualizada.asignado_a,
      estado: actualizada.estado,
    });
  }

  revalidatePath("/");
  revalidatePath(`/tareas/${id}`);
}

// --- Agregar nota al historial ---
export async function agregarNota(id: number, nota: string) {
  const texto = nota.trim();
  if (!texto) return;

  const [tarea] = await db.select().from(tareas).where(eq(tareas.id, id));
  if (!tarea) return;

  const fecha = new Date().toLocaleString("es-CO");
  const nuevaNota = `[${fecha}] ${texto}`;
  const notas = tarea.notas ? `${tarea.notas}\n${nuevaNota}` : nuevaNota;

  await db.update(tareas).set({ notas }).where(eq(tareas.id, id));
  revalidatePath(`/tareas/${id}`);
}

// --- Probar Telegram (botón en /config) ---
export async function probarTelegram(): Promise<{ ok: boolean; error?: string }> {
  return enviarMensajeLibre(
    "✅ Prueba desde el Chief of Staff: Telegram está conectado correctamente."
  );
}

// --- Revisar tareas atrasadas (sin movimiento +6h) ---
// La usa tanto el botón manual como el detector automático en segundo plano.
export async function revisarAtrasos(): Promise<{ avisadas: number }> {
  const hace6h = new Date(Date.now() - 6 * 60 * 60 * 1000);

  const atrasadas = await db
    .select()
    .from(tareas)
    .where(
      and(ne(tareas.estado, "COMPLETADA"), lt(tareas.actualizada_en, hace6h))
    );

  for (const t of atrasadas) {
    await enviarTelegram("tarea_atrasada", {
      titulo: t.titulo,
      asignado_a: t.asignado_a,
    });
  }

  return { avisadas: atrasadas.length };
}
