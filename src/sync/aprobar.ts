// === Aprobación de escrituras hacia Planner ===
//
// ÚNICO lugar del sistema que escribe en Planner, y solo con tu OK.
//
//   npm run aprobar                  → lista lo pendiente
//   npm run aprobar -- <id>          → aprueba y ejecuta UNA (id o comienzo del id)
//   npm run aprobar -- todas         → aprueba y ejecuta TODAS
//   npm run aprobar -- rechazar <id> → rechaza (no se escribe nada)
//
// Cada ejecución: trae el etag fresco de la tarea, hace el PATCH del título
// y deja constancia en sync_log con human_approved = true.

import { sql } from "./neon";
import { graphFetch } from "./graph";
import { enviarMensajeLibre } from "../lib/telegram";

type Pendiente = {
  id: string;
  task_id: string;
  planner_task_id: string;
  title_raw: string;
  new_title: string;
  created_at: string;
};

async function listarPendientes(): Promise<Pendiente[]> {
  return (await sql.query(
    `SELECT pw.id, pw.task_id, t.planner_task_id, t.title_raw,
            pw.payload->>'new_title' AS new_title,
            to_char(pw.created_at, 'YYYY-MM-DD HH24:MI') AS created_at
     FROM pending_writes pw
     JOIN tasks t ON t.id = pw.task_id
     WHERE pw.status = 'pending'
     ORDER BY pw.created_at`
  )) as Pendiente[];
}

function mostrar(pendientes: Pendiente[]): void {
  if (pendientes.length === 0) {
    console.log("\n✓ No hay escrituras pendientes de aprobación.\n");
    return;
  }
  console.log(`\n${pendientes.length} escritura(s) esperando tu aprobación:\n`);
  for (const p of pendientes) {
    console.log(`  id: ${p.id.slice(0, 8)}  (${p.created_at})`);
    console.log(`    ahora:    ${p.title_raw}`);
    console.log(`    quedaría: ${p.new_title}\n`);
  }
  console.log("Aprobar una:   npm run aprobar -- <id>");
  console.log("Aprobar todas: npm run aprobar -- todas");
  console.log("Rechazar:      npm run aprobar -- rechazar <id>\n");
}

async function ejecutar(p: Pendiente): Promise<boolean> {
  try {
    // 1) Etag fresco (Planner exige If-Match en cada PATCH).
    const tarea = await graphFetch<{ "@odata.etag": string; title: string }>(
      `/planner/tasks/${p.planner_task_id}`,
      { resumen: `Leer etag antes de renombrar "${p.title_raw}"` }
    );

    // 2) PATCH aprobado por humano.
    await graphFetch(`/planner/tasks/${p.planner_task_id}`, {
      method: "PATCH",
      etag: tarea["@odata.etag"],
      body: { title: p.new_title },
      humanApproved: true,
      resumen: `Título canonizado: "${tarea.title}" → "${p.new_title}"`,
    });

    // 3) Marcar ejecutada y reflejar el título nuevo en el espejo.
    await sql.query(
      `UPDATE pending_writes
       SET status = 'executed', decided_at = now(), executed_at = now()
       WHERE id = $1`,
      [p.id]
    );
    await sql.query(
      `UPDATE tasks SET title_raw = $2, title_canonical = $2, last_movement_at = now()
       WHERE id = $1`,
      [p.task_id, p.new_title]
    );

    console.log(`  ✓ ${p.id.slice(0, 8)} ejecutada: "${p.new_title}"`);
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await sql.query(
      `UPDATE pending_writes SET status = 'failed', decided_at = now(), error = $2
       WHERE id = $1`,
      [p.id, msg.slice(0, 500)]
    );
    console.error(`  ✗ ${p.id.slice(0, 8)} falló: ${msg}`);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--");
  const pendientes = await listarPendientes();

  // Sin argumentos → solo listar.
  if (args.length === 0) {
    mostrar(pendientes);
    return;
  }

  // Rechazar.
  if (args[0] === "rechazar") {
    const idArg = args[1];
    if (!idArg) {
      console.log("Falta el id: npm run aprobar -- rechazar <id>");
      return;
    }
    const objetivo = pendientes.find((p) => p.id.startsWith(idArg));
    if (!objetivo) {
      console.log(`No encontré una pendiente cuyo id empiece por "${idArg}".`);
      return;
    }
    await sql.query(
      `UPDATE pending_writes SET status = 'rejected', decided_at = now() WHERE id = $1`,
      [objetivo.id]
    );
    console.log(`✓ Rechazada: "${objetivo.new_title}" (no se tocó Planner).`);
    return;
  }

  // Aprobar todas o una.
  const aEjecutar =
    args[0] === "todas"
      ? pendientes
      : pendientes.filter((p) => p.id.startsWith(args[0]));

  if (aEjecutar.length === 0) {
    console.log(
      args[0] === "todas"
        ? "No hay pendientes para aprobar."
        : `No encontré una pendiente cuyo id empiece por "${args[0]}".`
    );
    return;
  }

  console.log(`\nEjecutando ${aEjecutar.length} escritura(s) aprobada(s)...\n`);
  let ok = 0;
  for (const p of aEjecutar) {
    if (await ejecutar(p)) ok++;
  }

  console.log(`\nListo: ${ok}/${aEjecutar.length} aplicadas en Planner.\n`);
  if (ok > 0) {
    await enviarMensajeLibre(
      `✅ Aprobaste ${ok} cambio(s) de título; ya quedaron aplicados en Planner.`
    );
  }
}

main().then(() => process.exit(0));
