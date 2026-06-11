// Diagnóstico: muestra las tareas espejadas desde Planner y los flags abiertos.
// Correr: node --env-file=.env.local --import tsx src/sync/ver-tareas.ts
import { sql } from "./neon";

async function main() {
  const tareas = (await sql.query(
    `SELECT t.title_raw, t.priority, t.status,
            to_char(t.due_date, 'YYYY-MM-DD') AS due,
            to_char(t.last_movement_at, 'YYYY-MM-DD HH24:MI') AS movimiento,
            pe.full_name AS asignado
     FROM tasks t
     LEFT JOIN people pe ON pe.id = t.assignee_id
     WHERE t.planner_task_id IS NOT NULL
     ORDER BY t.created_at DESC LIMIT 10`
  )) as Record<string, string | null>[];

  console.log(`Tareas espejadas desde Planner (${tareas.length}):\n`);
  for (const t of tareas) {
    console.log(`  • "${t.title_raw}"`);
    console.log(`    prioridad ${t.priority} · estado ${t.status} · vence ${t.due ?? "—"}`);
    console.log(`    asignado: ${t.asignado ?? "(no cruzó con el equipo)"} · último movimiento ${t.movimiento}\n`);
  }

  const flags = (await sql.query(
    `SELECT f.flag_type, f.raw_value, f.suggested_match, t.title_raw
     FROM flags f JOIN tasks t ON t.id = f.task_id
     WHERE f.status = 'open' ORDER BY f.created_at DESC`
  )) as Record<string, string>[];

  console.log(`Flags abiertos (${flags.length}):\n`);
  for (const f of flags) {
    console.log(`  🚩 ${f.flag_type}: "${f.raw_value}" en tarea "${f.title_raw}"`);
    console.log(`     (id de Planner del usuario: ${f.suggested_match})\n`);
  }
}

main().then(() => process.exit(0));
