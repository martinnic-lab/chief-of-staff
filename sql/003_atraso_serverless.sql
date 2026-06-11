-- ============================================================================
-- 003_atraso_serverless.sql
-- En la nube no hay memoria entre ejecuciones: el "ya avisé de esta tarea"
-- pasa a vivir en la base. Idempotente.
-- ============================================================================

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS delay_alerted_at timestamptz
