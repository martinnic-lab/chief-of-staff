// === Mensajero de Telegram ===
// Arma y envía los mensajes que el bot le manda a Martín.

export type TipoNotificacion =
  | "nueva_tarea"
  | "cambio_estado"
  | "tarea_atrasada";

export type PayloadNotificacion = {
  titulo: string;
  asignado_a: string;
  prioridad?: string;
  estado?: string;
  deadline?: string | null;
};

// Estado en memoria (se reinicia al apagar el servidor) — lo usa la pantalla /config
// para mostrar si Telegram está respondiendo y cuándo fue el último envío.
type EstadoTelegram = {
  ultimoEnvio: string | null; // ISO date
  ultimoOk: boolean | null;
  ultimoError: string | null;
};
const estado: EstadoTelegram = {
  ultimoEnvio: null,
  ultimoOk: null,
  ultimoError: null,
};
export function getEstadoTelegram(): EstadoTelegram {
  return { ...estado };
}

// Escapa caracteres especiales del Markdown v1 de Telegram en texto dinámico.
function esc(texto: string): string {
  return texto.replace(/([_*`\[])/g, "\\$1");
}

export function armarMensaje(
  tipo: TipoNotificacion,
  p: PayloadNotificacion
): string {
  const titulo = esc(p.titulo);
  const asignado = esc(p.asignado_a);
  switch (tipo) {
    case "nueva_tarea":
      return `📋 Nueva tarea creada: *${titulo}*. Asignada a: ${asignado}. Prioridad: ${
        p.prioridad ?? "MEDIA"
      }. Deadline: ${p.deadline ? esc(p.deadline) : "sin deadline"}.`;
    case "cambio_estado":
      return `🔄 *${titulo}* movida a ${p.estado}. Asignada a: ${asignado}.`;
    case "tarea_atrasada":
      return `⚠️ Tarea sin movimiento +6h: *${titulo}* · asignada a ${asignado}.`;
  }
}

// Envía un mensaje libre (lo usa el botón "Probar Telegram" de /config).
export async function enviarMensajeLibre(
  text: string
): Promise<{ ok: boolean; error?: string }> {
  return enviarTexto(text);
}

export async function enviarTelegram(
  tipo: TipoNotificacion,
  payload: PayloadNotificacion
): Promise<{ ok: boolean; error?: string }> {
  const text = armarMensaje(tipo, payload);
  return enviarTexto(text);
}

// Envío crudo a Telegram + registro del estado para /config.
async function enviarTexto(
  text: string
): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    const error = "Faltan TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID en .env.local";
    estado.ultimoEnvio = new Date().toISOString();
    estado.ultimoOk = false;
    estado.ultimoError = error;
    return { ok: false, error };
  }

  try {
    const resp = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "Markdown",
        }),
      }
    );

    const data = await resp.json();
    estado.ultimoEnvio = new Date().toISOString();

    if (!resp.ok || !data.ok) {
      const error = data.description || `HTTP ${resp.status}`;
      estado.ultimoOk = false;
      estado.ultimoError = error;
      return { ok: false, error };
    }

    estado.ultimoOk = true;
    estado.ultimoError = null;
    return { ok: true };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    estado.ultimoEnvio = new Date().toISOString();
    estado.ultimoOk = false;
    estado.ultimoError = error;
    return { ok: false, error };
  }
}
