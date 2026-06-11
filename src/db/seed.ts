import { db } from "./index";
import { tareas } from "./schema";

async function main() {
  console.log("Sembrando tareas de prueba...");

  await db.insert(tareas).values([
    {
      titulo: "Estructurar crédito para apertura de sala",
      descripcion:
        "Coordinar con el banco el encargo fiduciario y sacar el punto de equilibrio para la nueva apertura.",
      asignado_a: "Camila Arbeláez",
      prioridad: "ALTA",
      estado: "EN_PROGRESO",
      deadline: "2026-06-20",
      notas: "Tarea de ejemplo creada al sembrar la base de datos.",
    },
    {
      titulo: "Reunión con inversionista del Portafolio A",
      descripcion:
        "Preparar y sostener la interlocución de alto nivel con el inversionista externo para presentar avances.",
      asignado_a: "Steven Cadavid",
      prioridad: "MEDIA",
      estado: "NUEVA",
      deadline: null,
      notas: "Tarea de ejemplo creada al sembrar la base de datos.",
    },
  ]);

  console.log("Listo: 2 tareas sembradas.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Error sembrando:", e);
    process.exit(1);
  });
