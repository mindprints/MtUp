# Plan 4: Slack Integration (Messaging, Reminders, Notifications)

## Objective
Use Slack as the primary messaging channel for activity communications, reminders, and lightweight interactions.

## Scope
- Outbound notifications from app to Slack:
  - proposal created/updated
  - voting window reminders
  - confirmation completed
  - sejour overlap window suggestions
- Inbound Slack commands/actions:
  - quick status checks
  - reminder triggers
  - optional vote links and deep links back to app

## Slack App Design
- Bot token with minimum scopes.
- Slash commands:
  - `/mtup status`
  - `/mtup remind`
  - `/mtup proposals`
- Interactive components:
  - buttons for open details/deeplink
  - optional modal for admin reminder composition

## Integration Architecture
- Webhook/event endpoint (server-side).
- Signature verification for Slack requests.
- Job queue for reminder fan-out and retries.
- Message templates versioned in code.

## Channel Strategy
- Per-group channel mapping:
  - `group_id -> slack_channel_id`.
- Optional per-proposal thread tracking for continuity.

## Reminder Engine
- Trigger types:
  - scheduled daily digest
  - pre-deadline reminders
  - missing-vote nudges
- Respect quiet hours and user timezone preferences.

## Security and Compliance
- Verify `X-Slack-Signature` + timestamp.
- Encrypt tokens at rest.
- Restrict admin-only commands.
- Audit every outbound and inbound action.

## UX Rules
- Slack handles messaging, app handles data edits and rich interaction.
- Slack messages should include:
  - concise summary
  - CTA button linking to exact proposal/detail tab
  - clear actor labels (`Me` in app UI, real display name in Slack)

## Rollout Phases
1. Outbound-only notifications.
2. Slash commands for read-only status.
3. Admin reminder controls in Slack.
4. Optional interactive workflows.

## Testing Plan
- Local Slack tunnel test (dev).
- Signature verification tests.
- Retry/idempotency tests for duplicate events.
- Permission tests by Slack user mapping.

## Risks and Mitigations
- Notification noise:
  - digest mode + threshold rules.
- Identity mismatch:
  - explicit Slack user <-> app user mapping flow.
- Delivery failures:
  - retry queue + dead-letter logging.

## Deliverables
- Slack app manifest.
- Webhook/event handling service.
- Reminder scheduler and templates.
- Admin settings for channel/user mapping.

## Success Criteria
- Reliable message delivery with traceable logs.
- Admin can trigger reminders from app and Slack.
- Users receive actionable, low-noise updates.
