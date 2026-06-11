// === Servicio de sincronización Planner ⇄ Neon ===
//
// Correr con:  npm run sync
//
// Cada ciclo (5 min por defecto, SYNC_INTERVAL_MIN para cambiarlo):
//   1. LEE Planner → actualiza el espejo en Neon (tabla tasks)
//   2. ENCOLA canonizaciones de título (pending_writes; nada se escribe
//      en Planner sin aprobación — eso vive en `npm run aprobar`)
//   3. REVISA atrasos (+6h sin movimiento) → avisa por Telegram
//
// La primera vez pide iniciar sesión Microsoft con un código (device code).

import { getToken, getPlanId } from "./graph";
import { sincronizarPlanner } from "./planner";
import { encolarCanonizaciones } from "./canonizar";
import { revisarAtrasosPlanner } from "./atrasos";

const INTERVALO_MIN = Number(process.env.SYNC_INTERVAL_MIN ?? "5");

let fallosSeguidos = 0;

async function ciclo(): Promise<void> {
  const inicio = new Date().toLocaleTimeString("es-CO");
  try {
    const lectura = await sincronizarPlanner();
    const escritura = await encolarCanonizaciones();
    const atrasos = await revisarAtrasosPlanner();

    fallosSeguidos = 0;
    console.log(
      `[${inicio}] ✓ leídas ${lectura.leidas} · nuevas ${lectura.nuevas} · ` +
        `cambiadas ${lectura.actualizadas} · flags ${lectura.flagsNuevos} · ` +
        `por aprobar ${escritura.encoladas} · atrasos avisados ${atrasos.avisadas}`
    );
  } catch (e) {
    fallosSeguidos++;
    console.error(
      `[${inicio}] ✗ Ciclo falló (${fallosSeguidos} seguido${fallosSeguidos > 1 ? "s" : ""}):`,
      e instanceof Error ? e.message : e
    );
  }
}

async function main() {
  console.log("=== Chief of Staff · sincronización con Planner ===");
  console.log(`Plan: ${getPlanId()} · cada ${INTERVALO_MIN} min\n`);

  // Asegurar sesión Microsoft antes de arrancar el loop.
  await getToken();

  await ciclo();
  setInterval(ciclo, INTERVALO_MIN * 60 * 1000);
  console.log(
    `\nServicio corriendo. Dejá esta ventana abierta. (Ctrl+C para parar)\n` +
      `Escrituras pendientes se aprueban con: npm run aprobar`
  );
}

main();
