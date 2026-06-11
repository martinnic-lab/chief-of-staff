// Aplica TODAS las migraciones de sql/*.sql (en orden) a Neon y carga los
// perfiles del equipo (equipo/*.md) en people.context_md.
//
// Correr con:
//   npm run db:migrar
//   (= node --env-file=.env.local --import tsx src/db/migrar-capa.ts)

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";

const connectionString = process.env.NEON_CONNECTION_STRING;
if (!connectionString) {
  throw new Error("Falta NEON_CONNECTION_STRING (¿corriste con --env-file=.env.local?)");
}
const sql = neon(connectionString);

// Persona -> archivo de perfil. Mismo mapa que usa la sugerencia de asignación.
const PERFILES: Record<string, string> = {
  "Camila Arbeláez": "camila-arbelaez.md",
  "Juan Esteban Vásquez": "juan-esteban-vasquez.md",
  "Laura Isaza": "laura-isaza.md",
  "Natalia Burgos": "natalia-burgos.md",
  "Steven Cadavid": "steven-cadavid.md",
};

async function main() {
  // 1) Ejecutar cada migración de sql/, en orden alfabético, sentencia por
  //    sentencia (el driver HTTP de Neon ejecuta una sentencia por llamada).
  const dirSql = path.join(process.cwd(), "sql");
  const archivos = readdirSync(dirSql)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const archivo of archivos) {
    console.log(`\n— ${archivo} —`);
    const contenido = readFileSync(path.join(dirSql, archivo), "utf-8");
    const sentencias = contenido
      .split(/;\s*(?:\r?\n|$)/)
      .map((s) => s.trim())
      .filter((s) =>
        // Descartar fragmentos vacíos o que son puro comentario.
        s.split(/\r?\n/).some((linea) => {
          const l = linea.trim();
          return l.length > 0 && !l.startsWith("--");
        })
      );

    for (const [i, sentencia] of sentencias.entries()) {
      await sql.query(sentencia);
      const primera = sentencia.replace(/^(--.*\r?\n)+/, "").split("\n")[0];
      console.log(`  ✓ [${i + 1}/${sentencias.length}] ${primera.slice(0, 70)}`);
    }
  }

  // 2) Cargar context_md desde equipo/*.md (solo si aún está vacío, para no
  //    pisar ediciones hechas directamente en la base).
  for (const [nombre, archivo] of Object.entries(PERFILES)) {
    let perfil: string;
    try {
      perfil = readFileSync(path.join(process.cwd(), "equipo", archivo), "utf-8");
    } catch {
      console.log(`  ⚠ Sin perfil para ${nombre} (no encontré equipo/${archivo})`);
      continue;
    }
    await sql.query(
      `UPDATE people SET context_md = $1
       WHERE lower(full_name) = lower($2) AND context_md IS NULL`,
      [perfil, nombre]
    );
    console.log(`  ✓ Perfil cargado: ${nombre}`);
  }

  // 3) Verificación rápida.
  const tablas = (await sql.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' ORDER BY table_name`
  )) as { table_name: string }[];
  const gente = (await sql.query(
    `SELECT full_name, area, (context_md IS NOT NULL) AS con_perfil FROM people ORDER BY full_name`
  )) as { full_name: string; area: string; con_perfil: boolean }[];

  console.log("\nTablas en la base:", tablas.map((t) => t.table_name).join(", "));
  console.log("\nEquipo sembrado:");
  for (const p of gente) {
    console.log(`  - ${p.full_name} · ${p.area} · perfil: ${p.con_perfil ? "sí" : "no"}`);
  }
}

main().then(() => {
  console.log("\nMigración aplicada sin errores.");
  process.exit(0);
});
