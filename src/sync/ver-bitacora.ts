// Diagnóstico rápido: muestra los últimos registros de la bitácora sync_log.
// Correr: node --env-file=.env.local --import tsx src/sync/ver-bitacora.ts
import { sql } from "./neon";

async function main() {
  const [resumen] = (await sql.query(
    `SELECT count(*)::int AS total, max(occurred_at) AS ultimo FROM sync_log`
  )) as { total: number; ultimo: string }[];

  const ultimos = (await sql.query(
    `SELECT to_char(occurred_at, 'HH24:MI') AS hora, direction, operation, payload_summary
     FROM sync_log ORDER BY occurred_at DESC LIMIT 5`
  )) as { hora: string; direction: string; operation: string; payload_summary: string }[];

  console.log(`Registros en la bitácora: ${resumen.total} · último: ${resumen.ultimo}`);
  for (const r of ultimos) {
    console.log(`  [${r.hora}] ${r.direction.padEnd(5)} ${r.operation} — ${r.payload_summary}`);
  }
}

main().then(() => process.exit(0));
