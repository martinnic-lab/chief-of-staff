"use server";

// Acciones del tablero web — operan sobre la tabla unificada `tasks`
// (la misma que usa el bot de Telegram).

import { sql } from "@/sync/neon";
import { enviarTelegram, enviarMensajeLibre } from "@/lib/telegram";
import { revisarAtrasosPlanner } from "@/sync/atrasos";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type Prioridad = "ALTA" | "MEDIA" | "BAJA";
type Estado = "NUEVA" | "EN_PROGRESO" | "BLOQUEADA" | "COMPLETADA";

// --- Crear tarea (desde el formulario) ---
export async function crearTarea(formData: FormData) {
  const titulo = String(formData.get("titulo") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim();
  const asignadoId = String(formData.get("asignado_id") ?? "").trim();
  const prioridad = String(formData.get("prioridad") ?? "MEDIA") as Prioridad;
  const deadlineRaw = String(formData.get("deadline") ?? "").trim();
  const deadline = deadlineRaw === "" ? null : deadlineRaw;

  if (!titulo) throw new Error("El título es obligatorio.");
  if (!asignadoId) throw new Error("Debés elegir a quién asignar la tarea.");

  const persona = (await sql.query(
    `SELECT id, full_name FROM people WHERE id = $1 AND status = 'active'`,
    [asignadoId]
  )) as { id: string; full_name: string }[];
  if (persona.length === 0) throw new Error("Esa persona no está en el equipo.");

  const [creada] = (await sql.query(
    `INSERT INTO tasks
       (title_raw, descripcion, priority, status, due_date, assignee_id, last_movement_at)
     VALUES ($1, $2, $3, 'NUEVA', $4, $5, now())
     RETURNING id`,
    [titulo, descripcion || null, prioridad, deadline, asignadoId]
  )) as { id: string }[];

  // Notificar a Martín por Telegram (no rompemos el flujo si Telegram falla).
  await enviarTelegram("nueva_tarea", {
    titulo,
    asignado_a: persona[0].full_name,
    prioridad,
    deadline,
  });

  revalidatePath("/");
  redirect(`/tareas/${creada.id}`);
}

// --- Cambiar estado ---
export async function cambiarEstado(id: string, nuevoEstado: Estado) {
  const filas = (await sql.query(
    `UPDATE tasks SET status = $2, last_movement_at = now()
     WHERE id = $1
     RETURNING COALESCE(title_canonical, title_raw) AS titulo,
               (SELECT full_name FROM people WHERE people.id = tasks.assignee_id) AS asignado`,
    [id, nuevoEstado]
  )) as { titulo: string; asignado: string | null }[];

  if (filas.length > 0) {
    await enviarTelegram("cambio_estado", {
      titulo: filas[0].titulo,
      asignado_a: filas[0].asignado ?? "(sin asignar)",
      estado: nuevoEstado,
    });
  }

  revalidatePath("/");
  revalidatePath(`/tareas/${id}`);
}

// --- Agregar nota al historial ---
export async function agregarNota(id: string, nota: string) {
  const texto = nota.trim();
  if (!texto) return;

  const fecha = new Date().toLocaleString("es-CO");
  await sql.query(
    `UPDATE tasks
     SET notas = COALESCE(notas || E'\n', '') || $2
     WHERE id = $1`,
    [id, `[${fecha}] ${texto}`]
  );
  revalidatePath(`/tareas/${id}`);
}

// --- Probar Telegram (botón en /config) ---
export async function probarTelegram(): Promise<{ ok: boolean; error?: string }> {
  return enviarMensajeLibre(
    "✅ Prueba desde el Chief of Staff: Telegram está conectado correctamente."
  );
}

// --- Revisar tareas atrasadas (sin movimiento +6h) ---
// La usa el botón manual del tablero y el detector local en segundo plano.
// En la nube lo hace el cron de Vercel con la misma función.
export async function revisarAtrasos(): Promise<{ avisadas: number }> {
  return revisarAtrasosPlanner();
}
