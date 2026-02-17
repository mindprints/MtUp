# Execution Tracker (Starting 2026-02-17)

## Purpose
Track implementation progress across the roadmap with dates, owners, status, and dependencies.

## Status Legend
- `not_started`
- `in_progress`
- `blocked`
- `done`

## Milestones

| Milestone | Target Date | Status | Owner | Depends On | Notes |
| --- | --- | --- | --- | --- | --- |
| A. Supabase schema + auth baseline | 2026-02-27 | not_started | TBD | - | Plan 1 foundation |
| B. Supabase app cutover complete | 2026-03-13 | not_started | TBD | A | Remove localStorage runtime path |
| C. Staging + production deployment live | 2026-03-20 | not_started | TBD | B | Plan 2 complete (Dokploy or Vercel path) |
| D. Slack outbound notifications live | 2026-03-31 | not_started | TBD | C | Plan 4 phase 1 |
| E. AI orchestrator read-only live | 2026-04-10 | not_started | TBD | C | Plan 3 phase 1 |
| F. AI approval-gated actions live | 2026-04-24 | not_started | TBD | D, E | Plan 3 phase 2+ |

## Workstream Tracker

| Workstream | Task | Plan Ref | Start Date | Target Date | Status | Owner | Dependencies | Exit Criteria |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Data/Auth | Supabase project setup + env wiring | Plan 1 | 2026-02-17 | 2026-02-20 | done | TBD | - | Dev project configured and running in `supabase` mode |
| Data/Auth | SQL schema migrations (`profiles`, `proposals`, `availabilities`, decisions) | Plan 1 | 2026-02-18 | 2026-02-24 | in_progress | TBD | Setup | Schema + seeds + hotfix scripts added and applied; decision path migration pending |
| Data/Auth | RLS policies + role model (`is_admin`) | Plan 1 | 2026-02-20 | 2026-02-26 | in_progress | TBD | Schema | Group membership recursion hotfix applied; permission matrix tests still pending |
| Data/Auth | AuthContext migration to Supabase Auth | Plan 1 | 2026-02-21 | 2026-02-27 | done | TBD | Setup | Supabase login/logout/session bootstrap stable in dev |
| Data/Auth | ProposalContext/service migration | Plan 1 | 2026-02-24 | 2026-03-10 | in_progress | TBD | Auth + Schema | Groups + proposals + availabilities wired in Supabase mode; decisions still local |
| Data/Auth | LocalStorage cutover + fallback removal | Plan 1 | 2026-03-11 | 2026-03-13 | not_started | TBD | Context migration | localStorage no longer authoritative |
| Deploy | CI pipeline (build/test/deploy gates) | Plan 2 | 2026-03-04 | 2026-03-12 | not_started | TBD | Data/Auth near complete | Deploy gates enforced |
| Deploy | Hosting setup (Dokploy VPS primary or Vercel alt) | Plan 2 | 2026-03-10 | 2026-03-18 | not_started | TBD | CI | Staging reachable |
| Deploy | Production deploy + monitoring/alerts | Plan 2 | 2026-03-17 | 2026-03-20 | not_started | TBD | Hosting setup | Prod healthy + logs visible |
| Slack | Slack app setup + token/scopes + signature verification | Plan 4 | 2026-03-20 | 2026-03-24 | not_started | TBD | Deploy | Verified signed webhook handling |
| Slack | Outbound notifications (proposal, reminder, confirmation) | Plan 4 | 2026-03-24 | 2026-03-31 | not_started | TBD | Slack setup | Messages delivered reliably |
| Slack | Reminder scheduler + channel mapping | Plan 4 | 2026-03-25 | 2026-04-03 | not_started | TBD | Outbound baseline | Digest/reminder policy active |
| AI | Orchestrator service skeleton + tool contracts | Plan 3 | 2026-03-24 | 2026-03-31 | not_started | TBD | Deploy | Typed tool interfaces live |
| AI | Read-only admin assistant (summary + recommendations) | Plan 3 | 2026-03-31 | 2026-04-10 | not_started | TBD | Orchestrator skeleton | Admin can run ask/review flow |
| AI | Audit logging + approval workflow UI | Plan 3 | 2026-04-07 | 2026-04-17 | not_started | TBD | Read-only assistant | Every action auditable |
| AI | Approval-gated action execution (Slack + internal actions) | Plan 3 | 2026-04-14 | 2026-04-24 | not_started | TBD | Audit + Slack outbound | No unapproved writes |
| Governance | Create canonical `current-architecture-truth` doc | Cross-cutting | 2026-02-18 | 2026-02-19 | done | TBD | - | Completed in `docs/current-architecture-truth.md` |
| Governance | Add weekly architecture-truth review ritual (Tue/Fri) | Cross-cutting | 2026-02-19 | 2026-02-20 | not_started | TBD | Architecture truth doc | Doc updated after each review, drift callouts logged |
| Data/Auth | Define and approve localStorage cutover gate criteria | Plan 1 | 2026-02-18 | 2026-02-21 | not_started | TBD | - | Written go/no-go checklist approved by team |
| Data/Auth | Enforce local mode deprecation date in tracker and roadmap | Plan 1 | 2026-02-21 | 2026-02-22 | not_started | TBD | Cutover gate criteria | Explicit date and rollback plan published |
| Platform | Add runtime mode telemetry (`VITE_DATA_SOURCE`) in app diagnostics | Plan 1 | 2026-02-20 | 2026-02-24 | in_progress | TBD | Supabase env wiring | Startup logging implemented in `src/main.tsx` |
| AI | Define server-side orchestration boundary (no client production keys) | Plan 3 | 2026-03-03 | 2026-03-07 | not_started | TBD | Deploy baseline | Provider keys server-only in production path |
| Security | Add explicit “dev auth bypass forbidden in production” check | Plan 2/3 | 2026-03-10 | 2026-03-12 | not_started | TBD | Deploy baseline | Startup guard fails if bypass flag enabled in prod |
| Slack | Keep phase 1 outbound-only; document interactive deferral gate | Plan 4 | 2026-03-24 | 2026-03-26 | not_started | TBD | Slack setup | Interactive features blocked until outbound SLO met |
| QA | Add integration tests for permissions + idempotency | Plan 1/4 | 2026-03-06 | 2026-03-14 | in_progress | TBD | Data/Auth migration in progress | Vitest + Playwright baseline passing; add explicit RLS permission tests next |

