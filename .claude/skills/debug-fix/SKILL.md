---
name: debug-fix
description: Infrastructure-first debugging for PerformCreative — diagnose, find root cause, fix, and verify.
user-invocable: true
allowed-tools: Read, Grep, Glob, Bash, Edit, Write, Agent
---

# Debug-Fix Workflow

## Iron Rule: No fixes without root cause.

## Phase 1: Infrastructure Check (always first)
1. Hit diagnostic endpoint: `curl -s https://www.performcreative.io/api/health/db | python3 -m json.tool`
2. Check: are all 12 required tables present?
3. Check: is the latest code deployed? (`git log --oneline -1` vs production)
4. Check: were migrations run? (missing tables = migrations not run)
5. Check: is the database reachable? (health endpoint returns 503 = connection issue)

If infrastructure is the problem, fix that first (run migrations, check env vars, etc.)

## Phase 2: Reproduce
1. Identify the exact error (HTTP status code, error message, console output)
2. Find the relevant code path:
   - 500 on `/api/trpc/*` → trace through `server/routers.ts` → relevant router → service
   - Client error → check browser console → trace tRPC call → backend
   - Pipeline stuck → check pipeline_runs status/stage → trace service logic
3. Read the relevant source files

## Phase 3: Root Cause Analysis
1. Form a hypothesis based on the evidence
2. Verify the hypothesis (read code, check data, test locally)
3. Document the root cause before writing any fix

## Phase 4: Fix
1. Make the minimal fix that addresses the root cause
2. Run `pnpm check` and `pnpm test` to verify no regressions
3. If the fix involves a schema change, remind about `pnpm db:push`

## Phase 5: Verify
1. Test the fix locally if possible
2. Hit the health endpoint again to confirm infrastructure is healthy
3. Report what was wrong, what was fixed, and any follow-up actions needed

## Post-Fix: Store the Lesson
If Ruflo MCP is available:
- `mcp__ruflo__memory_store` with namespace=performcreative
- `mcp__ruflo__hooks_intelligence_pattern-store` with type=error-recovery
