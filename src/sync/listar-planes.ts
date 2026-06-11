// Utilidad de diagnóstico: lista los planes de Planner a los que tenés
// acceso, con su ID y cuántas tareas tiene cada uno.
// Correr: node --env-file=.env.local --import tsx src/sync/listar-planes.ts

import { graphFetch } from "./graph";

type Plan = { id: string; title: string };

async function main() {
  const r = await graphFetch<{ value: Plan[] }>("/me/planner/plans", {
    resumen: "Diagnóstico: listar mis planes",
  });

  if (r.value.length === 0) {
    console.log("No se encontraron planes asociados a tu cuenta.");
    return;
  }

  console.log(`\nPlanes a los que tenés acceso (${r.value.length}):\n`);
  for (const plan of r.value) {
    let cuenta = "?";
    try {
      const t = await graphFetch<{ value: unknown[] }>(
        `/planner/plans/${plan.id}/tasks`,
        { resumen: `Diagnóstico: contar tareas de "${plan.title}"` }
      );
      cuenta = String(t.value.length);
    } catch {
      cuenta = "(sin acceso)";
    }
    console.log(`  • "${plan.title}" — ${cuenta} tarea(s)`);
    console.log(`    id: ${plan.id}\n`);
  }

  console.log(`Plan configurado actualmente: ${process.env.PLANNER_PLAN_ID}\n`);
}

main().then(() => process.exit(0));
