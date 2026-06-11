// === Cerebro de comandos del bot (sin IA todavía — comandos simples) ===
//
// Privacidad: Martín (TELEGRAM_CHAT_ID) ve y maneja TODO. Cada miembro del
// equipo (people.telegram_chat_id) solo ve y maneja SUS tareas.
//
// Comandos entendidos (en español, tolerantes a mayúsculas/acentos):
//   ayuda                                  → lista de comandos
//   tareas [nombre]                        → pendientes (de todos, o de alguien)
//   nueva <título> para <nombre> [alta|media|baja] [vence AAAA-MM-DD]
//   completar <parte del título>
//   progreso <parte del título>
//   bloqueada <parte del título>

import { sql } from "../sync/neon";

export type Quien = {
  esMartin: boolean;
  personaId: string | null; // id en people (si es del equipo)
  nombre: string;
};

const ACENTOS: Record<string, string> = {
  á: "a", é: "e", í: "i", ó: "o", ú: "u", ü: "u", ñ: "n",
};
function normalizar(t: string): string {
  return t.toLowerCase().replace(/[áéíóúüñ]/g, (c) => ACENTOS[c] ?? c).trim();
}

type FilaTarea = {
  id: string;
  titulo: string;
  prioridad: string | null;
  estado: string | null;
  due: string | null;
  asignado: string | null;
};

const AYUDA = [
  "Esto es lo que entiendo:",
  "",
  "• tareas — tus pendientes (o todos, si sos Martín)",
  "• tareas camila — pendientes de una persona (solo Martín)",
  "• nueva Pagar predial para camila alta vence 2026-06-20",
  "  (la persona, la prioridad y la fecha son opcionales)",
  "• completar predial — marca como completada",
  "• progreso predial — la pone en progreso",
  "• bloqueada predial — la marca bloqueada",
  "• ayuda — este mensaje",
].join("\n");

async function buscarPersona(fragmento: string): Promise<
  { id: string; full_name: string } | null
> {
  const filas = (await sql.query(
    `SELECT id, full_name FROM people
     WHERE status = 'active' AND lower(full_name) LIKE '%' || $1 || '%'`,
    [normalizar(fragmento)]
  )) as { id: string; full_name: string }[];
  return filas.length === 1 ? filas[0] : null;
}

function lineaTarea(t: FilaTarea, conPersona: boolean): string {
  const partes = [`[${t.prioridad ?? "?"}] ${t.titulo}`];
  if (t.estado && t.estado !== "NUEVA") partes.push(`(${t.estado.toLowerCase().replace("_", " ")})`);
  if (t.due) partes.push(`vence ${t.due}`);
  if (conPersona) partes.push(`— ${t.asignado ?? "sin asignar"}`);
  return "• " + partes.join(" ");
}

async function listar(quien: Quien, filtro: string): Promise<string> {
  let condicion = "";
  const params: string[] = [];

  if (!quien.esMartin) {
    // Miembro del equipo: SOLO sus tareas, sin importar qué pida.
    condicion = "AND t.assignee_id = $1";
    params.push(quien.personaId!);
  } else if (filtro) {
    const p = await buscarPersona(filtro);
    if (!p) return `No identifiqué a "${filtro}" en el equipo.`;
    condicion = "AND t.assignee_id = $1";
    params.push(p.id);
  }

  const filas = (await sql.query(
    `SELECT t.id, COALESCE(t.title_canonical, t.title_raw) AS titulo,
            t.priority AS prioridad, t.status AS estado,
            to_char(t.due_date, 'YYYY-MM-DD') AS due, pe.full_name AS asignado
     FROM tasks t LEFT JOIN people pe ON pe.id = t.assignee_id
     WHERE COALESCE(t.status, '') <> 'COMPLETADA' ${condicion}
     ORDER BY CASE t.priority WHEN 'ALTA' THEN 0 WHEN 'MEDIA' THEN 1 ELSE 2 END,
              t.due_date NULLS LAST`,
    params
  )) as FilaTarea[];

  if (filas.length === 0) return "🎉 Sin pendientes.";
  const titulo = quien.esMartin
    ? filtro
      ? `Pendientes de ${filas[0].asignado ?? filtro}:`
      : "Pendientes del equipo:"
    : "Tus pendientes:";
  return [titulo, ...filas.map((f) => lineaTarea(f, quien.esMartin && !filtro))].join("\n");
}

