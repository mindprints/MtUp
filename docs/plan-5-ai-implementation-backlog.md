# Plan 5: AI Assistant Implementation Backlog

Date: 2026-02-18

## Status Note (2026-02-26)
- This plan contains historical "read-only phase" steps that are partially superseded.
- Current runtime already includes:
  - Snooky proposal drafting
  - in-app proposal creation from AI flow
  - Snooky proposal feed interaction patterns (affirm + alternatives)
- Treat read-only references below as historical sequencing context, not current product behavior.

## Objective
Add an in-app AI assistant that can answer scheduling questions, propose actions, and execute approved actions with role-based controls and auditability.

## Current Constraints
- Current app is frontend-only (Vite + React).
- Supabase is active for auth/proposals/availabilities; decision entities are still local-backed.
- Server-side orchestrator is required before production AI actions.

## Delivery Phases
1. Phase A: Read-only AI assistant (in-app modal + server orchestrator + audit logs).
2. Phase B: Self-service write actions (user can modify own availability via AI with approval).
3. Phase C: Role-gated privileged actions (confirm decisions, send reminders).
4. Phase D: External research tools (weather/flights/venues) with citations.

## Track 0: Foundation (before Phase A)

### Ticket A0.1: Runtime config for AI
- Goal: Add feature flag + endpoint/model config.
- Files:
  - `src/lib/runtimeConfig.ts`
  - `.env.example`
  - `docs/current-architecture-truth.md`
- Tasks:
  - Add `VITE_AI_ASSISTANT_ENABLED`.
  - Add `VITE_ORCHESTRATOR_BASE_URL` for server API.
  - Add diagnostics logging in `src/main.tsx`.
- Acceptance:
  - App can turn AI UI on/off via env.
  - Startup log clearly states AI enabled/disabled and target endpoint.

### Ticket A0.2: Shared AI types
- Goal: Define strict contracts for chat, actions, approvals, and tool receipts.
- Files:
  - `src/types/index.ts`
  - `src/types/ai.ts` (new)
- Tasks:
  - Add `AiThread`, `AiMessage`, `AiActionProposal`, `AiExecutionReceipt`, `AiPermission`.
  - Add discriminated union for assistant responses (`answer` vs `action_proposal`).
- Acceptance:
  - All AI client/service code compiles against typed contracts only.

## Track 1: Frontend AI Modal (Phase A)

### Ticket A1.1: AI modal shell and chat UI
- Goal: Add a modal with thread history + input + response cards.
- Files:
  - `src/components/AiAssistantPanel.tsx` (new)
  - `src/components/PrimaryExperience.tsx` (new)
  - `src/components/Dashboard.tsx`
  - `src/components/AppView.tsx`
- Tasks:
  - Add `AI Assistant` button in top controls.
  - Render messages with role styling (`user` / `assistant` / `system`).
  - Support loading states + error states.
- Acceptance:
  - User can open modal, ask a question, and see response.

### Ticket A1.2: Frontend AI client service
- Goal: Isolate API calls and schema checks.
- Files:
  - `src/lib/aiClient.ts` (new)
  - `src/lib/runtimeConfig.ts`
- Tasks:
  - Implement `sendAiMessage(threadId, message, context)`.
  - Implement response parsing and validation.
  - Include auth context and active group context in request metadata.
- Acceptance:
  - Modal uses `aiClient` only; no direct fetch calls inside component.

## Track 2: Orchestrator Server (Phase A)

Note: server should live in VPS deployment (existing mtup.xyz experimentation path can be reused).

### Ticket A2.1: Minimal orchestrator endpoint
- Goal: Endpoint to receive chat turns and return structured response.
- Suggested server files (new repo or existing VPS service):
  - `server/src/routes/ai/chat.ts`
  - `server/src/services/ai/orchestrator.ts`
  - `server/src/services/ai/policy.ts`
  - `server/src/services/ai/toolRegistry.ts`
- Tasks:
  - Add POST `/ai/chat`.
  - Validate caller auth and group scope.
  - Call OpenRouter model with tool-capable prompt format.
  - Return structured JSON payload.
- Acceptance:
  - Local curl test returns valid assistant response for read-only query.

### Ticket A2.2: Audit logging baseline
- Goal: Persist every AI turn and tool attempt.
- Suggested DB tables:
  - `ai_threads`
  - `ai_messages`
  - `ai_tool_calls`
  - `ai_actions`
  - `ai_approvals`
- Files:
  - `docs/supabase/006_ai_audit_tables.sql` (new)
  - `docs/supabase/README.md`
- Acceptance:
  - Each chat turn and tool invocation writes audit row(s) with timestamp, actor, status.

## Track 3: Read-Only Internal Tools (Phase A)

