# Proposal Flow Code Survey (2026-03-03)

## Goal
Map existing proposal-related logic to avoid duplicate implementations as the 3-screen UI is expanded:
- `Activities`
- `Snooky` (propose flow)
- `Admin`

## Canonical Sources

### 1) Proposal state and persistence
- `src/lib/ProposalContext.tsx`
  - Single source of truth for proposal CRUD:
    - `addProposal`
    - `updateProposal`
    - `deleteProposal`
  - Availability and decision data APIs.
  - Group/member list (`groupUsers`) and admin operations (`addMember`, `setMemberAdmin`, `removeMember`).
  - Handles both local-storage mode and Supabase mode.

- `src/lib/storage.ts`
  - Local-only persistence implementation.
  - User auth data, proposals, availability, decisions.
  - Local member CRUD used by `ProposalContext`.

### 2) Snooky chat + AI proposal drafting
- `src/components/AiAssistantPanel.tsx`
  - Chat submit handler (`handleSubmit`) calls orchestrator via `sendAiMessage`.
  - AI action proposal handling:
    - stores action proposals by message id
    - editable draft fields in propose flow
    - confirm path calls `handleProposeFromDraft` -> `addProposal(...)`
  - Propose-flow specific UI:
    - inline drafted details beneath assistant response
    - bottom action bar (`Confirm`, `Cancel`, `Activities`)

- `src/lib/aiClient.ts`
  - Client for orchestrator endpoint `/ai/chat`.
  - Response validation for:
    - `mode: answer`
    - `mode: action_proposal`

- `server/dev-orchestrator.mjs`
  - Intent routing (`propose_activity`).
  - Action proposal payload generation (`kind: create_proposal`).

### 3) Screen routing and composition
- `src/components/PrimaryExperience.tsx`
  - Primary screen state machine:
    - `activities`
    - `propose`
    - `admin`
  - Admin entry button and propose screen wiring.

- `src/components/ProposeScreen.tsx`
  - Hosts `AiAssistantPanel` in `proposalFlow` mode.

- `src/components/AdminDashboard.tsx`
  - Admin UI for member and event operations.

## Current Redundancy/Legacy Risks
- `src/components/AppView.tsx` remains legacy workspace/calendar-centric and overlaps conceptually with `Admin` operations in parts.
- `src/components/AiProposalFormCard.tsx` is now mostly legacy for old chat/action UX; propose-flow uses inline editable draft fields directly in `AiAssistantPanel`.

## Recommended Reuse Rules
1. All proposal writes must go through `ProposalContext` (`addProposal`/`updateProposal`/`deleteProposal`).
2. All AI draft-to-proposal conversion should stay in one place: `handleProposeFromDraft` in `AiAssistantPanel`.
3. Member administration should stay in `ProposalContext` APIs; do not call `storage` or Supabase directly from UI components.
4. New Snooky capabilities should extend orchestrator intents/payloads first, then UI rendering in `AiAssistantPanel`.

