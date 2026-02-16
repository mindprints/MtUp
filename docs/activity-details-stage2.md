# Activity Details Stage 2

This document describes the Stage 2 drill-down flow for a single activity proposal.

## Scope

Stage 1 remains date availability on the main calendar.
Stage 2 adds focused decision-making for one selected proposal:

- Time
- Place
- Requirements

## Voting Modes

Each decision dimension can use one of:

- `single`: one option per user
- `multi`: multiple options per user
- `ranked`: ordered preferences

Current defaults:

- `time`: single
- `place`: single
- `requirement`: multi

## Informational Voting (No Forced Winner)

Voting analytics are informational only:

- support percentages
- first-choice counts
- ranked scores
- top candidate list

No option is auto-selected by the system.

## Confirmation Policy

Confirmations are explicit, manual actions.

Only these roles can confirm:

- proposal creator
- admin

A confirmation record stores:

- who confirmed
- when
- which option(s)
- optional note

## Sejour Overlap Behavior

For `sejour` proposals in the `time` tab:

- users can generate overlap-window options from shared availability
- candidate windows include date range, nights, and participant count
- generated windows are added as normal decision options and can be voted on

If no overlap windows exist, the UI reports that more date availability is needed.
