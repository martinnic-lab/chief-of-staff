// === Webhook de Telegram (modo nube) ===
// Telegram entrega aquí cada mensaje del bot cuando está configurado el
// webhook (setWebhook). Se valida el secreto del header para que nadie
// más pueda hacerse pasar por Telegram.

import { NextRequest } from "next/server";
import { manejarMensaje } from "@/bot/nucleo";

export async function POST(req: NextRequest) {
  const secreto = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secreto || req.headers.get("x-telegram-bot-api-secret-token") !== secreto) {
    return new Response("no autorizado", { status: 401 });
  }

  const update = (await req.json()) as {
    message?: {
      chat: { id: number };
      text?: string;
      from?: { first_name?: string; last_name?: string };
    };
  };

  const msg = update.message;
  if (msg?.text) {
    await manejarMensaje({
      chatId: String(msg.chat.id),
      texto: msg.text,
      nombre:
        [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(" ") ||
        "(sin nombre)",
    });
  }

  // Telegram solo necesita un 200 para dar el mensaje por entregado.
  return Response.json({ ok: true });
}
