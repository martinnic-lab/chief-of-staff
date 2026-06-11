import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

// Cargar las claves desde .env.local
config({ path: ".env.local" });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.NEON_CONNECTION_STRING!,
  },
});
