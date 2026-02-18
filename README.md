# Schedule App

A collaborative scheduling application for friends to coordinate events and trips.

## Features (In Development)

- ✅ User authentication (5 mock users)
- ✅ Supabase-backed auth, proposals, and availabilities in dev mode
- ✅ Activity proposals with emoji identifiers
- ✅ Explicit `+ Event` / `+ Sejour` creation flow
- ✅ Individual calendar with click-and-drag availability marking
- ✅ Day/Month/Year calendar views
- ✅ Single calendar with `Display All` / `My Proposals` / `My Choices` / `Selected` filters
- ✅ Proposal cards with proposer, availability counts, and voter counts
- ✅ Color-coded availability visualization
- ✅ Activity Details drill-down (time/place/requirements)
- ✅ Manual confirmation workflow (creator/admin)
- ✅ Sejour overlap-window option generation
- ✅ AI-first landing with assistant/workspace tabs
- ✅ Local AI dev orchestrator + OpenRouter coupling (read-only tools)
- ✅ Dark mode toggle
- 🚧 Comments and specificity refinement
- 🚧 Activity status transitions

## Setup

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run local AI orchestrator (optional, for AI modal in dev)
npm run ai:dev

# Build for production
npm run build

# Run unit tests
npm run test:run

# Run e2e tests
npm run test:e2e
```

To enable AI modal in dev:
- Set `VITE_AI_ASSISTANT_ENABLED=true`
- Set `VITE_ORCHESTRATOR_BASE_URL=http://localhost:8787`
- Set `SUPABASE_URL` and `SUPABASE_ANON_KEY`
- Set `OPENROUTER_API_KEY` and optionally `OPENROUTER_MODEL`
- Run `npm run ai:dev` in a second terminal

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

**Phase 1: Authentication ✅**
- [x] User login/logout
- [x] localStorage integration
- [x] Auth context
- [x] Basic dashboard layout

**Phase 2: Proposal Creation ✅**
- [x] Create proposal modal
- [x] Emoji selection from pool
- [x] Explicit Event/Sejour entry buttons
- [x] Activity selection integrated into calendar workflow

**Phase 3: Individual Calendar ✅**
- [x] Month grid view
- [x] Click-and-drag date selection
- [x] Emoji marking for proposals
- [x] Visual indicators for availability
- [x] Month navigation (Previous/Today/Next)

**Phase 4: Shared Calendar View ✅**
- [x] Aggregate view showing all users on a single calendar
- [x] Proposal filtering modes and type-aware rendering
- [x] Availability and attendee visibility counts
- [x] User initials display (other users only)

**Phase 6: AI Assistant (In Progress)**
- [x] AI-first landing experience (Assistant tab first)
- [x] Read-only AI panel in app
- [x] Dev orchestrator endpoint (`/ai/chat`)
- [x] OpenRouter model coupling in dev orchestrator
- [x] Deterministic tools for confirmed activities/availability
- [x] Follow-up attendee context handling
- [ ] Approval-gated write actions
- [ ] Rich visual answer cards (maps/images)
- [ ] Server-side audit logs and approvals

**Phase 5: Activity Details (Next)**
- [x] Activity details drill-down entry point
- [x] Time/place/requirements tabs
- [x] Voting modes (single, multi, ranked)
- [x] Informational analytics (first-choice + ranked scoring)
- [x] Manual confirmation (creator/admin)
- [x] Sejour overlap-window candidate generation
- [ ] Comments section
- [ ] Specificity refinement workflow
- [ ] Status transitions (proposed → scheduled → confirmed)
- [ ] Edit/delete proposals

## Stage 2 Docs

- `docs/activity-details-stage2.md`
- `docs/icon-activity-translation.md`
- `docs/handoff-2026-02-17.md`
- `docs/handoff-2026-02-18.md`
- `docs/terminology-taxonomy.md`
- `docs/current-architecture-truth.md`
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
