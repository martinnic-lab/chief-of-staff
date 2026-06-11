// === Detector de atrasos ===
//
// Regla: tarea no completada y sin movimiento hace más de 6 horas → aviso
// por Telegram. No se repite el aviso de la misma tarea antes de 24 h.
//
// El control de "ya avisé" vive en la base (tasks.delay_alerted_at) para
// funcionar igual en el portátil y en la nube (serverless, sin memoria).

import { sql } from "./neon";
import { enviarTelegram } from "../lib/telegram";

type TareaAtrasada = {
  id: string;
  titulo: string;
  asignado: string | null;
};

export async function revisarAtrasosPlanner(): Promise<{ avisadas: number }> {
  const filas = (await sql.query(
    `SELECT t.id,
            COALESCE(t.title_canonical, t.title_raw) AS titulo,
            pe.full_name AS asignado
     FROM tasks t
     LEFT JOIN people pe ON pe.id = t.assignee_id
     WHERE COALESCE(t.status, '') <> 'COMPLETADA'
       AND t.last_movement_at IS NOT NULL
       AND t.last_movement_at < now() - interval '6 hours'
       AND (t.delay_alerted_at IS NULL
            OR t.delay_alerted_at < now() - interval '24 hours')`
  )) as TareaAtrasada[];

  let enviadas = 0;
  for (const t of filas) {
    const r = await enviarTelegram("tarea_atrasada", {
      titulo: t.titulo,
      asignado_a: t.asignado ?? "(sin asignar)",
    });
    if (r.ok) {
      await sql.query(`UPDATE tasks SET delay_alerted_at = now() WHERE id = $1`, [
        t.id,
      ]);
      enviadas++;
    }
  }

  return { avisadas: enviadas };
}
