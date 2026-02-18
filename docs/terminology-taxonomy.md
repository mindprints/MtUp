# Terminology Taxonomy

Date: 2026-02-18

Purpose: establish canonical terms for collaboration and implementation discussions, and avoid ambiguous language.

If another document uses conflicting wording, this file is the glossary source for terms in active use.

## Core Terms

| Term | Canonical Meaning | Notes / Disambiguation |
| --- | --- | --- |
| `Change Proposal` | A suggested code/process edit in collaboration. | Use this term instead of plain "proposal" in engineering discussion. |
| `Activity Proposal` | Product entity (`Proposal`) representing an event/sejour idea. | App/domain term only. |
| `Activity` | User-facing synonym for `Activity Proposal`. | Not a separate model today. |
| `Proposal ID` | `Proposal.id` identifier for one activity proposal. | Include when discussing a specific item. |
| `Activity Type` | `event` or `sejour`. | Exact enum in `src/types/index.ts`. |
| `Activity Status` | `proposed` \| `scheduled` \| `confirmed`. | Proposal-level lifecycle. |
| `Decision Dimension` | `time` \| `place` \| `requirement`. | Stage 2 decision axis. |
| `Decision Status` | `open` \| `pending_confirmation` \| `confirmed`. | Dimension-level lifecycle. |
| `Confirmed (Decision)` | A decision dimension has been manually confirmed. | Derived from `DecisionConfirmation` + decision config status. |
| `Confirmed (Activity)` | The proposal status is `confirmed`. | Distinct from decision confirmation. |
| `Specifics` | Finalized surfaced details on a proposal (`date`, `time`, `location`). | Stored on `proposal.specifics`. |
| `User` | Authenticated person in the app. | Generic actor term. |
| `Member` | User with membership in a group. | Group-scoped actor term. |
| `Role` | `owner` \| `admin` \| `member`. | Group role, not generic auth wording. |
| `Creator` | The user referenced by `proposal.createdBy`. | Also called proposal owner in plain language. |
| `Confirmer` | User who writes a `DecisionConfirmation`. | Must be proposal creator or admin. |
| `Active Group` | Current group context used for reads/writes. | Critical in Supabase mode. |
| `Tenant Isolation` | Group-level data separation via RLS. | Security term. |
| `Availability` | User date/time markings for a proposal. | Not a vote. |
| `Vote` | Decision option selection/ranking input. | Informational; no auto-winner. |
| `Option` | Candidate value for a decision dimension. | `DecisionOption`. |
| `Cutover` | Removal of local authoritative path in favor of Supabase path. | Migration milestone term. |
| `Dual Mode` | Temporary coexistence of local + Supabase paths. | Explicitly temporary. |
| `Local Mode` | Runtime path where `VITE_DATA_SOURCE=local`. | Legacy/fallback mode. |
| `Supabase Mode` | Runtime path where `VITE_DATA_SOURCE=supabase`. | Current migration target mode. |
| `Done` | Implemented and verified with relevant checks. | Delivery status term. |
| `Blocked` | Work cannot progress due to external dependency. | Tracker status term. |
| `In Progress` | Work is actively underway. | Tracker status term. |
| `Not Started` | Planned but not yet started. | Tracker status term. |

## Language Rules

1. Use `Change Proposal` vs `Activity Proposal` explicitly.
2. Always qualify `confirmed` as `Confirmed (Decision)` or `Confirmed (Activity)`.
3. Use `User` for person, `Member` for group-scoped person, and `Role` for authorization level.
4. Keep `Availability` and `Vote` distinct in all discussions.
5. When discussing state, always specify `Activity Status` or `Decision Status`.
