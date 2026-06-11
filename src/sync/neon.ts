// Conexión a Neon para el servicio de sincronización.
import { neon } from "@neondatabase/serverless";

const connectionString = process.env.NEON_CONNECTION_STRING;
if (!connectionString) {
  throw new Error(
    "Falta NEON_CONNECTION_STRING (¿corriste con --env-file=.env.local?)"
  );
}

export const sql = neon(connectionString);
