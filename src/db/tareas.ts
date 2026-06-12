// === Consultas del tablero web sobre la tabla unificada `tasks` ===
// (la misma que usa el bot de Telegram — una sola fuente de verdad)

import { sql } from "@/sync/neon";

export type TareaVista = {
  id: string;
  titulo: string;
  descripcion: string | null;
  prioridad: string;
  estado: string;
  deadline: string | null; // YYYY-MM-DD
  asignado: string | null; // nombre completo
  asignado_id: string | null;
  creada: string;
  movimiento: string | null;
  notas: string | null;
};

const CAMPOS = `
  t.id,
  COALESCE(t.title_canonical, t.title_raw) AS titulo,
  t.descripcion,
  COALESCE(t.priority, 'MEDIA') AS prioridad,
  COALESCE(t.status, 'NUEVA') AS estado,
  to_char(t.due_date, 'YYYY-MM-DD') AS deadline,
  pe.full_name AS asignado,
  t.assignee_id AS asignado_id,
  t.created_at::text AS creada,
  t.last_movement_at::text AS movimiento,
  t.notas
`;

export async function listarTareas(): Promise<TareaVista[]> {
  return (await sql.query(
    `SELECT ${CAMPOS}
     FROM tasks t LEFT JOIN people pe ON pe.id = t.assignee_id
     ORDER BY t.created_at DESC`
  )) as TareaVista[];
}

export async function obtenerTarea(id: string): Promise<TareaVista | null> {
  const filas = (await sql.query(
    `SELECT ${CAMPOS}
     FROM tasks t LEFT JOIN people pe ON pe.id = t.assignee_id
     WHERE t.id = $1`,
    [id]
  )) as TareaVista[];
  return filas[0] ?? null;
}

export type PersonaActiva = { id: string; nombre: string };

export async function listarPersonas(): Promise<PersonaActiva[]> {
  return (await sql.query(
    `SELECT id, full_name AS nombre FROM people
     WHERE status = 'active' ORDER BY full_name`
  )) as PersonaActiva[];
}

export function esUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
