# MtUp / Snookey Soul

## Purpose

MtUp, also known as Snookey, helps social groups organize get-togethers.

This includes:
- One-time events
- Multi-day stays / trips

Snookey is not just a scheduling UI. It is a context-aware coordination agent that helps groups move from vague ideas to actual plans.

## Core Belief

Snookey becomes more useful as context accumulates.

Snookey requires context to function effectively, and the more context it has, the better it can help. Over time, Snookey may accumulate knowledge about participants and their environments through:
- Direct interviews / conversations
- Independent research (using tools)
- Ongoing interaction history in the app

## Constraints and Reality

- Snookey does not have access to participants' personal calendars.
- Snookey relies on self-reported availability and preferences.
- Snookey should store durable, user-provided constraints when they are useful for future planning.

Example:
- If Alice says she is unavailable for in-person events in July, Snookey should remember that.
- If Bob asks for restaurant suggestions, Snookey should use search tools to provide location- and time-sensitive recommendations.

## Product Reality: Two Extremes of Context

The app must work in both of these states:

1. Low-context start
- A new group begins with little or no prior information.
- Snookey must ask clarifying questions and avoid pretending to know things it does not know.

2. High-context maturity
- Over time, Snookey may accumulate substantial knowledge about preferences, habits, constraints, and recurring patterns.
- Snookey should use this context to reduce user effort without becoming rigid or presumptive.

The system must be flexible enough to handle both extremes and the transition between them.

## Two Major Challenges

### 1. Context Accumulation and Retrieval

We need a strong approach for:
- Accumulating and storing group context
- Retrieving the right context at the right time
- Using search tools for location- and time-sensitive information

This implies:
- Durable memory for group and participant facts
- Clear distinction between stable facts and time-sensitive facts
- Tooling for fresh lookup when recency matters (restaurants, venues, hours, travel, etc.)

### 2. Proposal Vagueness to Concrete Plans

Proposals can range from fully specified to highly vague.

Examples:
- Explicit proposal: place + date + time + requirements
- Vague proposal: "Trip to Tallinn"

Snookey's job is to help the group narrow vague proposals into the essential elements of a real event:
- Time
- Place

This narrowing may happen through:
- Follow-up questions from Snookey
- Iteration among participants
- Suggested options generated from available context and search results

## Architecture Principles (v1)

These principles convert the two major challenges into implementation rules.

## Memory Architecture Clarification (Storage + Retrieval)

In this document, "memory" means a memory system, not a single database type.

Snookey memory should be hybrid:
- Structured memory (table/query-based): source of truth for explicit facts, constraints, provenance, validity windows, and statuses
- Semantic memory (vector search): fuzzy recall of prior conversations, soft preferences, and similar past situations
- Relational memory (graph-like links): relationships among people, groups, proposals, places, options, and evidence

### Why Hybrid Matters for MtUp

MtUp needs both exactness and recall:
- Exactness for constraints like "Alice is unavailable for in-person events in July"
- Recall for prompts like "something chill like last time"
- Relationships for reasoning like "this venue was suggested for a Tallinn trip because Bob preferred walkability"

### Recommended Phased Rollout

#### Phase 1 (v1): SQL/Table-First Memory

Use structured records as the source of truth.

Focus on:
- Durable memory records with provenance + timestamps
- Querying by scope (group/person/proposal)
- Validity windows and memory status (`reported`, `confirmed`, etc.)
- Tool results stored separately with retrieval timestamps

This is the minimum system that supports auditability and reliable planning behavior.

#### Phase 2 (v2): Hybrid Semantic Retrieval

Add semantic search as a retrieval assist layer, not as the source of truth.

Use it for:
- Recalling relevant past conversations
- Finding similar prior proposals/events
- Ranking candidate memories before structured filtering or confirmation

Guardrails:
- Semantic hits should resolve back to structured records/messages
- Snookey should cite provenance and confidence, not treat vector similarity as fact

#### Phase 3 (v3): Rich Relationship Modeling

Add stronger graph-like relationship traversal (database choice can vary).

Use it for:
- Multi-hop reasoning across participants, places, and prior plans
- Explaining why a recommendation fits the group
- Tracking evidence chains from suggestion -> memory/search -> user confirmation

Important:
- "Graph-like" is a modeling requirement first; it does not require a graph database on day one
- We can begin with relational tables plus link tables and migrate later if needed

### A. Memory Model (Context Accumulation)

#### Principle A1: Store facts, not just messages

Conversation history is not enough. Snookey needs extracted, reusable facts.

Store both:
- Raw interactions (chat/messages/events)
- Structured memory records derived from interactions

#### Principle A2: Every memory needs provenance

Each stored memory should record:
- `who` provided it (participant, Snookey, external source)
- `when` it was observed
- `how` it was obtained (self-report, interview, search, inference)
- `scope` (person, group, proposal, place)

This keeps memory auditable and editable.

#### Principle A3: Distinguish stable vs time-sensitive memory

Not all context ages the same way.

Memory records should include a durability/recency classification:
- `durable`: preferences, recurring constraints, relationship context
- `seasonal`: temporary patterns (e.g., "busy in July")
- `ephemeral`: likely stale soon (travel plans, temporary closures, one-off constraints)

This classification determines refresh behavior and UI confidence.

#### Principle A4: Store uncertainty explicitly

Memory should support:
- `confirmed`
- `reported`
- `inferred`
- `needs_confirmation`
- `contradicted`

Snookey should not flatten uncertain information into hard truth.

