# Current Architecture Truth

Date: 2026-02-18

If another document conflicts with this file, treat this file as authoritative.

## Snapshot
- App type: single-package React + TypeScript + Vite frontend.
- Runtime data/auth: Supabase auth in dev + mixed data path (Supabase + local fallback).
- Primary UX: AI-first assistant surface with workspace tab fallback.
- Deployment state: local/dev-first.

## Current Runtime Mode
- `data_source`: `supabase` in active dev runs (configurable).
- `ai_assistant_enabled`: feature-flagged (`VITE_AI_ASSISTANT_ENABLED`).
- `orchestrator_base_url`: configurable (`VITE_ORCHESTRATOR_BASE_URL`), default `http://localhost:8787`.
- Auth implementation: Supabase-backed via `src/lib/AuthContext.tsx`.
- Data path status:
  - `proposals`: Supabase-backed in `src/lib/ProposalContext.tsx`
  - `availabilities`: Supabase-backed in `src/lib/ProposalContext.tsx`
  - `decision_*`: still local-backed during migration

## AI Runtime (Current)
- In-app assistant panel is integrated and user-facing.
- Dev orchestrator exists at `server/dev-orchestrator.mjs`.
- Current tool coverage:
  - confirmed activities
  - my availability (including `this week` range handling)
  - attendee follow-up context (`who is coming?`)
- OpenRouter coupling is active when `OPENROUTER_API_KEY` is present.
- Tool-backed answers are deterministic; model is used for unsupported/general phrasing fallback.

## Migration Direction (Approved)
- Target backend: Supabase (Auth + Postgres + RLS).
- Near-term approach: temporary dual mode with explicit cutover and removal.
- Required guardrail: do not keep dual mode indefinitely.

## Multi-Group Requirement (Design Constraint)
- Future state requires isolated groups/tenants with:
  - group-scoped data visibility
  - group membership and roles
  - invitation flows
- Schema and policies must be group-aware from day one of Supabase migration.
- UI may continue single-group behavior initially, but data model must not assume one global group.

## Non-Negotiables
- Permissions enforced server-side (RLS), not only client-side.
- AI and Slack integrations must rely on server-trusted identity and scoped authorization.
- Any dev bypass capability must be blocked in production.

## Current Gaps
- Decision entities are not yet migrated to Supabase.
- Group switching UI is not yet exposed in app.
- Local fallback is still present and must be retired after full migration.
- AI write actions are not implemented yet (read-only only).
- AI audit logging/approval workflow tables are not implemented yet.

## Next Milestone
- Add approval-gated AI write actions and audit logging while finishing Supabase decision migration.
