// === Núcleo del bot: identificar al autor y despachar el comando ===
// Lo usan tanto el servicio local (long polling) como el webhook de Vercel.

import { responder } from "./api";
import { procesar, type Quien } from "./comandos";
import { sql } from "../sync/neon";

function martinChat(): string {
  const c = process.env.TELEGRAM_CHAT_ID;
  if (!c) throw new Error("Falta TELEGRAM_CHAT_ID");
  return c;
}

// Aviso "desconocido" repetido: en local se recuerda por proceso; en
// serverless cada invocación es nueva (avisará de nuevo — aceptable).
const desconocidosAvisados = new Set<string>();

export async function identificar(
  chatId: string,
  nombre: string
): Promise<Quien | null> {
  if (chatId === martinChat()) {
    return { esMartin: true, personaId: null, nombre: "Martín" };
  }
  const filas = (await sql.query(
    `SELECT id, full_name FROM people WHERE telegram_chat_id = $1 AND status = 'active'`,
    [chatId]
  )) as { id: string; full_name: string }[];
  if (filas.length === 1) {
    return { esMartin: false, personaId: filas[0].id, nombre: filas[0].full_name };
  }

  await responder(
    chatId,
    "Hola 👋 Soy el asistente de Nivel, pero todavía no te tengo registrado. Ya le avisé a Martín."
  );
  if (!desconocidosAvisados.has(chatId)) {
    desconocidosAvisados.add(chatId);
    await responder(
      martinChat(),
      `🔔 "${nombre}" me escribió y no está registrado. Si es del equipo, su chat_id es: ${chatId} ` +
        `(se guarda en people.telegram_chat_id).`
    );
  }
  return null;
}

export async function manejarMensaje(m: {
  chatId: string;
  texto: string;
  nombre: string;
}): Promise<void> {
  const quien = await identificar(m.chatId, m.nombre);
  if (!quien) return;

  const { respuesta, avisoParaMartin } = await procesar(quien, m.texto);
  await responder(m.chatId, respuesta);
  if (avisoParaMartin && m.chatId !== martinChat()) {
    await responder(martinChat(), avisoParaMartin);
  }
}