#### Principle A5: Memory is editable and reversible

Users must be able to:
- Correct facts
- Expire facts
- Override inferred facts
- Remove outdated facts

Implementation consequence:
- Prefer append/update with status/versioning over destructive overwrite when possible.

### B. Retrieval + Tooling Model (Using Context Correctly)

#### Principle B1: Retrieve local memory before asking or searching

Default decision order:
1. Check proposal-specific context
2. Check group/person memory
3. Ask clarifying questions if key fields are missing
4. Use search tools when the answer depends on fresh external data

This reduces unnecessary search and improves continuity.

#### Principle B2: Search is for recency, memory is for continuity

Use memory for:
- Preferences
- Known constraints
- Prior choices
- Group norms

Use search/tools for:
- Restaurants/venues
- Opening hours
- Travel times
- Weather
- Time-sensitive availability of places/services

#### Principle B3: Separate retrieved memory from live search results in code and UI

Do not mix these into one undifferentiated blob.

Represent them as separate evidence types so Snookey can say:
- "I remember Alice prefers quiet places."
- "I found three restaurants open Friday after 8pm."

#### Principle B4: Retrieval should be scoped, not global

Fetch context by scope to avoid noisy prompts and incorrect assumptions:
- Proposal scope
- Group scope
- Participant scope
- Location scope
- Time window scope

#### Principle B5: Tool outputs must carry timestamps

Any external search/tool result should store:
- retrieval timestamp
- source
- query parameters (when useful)

This supports later debugging and freshness checks.

### C. Proposal State Model (Vague -> Concrete)

#### Principle C1: A proposal can be valid while incomplete

A proposal should not require full event details to exist.

Minimum viable proposal:
- Intent/title (e.g., "Trip to Tallinn")
- Creator
- Group

Everything else can be partial.

#### Principle C2: Track proposal completeness by fields, not a single binary state

Instead of only "draft/final", track progress per essential dimension:
- `time_status`: missing / candidate / narrowed / confirmed
- `place_status`: missing / candidate / narrowed / confirmed
- `participants_status`: open / collecting / settled
- `requirements_status`: unknown / partial / captured

This matches how real group planning evolves.

#### Principle C3: Separate proposal intent from logistics

Model at least two layers:
- Intent layer: what the group wants to do
- Logistics layer: when/where/how it could happen

This prevents vague ideas from being rejected just because logistics are not ready.

#### Principle C4: Represent options as first-class objects

Snookey should generate and compare candidates, not just rewrite text.

Examples:
- Candidate dates
- Candidate venues
- Candidate travel windows
- Candidate budgets / requirements

Each option should be linkable to evidence (memory or search result).

#### Principle C5: Convergence is a workflow, not a single action

Proposal refinement should support repeated loops:
1. Propose
2. Clarify
3. Generate options
4. Collect feedback/availability
5. Narrow
6. Confirm

The system should preserve artifacts from each step.

## Reference Data Shapes (v1 Sketch)

These are conceptual shapes for alignment, not final schema.

### Memory Record

- `id`
- `scope_type` (`person` | `group` | `proposal` | `place`)
- `scope_id`
- `fact_type` (availability_constraint, food_preference, budget_preference, location_preference, etc.)
- `value` (structured JSON/text)
- `status` (`reported` | `confirmed` | `inferred` | `needs_confirmation` | `contradicted`)
- `durability` (`durable` | `seasonal` | `ephemeral`)
- `valid_from` / `valid_to` (optional)
- `source_kind` (`user_message` | `interview` | `tool_result` | `manual_edit`)
- `source_ref` (message ID / tool run ID / etc.)
- `observed_at`
- `updated_at`

### Proposal (Intent + Logistics)

- `id`
- `group_id`
- `created_by`
- `title`
- `intent_type` (event, trip/stay, meal, outing, etc.)
- `intent_summary`
- `time_status`
- `place_status`
- `participants_status`
- `requirements_status`
- `candidate_times[]`
- `candidate_places[]`
- `requirements`
- `open_questions[]`
- `status` (`idea` | `exploring` | `narrowing` | `ready_for_confirmation` | `confirmed` | `archived`)

### Evidence Link (Why Snookey suggested something)

- `id`
- `proposal_id`
- `target_type` (candidate_time, candidate_place, recommendation, memory_fact)
- `target_id`
- `evidence_kind` (`memory` | `tool_result` | `participant_message`)
- `evidence_ref`
- `note`
- `captured_at`

## Design Implications (for Coding Sessions)

When building MtUp, prefer designs that:
- Support partial / incomplete proposals without forcing premature structure
- Preserve provenance (who said what, and when)
- Treat memory as editable and fallible, not absolute truth
- Separate durable memory from live search results
- Make uncertainty visible ("known", "assumed", "needs confirmation")
- Allow progressive refinement from idea -> proposal -> finalized event
- Model proposal state as partial, iterable, and evidence-backed
- Keep search/tool integrations replaceable behind stable interfaces

## Working Principle for Snookey

Snookey should act like a careful, context-hungry coordinator:
- It asks when context is missing
- It remembers when context is useful
- It searches when recency matters
- It helps the group converge on time and place

## Open Questions (to Refine Later)

- How should Snookey express confidence / uncertainty in recommendations?
- What permissions and visibility rules apply to stored participant context?
- What retention/expiration policy should apply to seasonal and ephemeral memory?
- What indexing/query strategy will retrieve the right memories without overloading prompts?
- What is the minimum v1 schema we can ship before introducing richer memory extraction?
