// === API cruda de Telegram para el bot bidireccional ===
// Recibir: long polling con getUpdates (funciona local, sin servidor público).
// Enviar: sendMessage en texto plano (sin Markdown, para evitar sorpresas).

const BASE = () => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("Falta TELEGRAM_BOT_TOKEN en .env.local");
  return `https://api.telegram.org/bot${token}`;
};

export type MensajeEntrante = {
  updateId: number;
  chatId: string;
  texto: string;
  nombre: string; // nombre que muestra Telegram del remitente
};

export async function obtenerMensajes(
  offset: number
): Promise<MensajeEntrante[]> {
  const resp = await fetch(
    `${BASE()}/getUpdates?timeout=25&offset=${offset}&allowed_updates=["message"]`
  );
  const data = (await resp.json()) as {
    ok: boolean;
    result?: {
      update_id: number;
      message?: {
        chat: { id: number };
        text?: string;
        from?: { first_name?: string; last_name?: string };
      };
    }[];
  };
  if (!data.ok || !data.result) return [];

  return data.result
    .filter((u) => u.message?.text)
    .map((u) => ({
      updateId: u.update_id,
      chatId: String(u.message!.chat.id),
      texto: u.message!.text!,
      nombre: [u.message!.from?.first_name, u.message!.from?.last_name]
        .filter(Boolean)
        .join(" ") || "(sin nombre)",
    }));
}

export async function responder(chatId: string, texto: string): Promise<void> {
  await fetch(`${BASE()}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: texto }),
  });
}
