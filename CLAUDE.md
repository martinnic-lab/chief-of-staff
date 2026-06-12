# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

Personal "Chief of Staff" app for Martín (CEO of Promotora Nivel, a real-estate company): a kanban dashboard plus a Telegram bot to assign and track tasks for his 5-person team, layered on top of Microsoft Planner. **Everything is in Spanish** — code comments, identifiers, UI copy, commit messages, and docs use Spanish (voseo style, e.g. "corré", "revisá"). Match that. The user is non-technical; user-facing docs (README, RUNBOOK) avoid jargon.

## Commands

All standalone scripts load env from `.env.local` (copy `.env.example`; never committed).

```bash
npm run dev        # Next.js dashboard at localhost:3000
npm run build      # production build
npm run lint       # eslint
npm run db:migrar  # apply ALL sql/*.sql in order (idempotent) + load equipo/*.md into people.context_md
npm run sync       # Planner → Neon sync loop (every 5 min; first run asks for Microsoft device-code login)
npm run bot        # local Telegram bot via long polling (NEVER while the Vercel webhook is set — Telegram rejects polling)
npm run aprobar    # list pending Planner writes; `-- <id>` approve one, `-- todas` all, `-- rechazar <id>` reject
```

There is no test framework. `npm run db:push` / `db:seed` (Drizzle) only touch the **legacy** `tareas` table — see below.

## Architecture

Three entry points share one Neon (serverless Postgres) database:

1. **Web dashboard** — Next.js 16 App Router (`src/app/`). Server actions in `src/app/actions.ts`, board queries in `src/db/tareas.ts`.
2. **Telegram bot** — two interchangeable transports with one shared brain: local long-polling service (`src/bot/servicio.ts`) or Vercel webhook (`src/app/api/telegram/route.ts`). Both call `src/bot/nucleo.ts` → `src/bot/comandos.ts`.
3. **Planner sync service** (`src/sync/servicio.ts`) — each cycle reads Planner into the `tasks` mirror, enqueues title canonizations, and checks for stalled tasks.

### Data layer — important

- Live code uses **raw SQL** via the shared client in `src/sync/neon.ts`, against tables created by `sql/*.sql`: `tasks`, `people`, `projects`, `project_aliases`, `flags`, `sync_log`, `pending_writes`.
- The Drizzle schema in `src/db/schema.ts` (table `tareas`) is **archived/legacy** from before the Planner integration (see `sql/004_unificar_tablero.sql`). Don't build new features on it.
- Migrations are plain SQL files in `sql/`, applied in alphabetical order by `npm run db:migrar`, and must be **idempotent** (`IF NOT EXISTS` everywhere). The Neon HTTP driver runs one statement per call, so `migrar-capa.ts` splits files on `;` — don't write statements containing semicolons inside strings/functions.

### Golden rules of the sync (from RUNBOOK.md — do not violate)

1. **Planner is the source of truth** for each task's status, assignee, and due date; the sync only copies Planner → Neon.
2. **Neon is the source of truth** for projects and team context.
3. **Reading is automatic; writing to Planner requires human approval.** The only write path is `pending_writes` → `npm run aprobar` (`src/sync/aprobar.ts` is the single place that PATCHes Planner). Never add direct Planner writes elsewhere.
4. Every Microsoft Graph call is logged to `sync_log` (writes flagged `human_approved`). Graph auth is delegated device-code flow (`src/sync/graph.ts`), token cached in `.msal-cache.json`.

### Bot conventions

- **Privacy model:** Martín (`TELEGRAM_CHAT_ID`) sees and manages everything; team members (matched via `people.telegram_chat_id`) only see their own tasks. Unknown senders get a polite refusal and Martín is notified.
- **Natural language** is handled by `src/bot/interprete.ts`: Claude only *translates* free text into a strict JSON intent (person constrained to the 5-name enum, `aclarar` action when info is missing — anti-hallucination by design). Execution and validation always stay in `comandos.ts`. Without `ANTHROPIC_API_KEY` the bot falls back to exact commands.
- Telegram replies are plain text (no Markdown) via `src/bot/api.ts`; notification messages to Martín are built in `src/lib/telegram.ts`.

### Web auth

`src/proxy.ts` (Next 16's "proxy", formerly middleware) gates all pages behind a cookie session (`src/lib/sesion.ts`, SHA-256 of user+password+secret) with a `/login` page. It's a no-op when `DASHBOARD_PASSWORD` is unset (local dev). Exempt routes validate their own secrets: `/api/telegram` (`TELEGRAM_WEBHOOK_SECRET` header) and `/api/cron/*` (`CRON_SECRET` bearer).

### Stalled-task detector

`revisarAtrasosPlanner` (`src/sync/atrasos.ts`) alerts via Telegram for tasks with no movement for 6+ hours (re-alert suppressed for 24h via `tasks.delay_alerted_at`). It runs from three places depending on deployment mode: `src/instrumentation.ts` (hourly, local `next dev`/`start`), the bot/sync service loops, and the Vercel cron `/api/cron/atrasos` (`vercel.json`).

### Team context

`equipo/*.md` holds one profile per team member; these feed both the assignment suggestion (`src/lib/sugerencia.ts`, keyword scoring — a future plan is to replace it with Claude) and `people.context_md` at migration time. The 5 names are hardcoded as enums in several places (`src/db/schema.ts`, `src/bot/interprete.ts`, `src/lib/sugerencia.ts`, `src/db/migrar-capa.ts`) — adding a team member touches all of them plus the `people` table.

Path alias: `@/*` → `src/*`.
