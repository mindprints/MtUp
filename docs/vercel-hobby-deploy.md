# Vercel Hobby Deployment Runbook

## Target Shape

- Frontend: Vite static build on Vercel
- Orchestrator: Vercel Node functions
- Data/auth: Supabase
- Outbound email: SMTP2GO
- Domain: `mtup.xyz`

## Runtime Endpoints

- `POST /ai/chat`
  - rewritten to `api/ai/chat.js`
- `GET /health`
  - rewritten to `api/health.js`

## Vercel Project Settings

- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install`
- Root directory: repository root

## Environment Variables

### Client-visible (`VITE_*`)

- `VITE_DATA_SOURCE=supabase`
- `VITE_SUPABASE_URL=<supabase project url>`
- `VITE_SUPABASE_ANON_KEY=<supabase anon key>`
- `VITE_AI_ASSISTANT_ENABLED=true`
- `VITE_ORCHESTRATOR_BASE_URL=`
  - leave blank when frontend and orchestrator share the same Vercel domain
- `VITE_THUMBNAIL_PROVIDER=openrouter`
- `VITE_THUMBNAIL_OPENROUTER_BASE_URL=https://openrouter.ai/api/v1`
- `VITE_THUMBNAIL_OPENROUTER_API_KEY=<openrouter key>`
- `VITE_THUMBNAIL_OPENROUTER_MODEL=google/gemini-3.1-flash-image-preview`

### Server-only

- `SUPABASE_URL=<supabase project url>`
- `SUPABASE_ANON_KEY=<supabase anon key>`
- `OPENROUTER_API_KEY=<openrouter key>`
- `OPENROUTER_MODEL=openai/gpt-4o-mini`
- `OPENROUTER_BASE_URL=https://openrouter.ai/api/v1`
- `SMTP2GO_API_KEY=<smtp2go key>`
- `NOTIFICATION_EMAIL_FROM=<noreply or controlled mailbox>`
- `NOTIFICATION_EMAIL_REPLY_TO=<controlled mailbox>`
- `APP_BASE_URL=<your-domain>`
  - The actual deployment or preview domain used for generating links in emails.

## Reply Policy

- Use a no-reply or tightly controlled sender mailbox.
- Do not rely on inbound replies for scheduling updates.
- Reminder and confirmation emails should direct users back to MtUp.
- If `NOTIFICATION_EMAIL_REPLY_TO` is set, point it at a mailbox someone intentionally monitors.

## Supabase Checklist

- `mtup.xyz` and the Vercel preview domain must be added to allowed origins if required by your auth setup.
- Production users and memberships must exist in the production project.
- SQL migrations in `docs/supabase/` must already be applied to the production database.

## First Deploy Sequence

1. Create/import the repo in Vercel.
2. Add all production environment variables.
3. Deploy to preview first.
4. Verify `GET /health` on the preview deployment.
5. Log in with a real production user.
6. Verify Snooky chat can reach `/ai/chat`.
7. Trigger reminder and confirmation flows with SMTP2GO enabled.
8. Promote to the production domain after those checks pass.

## Smoke Test Focus

- Login works with production Supabase credentials.
- Proposal list and availability reads work in `supabase` mode.
- AI proposal drafting works.
- Reminder email flow works from the deployed orchestrator.
- Confirmation email flow attaches the `.ics` file and links back to the site.
- Phone layout and swipe navigation still behave correctly on `mtup.xyz`.
