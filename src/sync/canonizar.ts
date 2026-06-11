// === Canonización de títulos (Neon → Planner, CON aprobación) ===
//
// Única escritura permitida por ahora: cuando una tarea ya tiene proyecto
// resuelto, su título en Planner debe quedar "[Proyecto Canónico] Título".
// El humano nunca escribe el prefijo; esta capa lo impone.
//
// IMPORTANTE: aquí NO se escribe nada en Planner. Solo se encola en
// pending_writes. La escritura real ocurre en aprobar.ts, tras el OK de
// Martín.

import { sql } from "./neon";
import { enviarMensajeLibre } from "../lib/telegram";

type TareaConProyecto = {
  task_id: string;
  planner_task_id: string;
  title_raw: string;
  canonical_name: string;
  project_id: string;
};

const ACENTOS: Record<string, string> = {
  á: "a", é: "e", í: "i", ó: "o", ú: "u", ü: "u", ñ: "n",
};
function normalizar(t: string): string {
  return t.toLowerCase().replace(/[áéíóúüñ]/g, (c) => ACENTOS[c] ?? c);
}

// Quita del comienzo del título el "prefijo sucio" que haya puesto el humano:
//  1) cualquier "[...]" inicial, y/o
//  2) el nombre del proyecto o uno de sus alias, con separadores sueltos.
export function limpiarTitulo(
  titulo: string,
  nombresProyecto: string[]
): string {
  let resto = titulo.trim();

  // 1) Prefijo entre corchetes.
  resto = resto.replace(/^\[[^\]]*\]\s*/, "");

  // 2) El nombre/alias del proyecto escrito a mano al inicio.
  const restoNorm = normalizar(resto);
  for (const nombre of [...nombresProyecto].sort((a, b) => b.length - a.length)) {
    const n = normalizar(nombre.trim());
    if (n.length > 0 && restoNorm.startsWith(n)) {
      resto = resto.slice(nombre.trim().length);
      break;
    }
  }

  // Separadores que quedaron colgando (- : · , espacios).
  resto = resto.replace(/^[\s\-–—:·,]+/, "").trim();
  return resto;
}

export async function encolarCanonizaciones(): Promise<{
  encoladas: number;
}> {
  // Tareas con proyecto resuelto, vivas en Planner y aún no completadas.
  const tareas = (await sql.query(
    `SELECT t.id AS task_id, t.planner_task_id, t.title_raw,
            p.canonical_name, p.id AS project_id
     FROM tasks t
     JOIN projects p ON p.id = t.project_id
     WHERE t.planner_task_id IS NOT NULL
       AND COALESCE(t.status, '') <> 'COMPLETADA'`
  )) as TareaConProyecto[];

  let encoladas = 0;

  for (const t of tareas) {
    const prefijo = `[${t.canonical_name}] `;

    // ¿Ya está canónico? Entonces solo aseguramos title_canonical y seguimos.
    if (t.title_raw.startsWith(prefijo)) {
      await sql.query(
        `UPDATE tasks SET title_canonical = $2 WHERE id = $1 AND title_canonical IS DISTINCT FROM $2`,
        [t.task_id, t.title_raw]
      );
      continue;
    }

    // Alias del proyecto, para limpiar el prefijo manual que sea.
    const aliases = (await sql.query(
      `SELECT alias FROM project_aliases WHERE project_id = $1`,
      [t.project_id]
    )) as { alias: string }[];

    const base = limpiarTitulo(t.title_raw, [
      t.canonical_name,
      ...aliases.map((a) => a.alias),
    ]);
    const nuevoTitulo = `${prefijo}${base.length > 0 ? base : t.title_raw.trim()}`;

    // Encolar (sin duplicar una pendiente igual para la misma tarea).
    const creada = (await sql.query(
      `INSERT INTO pending_writes (task_id, write_type, payload)
       SELECT $1, 'title_canonicalization', $2::jsonb
       WHERE NOT EXISTS (
         SELECT 1 FROM pending_writes
         WHERE task_id = $1 AND write_type = 'title_canonicalization'
           AND status = 'pending' AND payload->>'new_title' = $3
       )
       RETURNING id`,
      [t.task_id, JSON.stringify({ new_title: nuevoTitulo }), nuevoTitulo]
    )) as { id: string }[];

    if (creada.length > 0) {
      // Guardamos ya nuestra vista canónica (Planner se toca solo tras aprobar).
      await sql.query(
        `UPDATE tasks SET title_canonical = $2 WHERE id = $1`,
        [t.task_id, nuevoTitulo]
      );
      encoladas++;
    }
  }

  if (encoladas > 0) {
    await enviarMensajeLibre(
      `🖊 ${encoladas} título(s) de Planner esperando tu aprobación. ` +
        `Revisalos con: npm run aprobar`
    );
  }

  return { encoladas };
}