### Ticket A3.1: Internal read tools
- Goal: Support the core “ask” questions.
- Tool list:
  - `list_my_availability`
  - `list_confirmed_proposals`
  - `list_attendees_for_proposal`
  - `list_proposals_by_type`
- Server files:
  - `server/src/services/ai/tools/internalReadTools.ts`
  - `server/src/services/ai/tools/types.ts`
- Acceptance:
  - Questions like “What events are confirmed?” work with group-scoped data only.

### Ticket A3.2: Prompt policy and response style
- Goal: Deterministic, concise operational responses.
- Files:
  - `server/src/services/ai/prompts/systemPrompt.ts`
- Tasks:
  - Include guardrails: no writes in Phase A.
  - Require explicit “unknown” instead of hallucinated data.
- Acceptance:
  - Assistant refuses write requests during read-only phase with clear reason.

## Track 4: User-Approved Self Actions (Phase B)

### Ticket B4.1: Action proposal cards in UI
- Goal: Assistant suggests action; user must approve.
- Files:
  - `src/components/AiAssistantPanel.tsx`
  - `src/components/AiActionCard.tsx` (new)
  - `src/lib/aiClient.ts`
- Tasks:
  - Render proposed action with impact summary.
  - Add `Approve` and `Cancel`.
- Acceptance:
  - No write is executed without explicit user approve click.

### Ticket B4.2: Self-write tools
- Tool list:
  - `remove_my_availability_range`
  - `set_my_availability`
  - `create_event_proposal` / `create_sejour_proposal` (in own name)
- Server files:
  - `server/src/services/ai/tools/selfWriteTools.ts`
  - `server/src/services/ai/executor.ts`
- Acceptance:
  - “Remove my availability this week” shows preview then executes after approve.
  - Writes are limited to caller-owned records unless policy allows otherwise.

## Track 5: Privileged Actions (Phase C)

### Ticket C5.1: Permission-aware privileged tools
- Tool list:
  - `confirm_decision`
  - `send_group_reminder`
  - `update_departure_message`
- Files:
  - `server/src/services/ai/tools/privilegedTools.ts`
  - `server/src/services/ai/policy.ts`
  - `src/lib/permissions.ts` (align policy semantics)
- Tasks:
  - Enforce creator/admin gate for confirmations.
  - Enforce admin/member role checks for group reminders.
- Acceptance:
  - Non-privileged user receives policy denial with explicit reason.

### Ticket C5.2: Idempotency and retries for reminders
- Files:
  - `server/src/services/notifications/reminders.ts`
  - `server/src/services/ai/executor.ts`
- Acceptance:
  - Repeated approval click does not duplicate notifications.

## Track 6: External Research Tools (Phase D)

### Ticket D6.1: Weather tool
- Tool: `get_weather`
- Files:
  - `server/src/services/ai/tools/weatherTool.ts`
- Acceptance:
  - Response includes source metadata and forecast date range.

### Ticket D6.2: Flights tool
- Tool: `search_flights`
- Files:
  - `server/src/services/ai/tools/flightsTool.ts`
- Acceptance:
  - Returns ranked options with price/date and provider/source metadata.

### Ticket D6.3: Places tool
- Tool: `find_venues`
- Files:
  - `server/src/services/ai/tools/venuesTool.ts`
- Acceptance:
  - Returns suggestions with distance, opening hours (if available), and source.

## Track 7: Testing Backlog

### Ticket T7.1: Unit tests (frontend client/parsing)
- Files:
  - `src/lib/aiClient.test.ts` (new)
- Coverage:
  - Response shape parsing.
  - Action proposal parsing.
  - Error handling.

### Ticket T7.2: Orchestrator policy tests (server)
- Files:
  - `server/tests/ai-policy.test.ts`
  - `server/tests/ai-tools.test.ts`
- Coverage:
  - Role gate enforcement.
  - Self-write boundary checks.
  - No-write behavior in read-only mode.

### Ticket T7.3: E2E tests (frontend + server)
- Files:
  - `tests/e2e/ai-assistant.spec.ts` (new)
- Scenarios:
  - Ask read-only question.
  - Approve “remove my availability this week.”
  - Denied confirmation by non-admin.
  - Create sejour/event via AI action proposal.

## Suggested Implementation Order (2-Week Start)
1. A0.1, A0.2
2. A1.1, A1.2
3. A2.1, A2.2
4. A3.1, A3.2
5. T7.1 + T7.3 smoke

## OpenRouter Setup Checklist
1. Add server-side `OPENROUTER_API_KEY`.
2. Add server-side `OPENROUTER_MODEL`.
3. Add optional `OPENROUTER_BASE_URL` override.
4. Verify no provider key in frontend env vars.
5. Add health check endpoint for model reachability.

## Definition of Done (Phase A)
- AI modal enabled via feature flag.
- User can ask read-only scheduling questions and get correct scoped answers.
- Every request and tool call is audit logged.
- No write operations can run in Phase A.
