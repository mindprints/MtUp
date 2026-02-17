# Plan 3: AI Orchestrator for Activity Administration and Research

## Objective
Add an AI orchestration layer that assists admins with planning operations, activity recommendations, and resource research while keeping user control and auditability.

## Scope
- Admin-focused assistant actions:
  - summarize proposal state and blockers
  - suggest times/locations based on participation signals
  - draft activity briefs/checklists
  - research external resources (venues, weather, travel options)
- Non-goal (initial): autonomous actions without approval.

## Operating Model
- Human-in-the-loop by default.
- AI proposes; admin approves execution.
- Every action logged with prompt, inputs, output, and final action status.

## System Components
- `orchestrator-service`:
  - intent router
  - tool registry
  - policy/guardrail layer
  - execution planner
- `tool adapters`:
  - internal data tools (proposals, votes, availabilities)
  - external research tools (maps/venues/weather/travel APIs)
  - messaging tools (Slack integration from Plan 4)
- `audit store`:
  - request, decisions, tool calls, outcomes.

## Capability Phases
1. Read-only assistant:
  - summarize current activity state
  - highlight consensus gaps and pending confirmations
2. Drafting assistant:
  - generate proposed options, reminder copy, and checklists
3. Action assistant:
  - execute approved actions (post reminder, add options, schedule follow-up)

## Policy and Safety
- Role-gated access (admin only for orchestration actions).
- Rate limits and abuse controls.
- PII/data minimization in prompts.
- Hard deny-list for destructive operations without explicit confirmation.

## Data Interfaces
- Read from Supabase tables.
- Write through validated service methods only.
- No direct unrestricted SQL from model tools.

## Recommended Tech Direction
- Stateless API endpoint for orchestration requests.
- Queue-backed workers for long-running research tasks.
- Typed tool contracts and strict JSON schema validation.

## UX Integration
- Add `AI Assistant` panel for admins:
  - `Ask`, `Review Plan`, `Approve`, `Run`.
- Show confidence and source list for research outputs.
- Add clear banner for generated suggestions vs confirmed decisions.

## Evaluation Metrics
- Time-to-decision reduction.
- Admin action acceptance rate.
- Number of resolved pending confirmations.
- Error/rollback rate for AI-triggered actions.

## Risks and Mitigations
- Hallucinated recommendations:
  - Require citations for external data and confidence labels.
- Over-automation risk:
  - Approval gates + scoped permissions.
- Cost growth:
  - token budgets, caching, model tiering.

## Deliverables
- Orchestrator service design doc.
- Tool contract definitions.
- Audit log schema + UI.
- Admin AI panel with approval workflow.

## Success Criteria
- Admin can run end-to-end: ask -> review -> approve -> execute -> audit.
- No unapproved writes occur.
- Research-backed suggestions are traceable and reproducible.
