# Schedule App

A collaborative scheduling application for friends to coordinate events and trips.

## Features (In Development)

- ✅ User authentication (5 mock users)
- ✅ localStorage persistence
- ✅ Activity proposals with emoji identifiers
- ✅ Event vs Sejour type selection
- ✅ Individual calendar with click-and-drag availability marking
- ✅ Day/Month/Year calendar views
- ✅ Single calendar with per-proposal and "Display all" views
- ✅ "My Proposals" filter and proposal-level consensus bars
- ✅ Color-coded availability visualization
- ✅ Activity Details drill-down (time/place/requirements)
- ✅ Manual confirmation workflow (creator/admin)
- ✅ Sejour overlap-window option generation
- ✅ Dark mode toggle
- 🚧 Comments and specificity refinement
- 🚧 Activity status transitions

## Setup

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Run unit tests
npm run test:run

# Run e2e tests
npm run test:e2e
```

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
- localStorage for data persistence

## Current Status

**Phase 1: Authentication ✅**
- [x] User login/logout
- [x] localStorage integration
- [x] Auth context
- [x] Basic dashboard layout

**Phase 2: Proposal Creation ✅**
- [x] Create proposal modal
- [x] Emoji selection from pool
- [x] Event vs Sejour toggle
- [x] New proposal action in the main view
- [x] Activity selection integrated into calendar workflow

**Phase 3: Individual Calendar ✅**
- [x] Month grid view
- [x] Click-and-drag date selection
- [x] Emoji marking for proposals
- [x] Visual indicators for availability
- [x] Month navigation (Previous/Today/Next)

**Phase 4: Shared Calendar View ✅**
- [x] Aggregate view showing all users on a single calendar
- [x] Proposal filtering and "Display all" toggle
- [x] Consensus detection and highlighting
- [x] User initials display (other users only)

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
- `docs/handoff-2026-02-16.md`
- `docs/handoff-2026-02-17.md`
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
- `docs/implementation-roadmap-overview.md`
- `docs/execution-tracker-2026-02-17.md`
- `docs/syncup-vs-mtup-methods-and-trajectory-2026-02-17.md`
