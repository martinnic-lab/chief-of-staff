// === Sincronización de LECTURA: Planner → Neon ===
//
// Planner es la fuente de verdad del estado, asignado y fecha límite.
// Acá solo COPIAMOS hacia la tabla tasks (upsert por planner_task_id) y
// detectamos cambios para alimentar last_movement_at (detector de atrasos).
//
// Si el asignado no cruza con nadie en people → flag 'unknown_person'.
// El proyecto NO se resuelve aquí: queda project_id NULL y lo toma el
// flujo de normalización (paso siguiente del proyecto).

import { graphFetch, getPlanId } from "./graph";
import { sql } from "./neon";
import { enviarMensajeLibre } from "../lib/telegram";

type PlannerTask = {
  id: string;
  title: string;
  percentComplete: number; // 0 | 50 | 100
  priority: number; // 1 urgente · 3 importante · 5 media · 9 baja
  dueDateTime: string | null;
  createdDateTime: string;
  assignments: Record<string, unknown>; // claves = IDs de usuario de Azure AD
};

type FilaTask = {
  id: string;
  planner_task_id: string;
  title_raw: string;
  priority: string | null;
  status: string | null;
  due_date: string | null;
  assignee_id: string | null;
};

function mapearEstado(percent: number): string {
  if (percent >= 100) return "COMPLETADA";
  if (percent > 0) return "EN_PROGRESO";
  return "NUEVA";
}

function mapearPrioridad(p: number): string {
  if (p <= 3) return "ALTA"; // urgente (1) e importante (3)
  if (p <= 6) return "MEDIA"; // media (5)
  return "BAJA"; // baja (9)
}

// Cache por corrida: ID de Azure AD → nombre legible.
const nombresCache = new Map<string, string>();
async function nombreDeUsuario(userId: string): Promise<string> {
  const enCache = nombresCache.get(userId);
  if (enCache) return enCache;
  try {
    const u = await graphFetch<{ displayName?: string }>(
      `/users/${userId}?$select=displayName`,
      { resumen: `Resolver nombre de usuario ${userId.slice(0, 8)}…` }
    );
    const nombre = u.displayName ?? userId;
    nombresCache.set(userId, nombre);
    return nombre;
  } catch {
    return userId; // sin permiso o usuario borrado → dejamos el ID
  }
}

export async function sincronizarPlanner(): Promise<{
  leidas: number;
  nuevas: number;
  actualizadas: number;
  flagsNuevos: number;
}> {
  const planId = getPlanId();

  // 1) Leer todas las tareas del plan.
  const respuesta = await graphFetch<{ value: PlannerTask[] }>(
    `/planner/plans/${planId}/tasks`,
    { resumen: "Lectura periódica de tareas del plan" }
  );
  const tareasPlanner = respuesta.value;

  // 2) Cargar gente y espejo actual de tasks.
  const gente = (await sql.query(
    `SELECT id, full_name, planner_user_id FROM people WHERE status = 'active'`
  )) as { id: string; full_name: string; planner_user_id: string | null }[];
  const personaPorPlannerId = new Map(
    gente.filter((p) => p.planner_user_id).map((p) => [p.planner_user_id as string, p])
  );

  const existentes = (await sql.query(
    `SELECT id, planner_task_id, title_raw, priority, status,
            to_char(due_date, 'YYYY-MM-DD') AS due_date, assignee_id
     FROM tasks WHERE planner_task_id IS NOT NULL`
  )) as FilaTask[];
  const espejo = new Map(existentes.map((t) => [t.planner_task_id, t]));

  let nuevas = 0;
  let actualizadas = 0;
  let flagsNuevos = 0;

  for (const pt of tareasPlanner) {
    const estado = mapearEstado(pt.percentComplete);
    const prioridad = mapearPrioridad(pt.priority);
    const due = pt.dueDateTime ? pt.dueDateTime.slice(0, 10) : null;

    // Asignado: Planner permite varios; tomamos el primero.
    const idsAsignados = Object.keys(pt.assignments ?? {});
    const plannerUserId = idsAsignados[0] ?? null;
    const persona = plannerUserId ? personaPorPlannerId.get(plannerUserId) : undefined;
    const assigneeId = persona?.id ?? null;

    const fila = espejo.get(pt.id);

    let taskId: string;
    if (!fila) {
      // — Tarea nueva en Planner —
      const insertada = (await sql.query(
        `INSERT INTO tasks
           (planner_task_id, title_raw, priority, status, due_date,
            assignee_id, last_movement_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (planner_task_id) DO NOTHING
         RETURNING id`,
        [pt.id, pt.title, prioridad, estado, due, assigneeId, pt.createdDateTime]
      )) as { id: string }[];
      if (insertada.length === 0) continue; // carrera improbable: ya estaba
      taskId = insertada[0].id;
      nuevas++;
    } else {
      taskId = fila.id;
      const cambio =
        fila.title_raw !== pt.title ||
        fila.priority !== prioridad ||
        fila.status !== estado ||
        fila.due_date !== due ||
        fila.assignee_id !== assigneeId;

      if (cambio) {
        await sql.query(
          `UPDATE tasks
           SET title_raw = $2, priority = $3, status = $4, due_date = $5,
               assignee_id = $6, last_movement_at = now()
           WHERE id = $1`,
          [taskId, pt.title, prioridad, estado, due, assigneeId]
        );
        actualizadas++;
      }
    }

    // — Asignado que no reconocemos → flag 'unknown_person' (sin duplicar) —
    if (plannerUserId && !persona) {
      const nombre = await nombreDeUsuario(plannerUserId);
      const creado = (await sql.query(
        `INSERT INTO flags (task_id, flag_type, raw_value, suggested_match)
         SELECT $1, 'unknown_person', $2, $3
         WHERE NOT EXISTS (
           SELECT 1 FROM flags
           WHERE task_id = $1 AND flag_type = 'unknown_person'
             AND raw_value = $2 AND status = 'open'
         )
         RETURNING id`,
        [taskId, nombre, plannerUserId]
      )) as { id: string }[];

      if (creado.length > 0) {
        flagsNuevos++;
        await enviarMensajeLibre(
          `🚩 Persona desconocida en Planner: "${nombre}" asignada a la tarea "${pt.title}". ` +
            `Agregala a la tabla people (con su planner_user_id) o resolvé el flag.`
        );
      }
    }
  }

  return { leidas: tareasPlanner.length, nuevas, actualizadas, flagsNuevos };
}
