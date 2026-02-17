# Plan 2: Deployment Strategy (Dokploy VPS + Vercel Free Alternative)

## Objective
Define a production-ready deployment path on Dokploy-managed VPS, with Vercel Free as a low-friction alternative for frontend hosting.

## Current Reality
- App is currently frontend-only (Vite build output).
- Supabase (Plan 1) can host database/auth externally.
- If backend services are added later (AI orchestrator/webhooks), deployment must support server runtime.

## Option A: Dokploy on VPS (Primary)

## Recommended Use
- Full-stack control, custom services, long-running workers, cron jobs, Slack webhooks, AI orchestration.

## Infrastructure
- VPS with Docker + Dokploy.
- Reverse proxy + TLS.
- Separate services:
  - `web` (frontend static or SSR app)
  - `worker` (optional, AI/background jobs)
  - `scheduler` (optional reminders/cron)

## Deployment Steps
1. Provision VPS and install Dokploy.
2. Configure domain + DNS.
3. Add project in Dokploy from Git repo.
4. Define build/start commands or Dockerfile.
5. Add environment variables (Supabase URL/key, Slack, AI keys).
6. Configure health checks and restart policy.
7. Add staging and production environments.
8. Enable backup policy for configs + logs.

## CI/CD
- GitHub Actions:
  - lint/test/build
  - deploy on `main` merge to Dokploy.
- Require build success before deploy.

## Monitoring
- Structured app logs.
- Uptime checks.
- Error tracking (Sentry recommended).

## Option B: Vercel Free (Alternative)

## Recommended Use
- Fast launch for frontend app with minimal ops.
- Best paired with Supabase for backend services.

## Constraints
- Function/runtime limits on free plan.
- Not ideal for heavy background workers or persistent jobs.

## Deployment Steps
1. Import repo to Vercel.
2. Configure project as Vite/static deployment.
3. Set env vars for Supabase and public config.
4. Add preview/production environments.
5. Configure custom domain.

## When to Choose Which
- Choose Dokploy if:
  - You need Slack event webhooks + background workflows + orchestrator services.
  - You want single-platform control over multiple containers.
- Choose Vercel Free if:
  - You want fastest deployment path for frontend and can keep backend external.

## Security Baseline (Both Options)
- No secrets in client bundle.
- Separate public vs server-only keys.
- CSP and secure headers.
- Least-privilege keys and key rotation.

## Cost/Complexity Summary
- Dokploy VPS:
  - Higher setup complexity.
  - Better long-term flexibility for orchestrator + Slack automation.
- Vercel Free:
  - Lowest setup friction.
  - More limits as backend complexity grows.

## Deliverables
- Deployment manifests/config.
- Environment variable matrix.
- CI/CD workflow.
- Runbook for rollback and incident response.

## Success Criteria
- Repeatable deploy in <15 minutes from clean commit.
- Separate staging + production.
- Health checks and logs available.
