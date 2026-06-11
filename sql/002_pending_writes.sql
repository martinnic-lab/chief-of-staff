-- ============================================================================
-- 002_pending_writes.sql
-- Cola de escrituras hacia Planner. NINGUNA escritura sale sin aprobación
-- explícita de Martín. Idempotente.
-- ============================================================================

CREATE TABLE IF NOT EXISTS pending_writes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  write_type  text NOT NULL
              CHECK (write_type IN ('title_canonicalization')),
  payload     jsonb NOT NULL,             -- ej: {"new_title": "[La Ceja 2] Pagar impuesto predial"}
  status      text NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'executed', 'rejected', 'failed')),
  error       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  decided_at  timestamptz,                -- cuándo Martín aprobó/rechazó
  executed_at timestamptz                 -- cuándo se ejecutó el PATCH en Graph
);

CREATE INDEX IF NOT EXISTS pending_writes_task_id_ix ON pending_writes (task_id);
CREATE INDEX IF NOT EXISTS pending_writes_pending_ix
  ON pending_writes (status) WHERE status = 'pending'
