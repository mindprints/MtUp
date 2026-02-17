# Implementation Roadmap Overview

## Purpose
This document summarizes and sequences the four reference plans:
- `docs/plan-1-supabase-migration-auth.md`
- `docs/plan-2-deployment-dokploy-vps-and-vercel.md`
- `docs/plan-3-ai-orchestrator.md`
- `docs/plan-4-slack-integration.md`

## Recommended Execution Order
1. Supabase migration + auth (Plan 1).
2. Deployment baseline (Plan 2).
3. Slack integration foundation (Plan 4, outbound first).
4. AI orchestrator (Plan 3), then Slack interactive actions.

Reasoning:
- Orchestrator and Slack workflows require stable identity, permissions, and persistent backend data first.
- Deployment baseline is needed before reliable webhooks, schedulers, and workers.

## Step-by-Step Implementation Plan

## Step 1: Data/Auth Foundation
- Implement Supabase schema, RLS, and auth.
- Replace localStorage runtime with service layer.
- Keep feature parity with current app.
- Exit criteria:
  - All core workflows run in Supabase mode.
  - Server-side permissions enforced.

## Step 2: Deploy Staging/Prod
- Choose hosting path:
  - Primary: Dokploy VPS (best for multi-service future).
  - Alternative: Vercel Free (frontend-first speed).
- Add CI/CD, env management, health checks, logging.
- Exit criteria:
  - Repeatable staging + production deploys.

## Step 3: Slack Outbound Messaging
- Create Slack app and bot scopes.
- Implement outbound notifications + reminder scheduler.
- Map app groups/users to Slack channels/users.
- Exit criteria:
  - Deterministic, low-noise reminders and status messages.

## Step 4: AI Orchestrator (Read-Only to Action)
- Start with read-only summarization and recommendation.
- Add approval-gated actions.
- Integrate with Slack action paths only after auditability is stable.
- Exit criteria:
  - Admin can safely approve AI-assisted operations with audit logs.

## Dependency Matrix
- Plan 1 -> required by Plans 3 and 4.
- Plan 2 -> required for production reliability of Plans 3 and 4.
- Plan 4 (outbound) can start before full Plan 3.
- Plan 3 action execution should reuse Plan 4 messaging adapters.

## Recommended Milestones
1. Milestone A: Supabase cutover complete.
2. Milestone B: Production deploy + observability complete.
3. Milestone C: Slack outbound + reminders live.
4. Milestone D: AI read-only assistant live.
5. Milestone E: AI approval-gated actions live.

## Practical Recommendations
- Keep one feature flag per major migration (`data_source`, `slack_enabled`, `ai_assistant_enabled`).
- Add audit logging before enabling automated actions.
- Implement idempotency keys for Slack/webhook and AI action execution paths.
- Validate permissions at backend boundaries, not only in UI.
- Ship thin vertical slices instead of large all-at-once releases.

## Suggested First Sprint Breakdown
1. Sprint 1:
  - Supabase schema, auth wiring, profile model.
2. Sprint 2:
  - Proposal/availability migration + RLS hardening.
3. Sprint 3:
  - Decision entities migration + deployment pipeline.
4. Sprint 4:
  - Slack outbound notifications + channel mapping.
5. Sprint 5:
  - AI read-only assistant + audit log UI.
6. Sprint 6:
  - AI approval workflow + guarded action execution.

## Decision Point: Dokploy vs Vercel
- Choose Dokploy now if AI workers + Slack webhook/schedulers are near-term.
- Choose Vercel now only if immediate goal is quick frontend launch while backend remains external and light.

## Definition of Done (Program Level)
- Persistent data and auth fully server-backed.
- Production deployment reliable with monitoring and rollback.
- Slack messaging operating with low noise and high traceability.
- AI orchestration demonstrably useful, safe, and auditable.
