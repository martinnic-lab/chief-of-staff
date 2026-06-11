// === Detector de atrasos (versión Planner) ===
//
// Misma regla de siempre: tarea no completada y sin movimiento hace más de
// 6 horas → aviso por Telegram. La diferencia: ahora last_movement_at lo
// alimenta la sincronización con Planner, no el tablero local.
//
// Para no repetir el mismo aviso en cada ciclo de 5 minutos, se recuerda
// (en memoria) cuándo se avisó cada tarea y no se repite antes de 24 h.
// Si el servicio se reinicia, puede avisar de nuevo una vez: aceptable.

import { sql } from "./neon";
import { enviarTelegram } from "../lib/telegram";

const SEIS_HORAS_SQL = "interval '6 hours'";
const REPETIR_CADA_MS = 24 * 60 * 60 * 1000;

const avisadas = new Map<string, number>(); // task_id → epoch ms del último aviso

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
       AND t.planner_task_id IS NOT NULL
       AND t.last_movement_at IS NOT NULL
       AND t.last_movement_at < now() - ${SEIS_HORAS_SQL}`
  )) as TareaAtrasada[];

  const ahora = Date.now();
  let enviadas = 0;

  for (const t of filas) {
    const ultimo = avisadas.get(t.id);
    if (ultimo && ahora - ultimo < REPETIR_CADA_MS) continue;

    const r = await enviarTelegram("tarea_atrasada", {
      titulo: t.titulo,
      asignado_a: t.asignado ?? "(sin asignar)",
    });
    if (r.ok) {
      avisadas.set(t.id, ahora);
      enviadas++;
    }
  }

  return { avisadas: enviadas };
}
