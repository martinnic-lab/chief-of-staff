-- ============================================================================
-- 001_capa_inteligencia.sql
-- Re-arquitectura: Microsoft Planner = fuente de verdad de tareas.
-- Esta base (Neon) guarda las dimensiones que Planner no puede modelar:
-- proyectos canónicos, personas, espejo enriquecido de tareas, flags y log.
--
-- Idempotente: se puede correr varias veces sin romper nada (IF NOT EXISTS /
-- ON CONFLICT DO NOTHING). La tabla vieja `tareas` no se toca aquí.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) PROJECTS — dimensión canónica de proyectos
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name text NOT NULL,
  status         text NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'closed')),
  city           text,
  partner        text,
  pm_lead        text,
  entity         text
                 CHECK (entity IN ('Nivel', 'Level RE', 'City Padel')),
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Nombre canónico único (sin importar mayúsculas/minúsculas).
CREATE UNIQUE INDEX IF NOT EXISTS projects_canonical_name_ux
  ON projects (lower(canonical_name));

-- ----------------------------------------------------------------------------
-- 1b) PROJECT_ALIASES — variantes de escritura que resuelven a un proyecto
--     ("la ceja2", "LaCeja 2" -> La Ceja 2)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_aliases (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alias      text NOT NULL,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Un alias solo puede apuntar a UN proyecto (único, ignorando mayúsculas).
CREATE UNIQUE INDEX IF NOT EXISTS project_aliases_alias_ux
  ON project_aliases (lower(alias));
CREATE INDEX IF NOT EXISTS project_aliases_project_id_ix
  ON project_aliases (project_id);

-- ----------------------------------------------------------------------------
-- 2) PEOPLE — equipo / reportes directos (reemplaza los nombres en duro)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS people (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name        text NOT NULL,
  area             text,
  context_md       text,
  telegram_chat_id text,
  planner_user_id  text,
  status           text NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'inactive')),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS people_full_name_ux
  ON people (lower(full_name));

-- ----------------------------------------------------------------------------
-- 3) TASKS — espejo enriquecido de Planner.
--    Planner es el dueño del estado; esta tabla cachea y enriquece.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planner_task_id  text,                    -- llave de cruce con Planner (null hasta sincronizar)
  title_raw        text NOT NULL,           -- título tal como llegó
  title_canonical  text,                    -- título normalizado
  project_id       uuid REFERENCES projects(id) ON DELETE SET NULL,
  assignee_id      uuid REFERENCES people(id)   ON DELETE SET NULL,
  priority         text,
  status           text,
  due_date         date,
  last_movement_at timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Único pero permite varios NULL (tareas aún no sincronizadas con Planner).
CREATE UNIQUE INDEX IF NOT EXISTS tasks_planner_task_id_ux
  ON tasks (planner_task_id);
CREATE INDEX IF NOT EXISTS tasks_project_id_ix  ON tasks (project_id);
CREATE INDEX IF NOT EXISTS tasks_assignee_id_ix ON tasks (assignee_id);

-- ----------------------------------------------------------------------------
-- 4) FLAGS — flujo de "entidad desconocida"
--    Cuando una tarea menciona persona/proyecto que no resuelve, se crea un
--    flag y se avisa por Telegram. Resolverlo crea la entidad o mapea alias.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS flags (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         uuid REFERENCES tasks(id) ON DELETE CASCADE,
  flag_type       text NOT NULL
                  CHECK (flag_type IN ('unknown_person', 'unknown_project', 'normalization_review')),
  raw_value       text NOT NULL,            -- el texto que no se pudo cruzar
  suggested_match text,                     -- sugerencia del sistema (si hay)
  status          text NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open', 'resolved', 'dismissed')),
  resolution_note text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  resolved_at     timestamptz
);

CREATE INDEX IF NOT EXISTS flags_task_id_ix ON flags (task_id);
-- Índice parcial: lo que casi siempre se consulta son los flags abiertos.
CREATE INDEX IF NOT EXISTS flags_open_ix ON flags (status) WHERE status = 'open';

-- ----------------------------------------------------------------------------
-- 5) SYNC_LOG — bitácora de cada lectura/escritura contra Graph API
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sync_log (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at     timestamptz NOT NULL DEFAULT now(),
  direction       text NOT NULL CHECK (direction IN ('read', 'write')),
  operation       text,                     -- qué se llamó (ej: "GET /planner/tasks")
  payload_summary text,                     -- resumen humano del payload
  human_approved  boolean NOT NULL DEFAULT false  -- ¿la escritura la aprobó Martín?
);

CREATE INDEX IF NOT EXISTS sync_log_occurred_at_ix ON sync_log (occurred_at);

-- ----------------------------------------------------------------------------
-- SEED — los 5 miembros actuales del equipo.
-- (context_md se carga aparte desde equipo/*.md por el script de migración.)
-- Proyectos NO se siembran: nacerán vía el flujo de flags.
-- ----------------------------------------------------------------------------
INSERT INTO people (full_name, area) VALUES
  ('Camila Arbeláez',      'finanzas, tesorería, banca y temas administrativos/jurídicos'),
  ('Juan Esteban Vásquez', 'project management de proyectos, licencias y trámites de obra'),
  ('Laura Isaza',          'inmobiliario en USA, renta y property management, orden de procesos'),
  ('Natalia Burgos',       'comercial Colombia: ventas, clientes y cierre de negocios'),
  ('Steven Cadavid',       'relaciones de alto nivel con externos: inversionistas y stakeholders')
ON CONFLICT DO NOTHING