## Weekly Checkpoints

| Checkpoint Date | Focus | Expected Outcome |
| --- | --- | --- |
| 2026-02-20 | Supabase setup | Dev env connected + initial migrations running |
| 2026-02-27 | Auth baseline | Supabase login/session stable |
| 2026-03-13 | Data cutover | Core app fully Supabase-backed |
| 2026-03-20 | Deployment | Staging + production active |
| 2026-03-31 | Slack phase 1 | Outbound notifications live |
| 2026-04-10 | AI phase 1 | Read-only assistant in admin flow |
| 2026-04-24 | AI phase 2 | Approval-gated actions live |

## Trajectory Safeguards

| Safeguard | Target Date | Status | Owner | Validation |
| --- | --- | --- | --- | --- |
| Avoid long-lived dual-mode drift (local + backend) | 2026-03-13 | not_started | TBD | localStorage removed as authoritative runtime |
| Canonical architecture truth maintained weekly | 2026-02-20 | not_started | TBD | Tue/Fri doc updates completed |
| Server-side trust boundary for AI and secrets | 2026-03-20 | not_started | TBD | No production provider keys in client bundle |
| Notification quality before Slack interactivity | 2026-03-31 | not_started | TBD | Outbound reminder SLO and noise thresholds met |

## Risks to Track

| Risk | Severity | Owner | Mitigation | Status |
| --- | --- | --- | --- | --- |
| RLS misconfiguration causing data exposure | high | TBD | Role-based policy tests per table | open |
| Auth migration regressions | medium | TBD | Dual-path smoke tests before cutover | open |
| Slack notification noise | medium | TBD | Digest + threshold rules | open |
| AI action reliability / hallucinations | high | TBD | Approval gates + audit logs + tool constraints | open |

## Update Cadence
- Update this tracker every Tuesday and Friday.
- Mark status changes with date in Notes.
- Escalate `blocked` tasks within 24 hours.
