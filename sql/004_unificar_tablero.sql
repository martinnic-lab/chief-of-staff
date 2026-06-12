-- ============================================================================
-- 004_unificar_tablero.sql
-- El tablero web pasa a usar la tabla tasks (la misma del bot). Para no
-- perder funciones del tablero viejo, tasks gana descripción y notas.
-- La tabla vieja `tareas` queda archivada (no se toca ni se borra aquí).
-- Idempotente.
-- ============================================================================

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS descripcion text;

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS notas text
