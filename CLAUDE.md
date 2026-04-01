# PerformCreative

Ad creative and organic content platform for ONEST Health / Ryan Spiteri.

## Stack
- **Frontend:** React + Vite + Shadcn UI + Wouter
- **Backend:** Express + tRPC
- **Database:** MySQL (DigitalOcean) + Drizzle ORM
- **Build:** `pnpm build` (Vite client + esbuild server → `dist/`)
- **Dev:** `pnpm dev` (tsx watch + Vite dev server, port 3000)

## Deployment
- Platform: DigitalOcean App Platform
- Dashboard: https://cloud.digitalocean.com/apps/a54792a1-f21a-472a-bd42-e06470213a62?i=097187
- Production URL: https://www.performcreative.io/
- Auto-deploy: yes (pushes to main)
- Migrations: `pnpm db:push` (must run manually post-deploy)
- Diagnostic endpoint: `GET /api/health/db` — checks DB connectivity + all 12 tables exist

## Debugging — Check Infrastructure First
When any API endpoint returns 500/502/503/504:
1. Hit the diagnostic endpoint — are all required tables present?
2. Check if the latest code is actually deployed
3. Check if migrations ran successfully
4. Only THEN investigate application code

## Self-Learning (Ruflo)
After resolving any bug or outage:
1. `mcp__ruflo__memory_store` — store the lesson (namespace = performcreative)
2. `mcp__ruflo__hooks_intelligence_pattern-store` — store the pattern for auto-matching
Before debugging: search `mcp__ruflo__memory_search` and `mcp__ruflo__hooks_intelligence_pattern-search` for existing solutions first.
