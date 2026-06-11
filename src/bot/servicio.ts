// === Bot de Telegram — servicio LOCAL (long polling) ===
//
// Correr con:  npm run bot   (o doble clic en INICIAR-BOT.bat)
//
// OJO: este modo es para el portátil. En la nube (Vercel) el bot funciona
// por webhook (src/app/api/telegram/route.ts) y este servicio NO debe
// correr a la vez — si hay webhook configurado, Telegram rechaza el polling.
//
// El cerebro es compartido: src/bot/nucleo.ts.

import { obtenerMensajes } from "./api";
import { manejarMensaje } from "./nucleo";
import { revisarAtrasosPlanner } from "../sync/atrasos";

async function loopMensajes(): Promise<never> {
  let offset = 0;
  // Descartar mensajes viejos acumulados antes de arrancar.
  const previos = await obtenerMensajes(0);
  if (previos.length > 0) offset = previos[previos.length - 1].updateId + 1;

  console.log("🤖 Bot escuchando. (Ctrl+C para parar)");
  while (true) {
    try {
      const mensajes = await obtenerMensajes(offset);
      for (const m of mensajes) {
        offset = m.updateId + 1;
        console.log(`[${new Date().toLocaleTimeString("es-CO")}] ${m.nombre}: ${m.texto}`);
        await manejarMensaje(m);
      }
    } catch (e) {
      console.error("Error en el loop:", e instanceof Error ? e.message : e);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

async function loopAtrasos(): Promise<void> {
  const correr = async () => {
    try {
      const { avisadas } = await revisarAtrasosPlanner();
      if (avisadas > 0) console.log(`⚠️ Avisé ${avisadas} tarea(s) atrasada(s).`);
    } catch (e) {
      console.error("Error revisando atrasos:", e instanceof Error ? e.message : e);
    }
  };
  setTimeout(correr, 60 * 1000);
  setInterval(correr, 60 * 60 * 1000);
}

console.log("=== Chief of Staff · bot de Telegram (Neon como única base) ===");
loopAtrasos();
loopMensajes();
