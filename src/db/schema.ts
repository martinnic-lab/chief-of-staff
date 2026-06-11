import {
  pgTable,
  pgEnum,
  serial,
  text,
  timestamp,
  date,
} from "drizzle-orm/pg-core";

// === Listas fijas (enums) ===
// Las 5 personas reales del equipo (carpeta equipo/).
export const TEAM = [
  "Camila Arbeláez",
  "Juan Esteban Vásquez",
  "Laura Isaza",
  "Natalia Burgos",
  "Steven Cadavid",
] as const;

export const asignadoEnum = pgEnum("asignado_a", TEAM);
export const prioridadEnum = pgEnum("prioridad", ["ALTA", "MEDIA", "BAJA"]);
export const estadoEnum = pgEnum("estado", [
  "NUEVA",
  "EN_PROGRESO",
  "BLOQUEADA",
  "COMPLETADA",
]);

// === Tabla principal ===
export const tareas = pgTable("tareas", {
  id: serial("id").primaryKey(),
  creada_en: timestamp("creada_en", { withTimezone: true }).defaultNow().notNull(),
  // Se actualiza en cada cambio de estado: sirve para detectar tareas "sin movimiento +6h".
  actualizada_en: timestamp("actualizada_en", { withTimezone: true })
    .defaultNow()
    .notNull(),
  titulo: text("titulo").notNull(),
  descripcion: text("descripcion"),
  asignado_a: asignadoEnum("asignado_a").notNull(),
  prioridad: prioridadEnum("prioridad").default("MEDIA").notNull(),
  estado: estadoEnum("estado").default("NUEVA").notNull(),
  deadline: date("deadline"),
  notas: text("notas"),
});

export type Tarea = typeof tareas.$inferSelect;
export type NuevaTarea = typeof tareas.$inferInsert;
