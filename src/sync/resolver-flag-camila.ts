// Resolución puntual del primer flag: conectar el ID de Planner de Camila
// y marcar el flag como resuelto.
import { sql } from "./neon";

async function main() {
  await sql.query(
    `UPDATE people SET planner_user_id = $1 WHERE lower(full_name) = lower($2)`,
    ["9dc90d6e-a3a0-4d89-9465-6ea84aed1937", "Camila Arbeláez"]
  );

  await sql.query(
    `UPDATE flags
     SET status = 'resolved', resolved_at = now(),
         resolution_note = 'planner_user_id conectado a Camila Arbeláez en people'
     WHERE flag_type = 'unknown_person'
       AND raw_value = 'Camila Arbeláez NIVEL' AND status = 'open'`
  );

  console.log("✓ Camila conectada (planner_user_id guardado).");
  console.log("✓ Flag resuelto.");
  console.log("→ El próximo ciclo del sync re-cruza sus tareas solo.");
}

main().then(() => process.exit(0));
