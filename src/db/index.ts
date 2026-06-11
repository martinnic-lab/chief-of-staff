import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const connectionString = process.env.NEON_CONNECTION_STRING;
if (!connectionString) {
  throw new Error(
    "Falta NEON_CONNECTION_STRING en .env.local — revisá ese archivo."
  );
}

const sql = neon(connectionString);
export const db = drizzle(sql, { schema });
