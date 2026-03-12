# MtUp (Snooky)

MtUp is a social planning app for groups coordinating events and trips.  
Snooky is the in-app coordination agent and now the primary planning surface.

## Current Features

- ✅ User auth (mock + Supabase mode)
- ✅ Supabase-backed proposals + availabilities in dev mode
- ✅ Snooky-first experience with proposal feed in `What's Up?`
- ✅ AI proposal drafting + in-chat editable proposal form
- ✅ AI proposal creation in app (`Propose`)
- ✅ Proposer auto-affirmation/availability assumptions in Snooky flow
- ✅ Proposal postcard cards (dominant image + compact flags + collapsible detail drawers)
- ✅ One-click `I'm available as proposed`
- ✅ Unified `Suggest Alternatives` modal (date/time/place deltas)
- ✅ Attributed proposal contributions/deviations (local v1 thread store)
- ✅ Snooky local memory v1 (capture, confirm, edit note, dismiss)
- ✅ Fictional seed personas for 5 Stockholm participants + group seed context
- ✅ OpenRouter-backed thumbnail generation for proposal cards
- ✅ Dark mode + fixed phone-shell preview for Snooky-first iteration
- 🚧 Persistence migration for proposal contributions/memory/thumbnails to server storage
- 🚧 Richer suggestion workflows + approval/audit hardening

## Setup

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run local AI orchestrator (optional, for AI modal in dev)
npm run ai:dev

# Restart AI orchestrator + Vite (new windows)
npm run dev:restart

# Restart AI orchestrator + Vite (same terminal)
npm run dev:restart:here

# Build for production
npm run build

# Convert oversized PNG assets to WebP (requires dev dependency: sharp)
npm run images:webp -- src

# Run unit tests
npm run test:run

# Run e2e tests
npm run test:e2e
```

To enable Snooky + local orchestrator in dev:
- Set `VITE_AI_ASSISTANT_ENABLED=true`
- Set `VITE_ORCHESTRATOR_BASE_URL=http://localhost:8787`
- Set `SUPABASE_URL` and `SUPABASE_ANON_KEY`
- Set `OPENROUTER_API_KEY` and optionally `OPENROUTER_MODEL`
- Set `SMTP2GO_API_KEY` and `NOTIFICATION_EMAIL_FROM` if you want reminder / confirmation emails to send for real
- Run `npm run ai:dev` in a second terminal (or use `npm run dev:restart:here`)

To enable proposal thumbnail generation in Snooky:
- Set `VITE_THUMBNAIL_PROVIDER=openrouter`
- Set `VITE_THUMBNAIL_OPENROUTER_BASE_URL=https://openrouter.ai/api/v1`
- Set `VITE_THUMBNAIL_OPENROUTER_MODEL=google/gemini-3.1-flash-image-preview`
- Set `VITE_THUMBNAIL_OPENROUTER_API_KEY=...`
  - fallback supported: `VITE_OPENROUTER_API_KEY`

Important:
- Make sure `.env.local` uses `VITE_ORCHESTRATOR_BASE_URL=...` with no leading space before the key.

## Deployable Orchestrator

The orchestrator can now run as Vercel Node functions on the same deployment as the Vite app:

- `POST /ai/chat` rewrites to `api/ai/chat.js`
- `GET /health` rewrites to `api/health.js`
- in deployed environments, if `VITE_ORCHESTRATOR_BASE_URL` is unset, the frontend defaults to the current site origin instead of `localhost`

Recommended production setup:

- host the app and orchestrator on the same domain
- set `VITE_AI_ASSISTANT_ENABLED=true`
- set server envs in the deployed runtime:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `OPENROUTER_API_KEY`
  - `OPENROUTER_MODEL`
  - `SMTP2GO_API_KEY`
  - `NOTIFICATION_EMAIL_FROM`
  - `NOTIFICATION_EMAIL_REPLY_TO`
  - `APP_BASE_URL`

If you host the orchestrator on a separate domain, set `VITE_ORCHESTRATOR_BASE_URL` to that base URL explicitly.

Concrete Vercel Hobby setup steps are in `docs/vercel-hobby-deploy.md`.

## Mock Users

All users have the password: `password`

- Alice (admin)
- Bob
- Charlie
- Diana
- Eve

## Tech Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Supabase for auth/data (incremental migration)

## Current Status

**Snooky-First Proposal Workflow (Current Focus)**
- [x] Proposal feed inside Snooky (`What's Up?`)
- [x] Baseline + participant states + attributed alternatives
- [x] One-click affirm + unified alternatives modal
- [x] OpenRouter thumbnail generation on proposal cards
- [x] Memory v1 capture + review + seeded personas
- [ ] Persist thread/memory/thumbnail artifacts server-side
- [ ] Add richer alternative voting and narrowing UX
- [ ] Add audit-grade logs for AI-assisted proposal actions

## Stage 2 Docs

- `docs/handoff-2026-03-12.md`
- `docs/activity-details-stage2.md`
- `docs/icon-activity-translation.md`
- `docs/handoff-2026-02-17.md`
- `docs/handoff-2026-02-18.md`
- `docs/handoff-2026-02-25.md`
- `docs/handoff-2026-02-26.md`
- `docs/terminology-taxonomy.md`
- `docs/current-architecture-truth.md`
- `docs/seed-personas.md`
- `docs/supabase/README.md`
- `docs/supabase/001_initial_group_aware_schema.sql`
- `docs/supabase/002_seed_example_profiles_and_group.sql`
- `docs/supabase/003_seed_second_group_isolation.sql`
- `docs/supabase/004_rls_isolation_verification.sql`
- `docs/supabase/005_rls_hotfix_group_memberships_recursion.sql`
- `docs/plan-1-supabase-migration-auth.md`
- `docs/plan-2-deployment-dokploy-vps-and-vercel.md`
- `docs/plan-3-ai-orchestrator.md`
- `docs/plan-4-slack-integration.md`
- `docs/plan-5-ai-implementation-backlog.md`
- `docs/implementation-roadmap-overview.md`
- `docs/execution-tracker-2026-02-17.md`
- `docs/syncup-vs-mtup-methods-and-trajectory-2026-02-17.md`