async function crear(quien: Quien, resto: string): Promise<string> {
  let texto = resto.trim();
  if (!texto) return "Decime el título: nueva <título> para <persona>";

  // Fecha: "vence AAAA-MM-DD"
  let due: string | null = null;
  const mVence = texto.match(/\bvence\s+(\d{4}-\d{2}-\d{2})\b/i);
  if (mVence) {
    due = mVence[1];
    texto = texto.replace(mVence[0], "").trim();
  }

  // Prioridad al final o tras la persona.
  let prioridad = "MEDIA";
  const mPrio = texto.match(/\b(alta|media|baja)\b\s*$/i);
  if (mPrio) {
    prioridad = mPrio[1].toUpperCase();
    texto = texto.slice(0, mPrio.index).trim();
  }

  // Persona: "... para <nombre>" (la última aparición de " para ").
  let assigneeId: string | null = null;
  let nombreAsignado = "sin asignar";
  const idx = normalizar(texto).lastIndexOf(" para ");
  if (idx >= 0) {
    const candidato = texto.slice(idx + 6).trim();
    const p = await buscarPersona(candidato);
    if (p) {
      assigneeId = p.id;
      nombreAsignado = p.full_name;
      texto = texto.slice(0, idx).trim();
    }
  }
  // Miembro del equipo sin "para ...": la tarea es para sí mismo.
  if (!assigneeId && !quien.esMartin) {
    assigneeId = quien.personaId;
    nombreAsignado = quien.nombre;
  }

  if (!texto) return "Me faltó el título de la tarea.";

  await sql.query(
    `INSERT INTO tasks (title_raw, priority, status, due_date, assignee_id, last_movement_at)
     VALUES ($1, $2, 'NUEVA', $3, $4, now())`,
    [texto, prioridad, due, assigneeId]
  );

  return `📋 Creada: "${texto}" → ${nombreAsignado} · ${prioridad}${due ? ` · vence ${due}` : ""}`;
}

async function cambiarEstado(
  quien: Quien,
  fragmento: string,
  nuevoEstado: "COMPLETADA" | "EN_PROGRESO" | "BLOQUEADA"
): Promise<{ respuesta: string; aviso?: string }> {
  if (!fragmento.trim()) return { respuesta: "Decime parte del título de la tarea." };

  const params: string[] = [normalizar(fragmento.trim())];
  let condicion = "";
  if (!quien.esMartin) {
    condicion = "AND t.assignee_id = $2";
    params.push(quien.personaId!);
  }

  const filas = (await sql.query(
    `SELECT t.id, COALESCE(t.title_canonical, t.title_raw) AS titulo,
            pe.full_name AS asignado
     FROM tasks t LEFT JOIN people pe ON pe.id = t.assignee_id
     WHERE COALESCE(t.status, '') <> 'COMPLETADA'
       AND lower(COALESCE(t.title_canonical, t.title_raw)) LIKE '%' || $1 || '%'
       ${condicion}`,
    params
  )) as { id: string; titulo: string; asignado: string | null }[];

  if (filas.length === 0)
    return { respuesta: `No encontré una tarea pendiente que diga "${fragmento.trim()}".` };
  if (filas.length > 1)
    return {
      respuesta:
        `Hay ${filas.length} que coinciden — sé más específico:\n` +
        filas.map((f) => `• ${f.titulo}`).join("\n"),
    };

  const t = filas[0];
  await sql.query(
    `UPDATE tasks SET status = $2, last_movement_at = now() WHERE id = $1`,
    [t.id, nuevoEstado]
  );

  const emoji =
    nuevoEstado === "COMPLETADA" ? "✅" : nuevoEstado === "EN_PROGRESO" ? "🔄" : "⛔";
  const verbo =
    nuevoEstado === "COMPLETADA" ? "completada" : nuevoEstado === "EN_PROGRESO" ? "en progreso" : "bloqueada";

  return {
    respuesta: `${emoji} "${t.titulo}" → ${verbo}.`,
    // Si lo hizo alguien del equipo, Martín se entera.
    aviso: quien.esMartin
      ? undefined
      : `${emoji} ${quien.nombre} marcó ${verbo}: "${t.titulo}"`,
  };
}

// Punto de entrada: procesa un mensaje y devuelve la respuesta para el autor
// y, opcionalmente, un aviso para Martín.
export async function procesar(
  quien: Quien,
  texto: string
): Promise<{ respuesta: string; avisoParaMartin?: string }> {
  const n = normalizar(texto);

  if (n === "ayuda" || n === "/start" || n === "/ayuda" || n === "help")
    return { respuesta: AYUDA };

  if (n === "tareas" || n === "pendientes") return { respuesta: await listar(quien, "") };
  if (n.startsWith("tareas ") || n.startsWith("pendientes "))
    return { respuesta: await listar(quien, texto.split(/\s+/).slice(1).join(" ")) };

  if (n.startsWith("nueva "))
    return { respuesta: await crear(quien, texto.slice(texto.indexOf(" ") + 1)) };

  if (n.startsWith("completar ") || n.startsWith("completa ")) {
    const r = await cambiarEstado(quien, texto.slice(texto.indexOf(" ") + 1), "COMPLETADA");
    return { respuesta: r.respuesta, avisoParaMartin: r.aviso };
  }
  if (n.startsWith("progreso ") || n.startsWith("en progreso ")) {
    const frag = texto.slice(n.startsWith("en progreso ") ? 12 : 9);
    const r = await cambiarEstado(quien, frag, "EN_PROGRESO");
    return { respuesta: r.respuesta, avisoParaMartin: r.aviso };
  }
  if (n.startsWith("bloqueada ") || n.startsWith("bloquear ")) {
    const r = await cambiarEstado(quien, texto.slice(texto.indexOf(" ") + 1), "BLOQUEADA");
    return { respuesta: r.respuesta, avisoParaMartin: r.aviso };
  }

  return {
    respuesta: `No entendí "${texto}". Escribí "ayuda" para ver lo que sé hacer.`,
  };
}
