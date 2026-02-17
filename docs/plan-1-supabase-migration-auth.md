# Plan 1: localStorage to Supabase (Database + Auth)

## Objective
Replace localStorage persistence and mock auth with Supabase PostgreSQL + Supabase Auth while preserving current UX and data model behavior.

## Scope
- Migrate app data from client-only state to Supabase-backed storage.
- Replace username/password mock login with real Supabase Auth.
- Add row-level security (RLS) for multi-user data protection.
- Keep current features functional during migration.

## Target Architecture
- Frontend: current React app.
- Backend data/auth: Supabase.
- Access layer: `src/lib/supabase.ts` + service modules replacing direct `storage` access.
- Auth model: Supabase `auth.users` + profile table.

## Proposed Schema
- `profiles` (id UUID PK = auth user id, display_name, is_admin, created_at)
- `proposals` (id UUID, title, type, emoji, created_by, created_at, status, specifics_json)
- `availabilities` (id UUID, user_id, proposal_id, dates_json, time_slots_json, updated_at)
- `decision_configs` (proposal_id, dimension, mode, status)
- `decision_options` (id UUID, proposal_id, dimension, label, metadata_json, created_by, created_at)
- `decision_votes` (id UUID, proposal_id, dimension, user_id, ranked_option_ids_json, selected_option_ids_json, updated_at)
- `decision_confirmations` (id UUID, proposal_id, dimension, option_ids_json, confirmed_by, confirmed_at, note)
- Optional: `comments` table if implemented in same phase.

## RLS / Permissions Model
- Users can read proposals/availabilities/options/votes for proposals they participate in (or all if app is group-wide).
- Users can create/update their own availabilities and votes.
- Proposal creator or admin can confirm decisions and update proposal confirmed specifics.
- Admin role is stored in `profiles.is_admin`.

## Migration Strategy
1. Introduce Supabase client and environment variables.
2. Add SQL migrations and policies in versioned files.
3. Build repository/service layer parallel to localStorage APIs.
4. Add feature flag: `VITE_DATA_SOURCE=local|supabase`.
5. Wire AuthContext to Supabase Auth (email/password or magic link).
6. Migrate ProposalContext calls from `storage` to async service calls.
7. Add optimistic UI and error states for network operations.
8. Run dual-read verification in dev (optional).
9. Remove localStorage path after stable cutover.

## Auth Migration Details
- Current mock users become seeded real users in Supabase Auth.
- Add profile bootstrap on signup/login.
- Session handling via Supabase client listener.
- Replace `storage.getCurrentUser()` with authenticated session + profile fetch.

## Data Migration Approach
- Build one-time import script:
  - Read current localStorage payload.
  - Map to SQL inserts with deterministic ID preservation where possible.
  - Validate row counts before/after.
- For production-like environments: freeze writes briefly during cutover.

## API/Client Refactor Checklist
- `AuthContext`: use Supabase session methods.
- `ProposalContext`: async methods + loading/error states.
- `storage.ts`: convert to compatibility shim during transition.
- Add retry and conflict handling for concurrent edits.

## Testing Plan
- Unit tests for service layer mapping.
- Integration tests for:
  - login/logout/session restore
  - create proposal
  - availability add/remove
  - voting and confirmation permissions
- RLS tests using separate user tokens.

## Risks and Mitigations
- Risk: permission regressions.
  - Mitigation: explicit RLS test matrix by role.
- Risk: UI lag due to network latency.
  - Mitigation: optimistic updates + fallback refresh.
- Risk: schema drift.
  - Mitigation: migration scripts in repo + environment promotion flow.

## Deliverables
- Supabase project + SQL migrations.
- Auth + data service layer in codebase.
- Feature flag removed after cutover.
- Migration notes and rollback steps.

## Rollout Phases
- Phase A: infrastructure + schema + auth wiring.
- Phase B: proposals/availabilities read/write migration.
- Phase C: decisions/confirmations migration.
- Phase D: localStorage removal + hardening.

## Success Criteria
- No feature regressions vs local mode.
- All writes/reads persisted in Supabase.
- Auth and permission flows enforced server-side via RLS.
