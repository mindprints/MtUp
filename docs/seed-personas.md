# Snooky Seed Personas (Fictional, Dev/Test Only)

## Purpose

This project includes a dev/test seeding flow for five fictional Stockholm-based participants.

The goal is to make it easier to test:
- Snooky memory accumulation
- Memory retrieval and citations
- Vague-to-concrete proposal refinement
- Group suggestions when users do not provide specific time/place details

## Important Guardrails

- These personas are fictional seed data, not real participant truth.
- Seeded records are tagged with:
  - `sourceKind = manual_seed`
  - `fictionalSeed = true`
- Seed data is intended for product development and testing only.
- Seed memories should remain editable/dismissable in the UI.

## What Gets Seeded

The "Seed 5 Stockholm Personas" action creates memory records for:
- Five fictional participants (Alice, Bob, Charlie, Diana, Eve)
- Shared group-level context (Stockholm neighborhoods, budget norms, planning style)

Record categories include examples of:
- Availability constraints and recurring patterns
- Time preferences
- Food / venue / activity preferences
- Budget and trip-style preferences
- Group norms

## How to Use (Manual Test Flow)

1. Open Snooky (`Snooky` tab).
2. In the memory panel, click `Seed 5 Stockholm Personas`.
3. Open `Memory Explorer` to confirm seeded records are present.
4. Try prompts from the in-app `Testing Prompts (v1)` panel.
5. Add your own availability messages to test memory capture:
   - "I can't do Wednesdays in person this month."
   - "I'm free after 7pm on Tuesdays."
6. Confirm / edit / dismiss memory records and verify behavior changes.

## Recommended Test Prompts

- "Any ideas for a casual group dinner in Stockholm next week?"
- "Who seems available on Thursdays after 6:30pm?"
- "What should we keep in mind before proposing a weeknight meetup?"
- "Do you remember any group budget preferences for dinner?"
- "Something chill like last time, but near transit."

## Maintenance Notes

- Update `src/lib/memorySeeds.ts` to revise seed personas or group norms.
- Keep seeded records realistic enough for testing, but generic enough to avoid encoding real personal data.
- Prefer adding provenance-rich facts over long narrative bios.

## Future Improvement (Optional)

Add a "Promote Seed -> Confirmed Memory" flow so a seeded fact can be explicitly adopted as real user-provided context after confirmation.
