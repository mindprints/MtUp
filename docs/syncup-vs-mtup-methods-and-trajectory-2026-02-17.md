# SyncUp vs mtUp: Methods, Trajectory, Evaluation, Recommendations

Date: 2026-02-17

## Executive Comparison

## SyncUp (Earlier Project)
- Method: broad full-stack architecture early (client + server + Prisma + OAuth + orchestration), with env-based dual-mode (`mock` vs `backend`).
- Trajectory: many backend and AI foundations were built, but runtime remained mostly in mock/localStorage mode.
- Strength: strong infrastructure ambition, strong documentation coverage, explicit deployment/auth plans.
- Weakness: execution split between two modes for too long, causing drift between “implemented” and “actually used” paths.

## mtUp (Current Project)
- Method: focused frontend-first delivery with clear feature increments and stable local behavior.
- Trajectory: rapid product UX progress (calendar, voting, confirmations, sejour windows), with backend migration now explicitly planned.
- Strength: tighter scope control and higher shipped-feature momentum.
- Weakness: still localStorage/auth-mock at runtime; backend, orchestration, and Slack are upcoming and not yet exercised.

## Evidence Highlights

## SyncUp
- Canonical truth-doc pattern and explicit runtime-mode split:
  - `C:\Users\mindp\Documents\GitHub\SyncUp\docs\guides\CURRENT_ARCHITECTURE_TRUTH.md:4`
  - `C:\Users\mindp\Documents\GitHub\SyncUp\docs\guides\CURRENT_ARCHITECTURE_TRUTH.md:19`
- Dual API switch through one barrel:
  - `C:\Users\mindp\Documents\GitHub\SyncUp\client\services\index.ts:7`
- Migration documented but explicitly not completed:
  - `C:\Users\mindp\Documents\GitHub\SyncUp\docs\guides\MIGRATION_GUIDE.md:5`
- Temporary auth bypass capability exists (useful for dev, risky if unmanaged):
  - `C:\Users\mindp\Documents\GitHub\SyncUp\server\src\middleware\auth.ts:20`

## mtUp
- Runtime is intentionally simple frontend stack:
  - `package.json:7`
- Persistence/auth are still localStorage + mock users:
  - `src/lib/storage.ts:13`
  - `src/lib/storage.ts:74`
  - `src/lib/AuthContext.tsx:20`
- Current trajectory has explicit dated transition plan:
  - `docs/execution-tracker-2026-02-17.md:16`
  - `docs/execution-tracker-2026-02-17.md:39`

## Evaluation: Method and Trajectory Fit

## What SyncUp Did Better
- Strong ops readiness artifacts (Dokploy checklist, deployment runbooks).
- Better decomposition of AI roadmap into phased autonomy levels and ticketized tasks.
- Better explicitness around auth/security boundaries in backend mode.

## What mtUp Is Doing Better
- Better product-focus and iteration speed on actual user workflows.
- Less architectural overhead while feature model stabilizes.
- Cleaner momentum: fewer parallel “future path” branches competing with current behavior.

## Main Risk for mtUp (if unmanaged)
- Repeating SyncUp’s dual-mode drift:
  - backend path exists but daily dev remains on local mode too long,
  - causing integration bugs and delayed operational confidence.

## Recommendations

1. Keep mtUp’s scope discipline, but enforce a hard cutover date from localStorage to Supabase.
2. Maintain one canonical “current architecture truth” doc and update it weekly after milestone reviews.
3. Use short-lived dual mode only for migration; set explicit deprecation criteria for local mode.
4. Put orchestration server-side first; avoid client-held model provider keys for production paths.
5. Add a strict “dev bypass forbidden in prod” safeguard if any temporary auth bypass is introduced.
6. Reuse SyncUp’s ticketized AI planning style (small P0/P1 tickets, explicit acceptance criteria).
7. Implement Slack as outbound-first before interactive workflows (matches reliability-first trajectory).
8. Add integration tests early for permissions, confirmation flows, and idempotent reminder delivery.

## Concrete Next Moves for mtUp (2-Week Focus)

1. Create `docs/current-architecture-truth.md` and lock it as canonical runtime reference.
2. Start Plan 1 Sprint 1 immediately (Supabase project, schema, auth wiring).
3. Add `VITE_DATA_SOURCE` telemetry logging to verify which mode each environment is running.
4. Define the local-mode removal gate now (date + criteria), then enforce it in tracker reviews.

## Bottom Line
Use SyncUp as a pattern library, not a blueprint. Reuse its strongest operational and AI-governance methods while preserving mtUp’s tighter execution trajectory and earlier backend cutover.
