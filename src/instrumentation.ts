// Se ejecuta una vez cuando arranca el servidor de Next.js.
// Aquí dejamos corriendo el "detector de atrasos" cada hora.

export async function register() {
  // Solo en el entorno Node (no en el navegador ni en Edge).
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Evitar duplicados si Next recarga el módulo en desarrollo.
  const g = globalThis as typeof globalThis & {
    __detectorAtrasos?: NodeJS.Timeout;
  };
  if (g.__detectorAtrasos) return;

  const UNA_HORA = 60 * 60 * 1000;

  const correr = async () => {
    try {
      // Import dinámico para no cargar la BD hasta que el servidor esté listo.
      const { revisarAtrasos } = await import("./app/actions");
      const { avisadas } = await revisarAtrasos();
      if (avisadas > 0) {
        console.log(
          `[detector-atrasos] Avisé ${avisadas} tarea(s) sin movimiento +6h.`
        );
      }
    } catch (e) {
      console.error("[detector-atrasos] Error:", e);
    }
  };

  // Primera corrida un minuto después de arrancar, luego cada hora.
  setTimeout(correr, 60 * 1000);
  g.__detectorAtrasos = setInterval(correr, UNA_HORA);

  console.log("[detector-atrasos] Activo: reviso atrasos cada hora.");
}
