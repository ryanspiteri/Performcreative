---
name: ship
description: Run tests, type-check, commit, push, and create PR for PerformCreative changes.
user-invocable: true
allowed-tools: Read, Grep, Glob, Bash, Agent
---

# Ship Workflow

## Steps

### 1. Pre-flight checks
Run in parallel:
- `pnpm check` — TypeScript type checking
- `pnpm test` — Vitest test suite

If either fails, stop and report the errors. Do not ship broken code.

### 2. Review changes
- Run `git diff --stat` to see what changed
- Run `git diff` to review the actual changes
- Check for:
  - Secrets or `.env` files accidentally staged
  - `console.log` debug statements that should be removed
  - `any` types that could be tightened
  - Missing health check table updates (if new tables added)

### 3. Commit
- Stage relevant files (avoid `.env`, `node_modules`, `dist/`)
- Write a concise commit message following existing style (see `git log --oneline -10`)
- Commit format: `type: description` (feat, fix, refactor, test, docs, chore)

### 4. Push
- Push to the current branch (create branch if on main and changes are non-trivial)
- For feature work: `git checkout -b feat/description` before committing

### 5. Create PR
- Use `gh pr create` with:
  - Short title (under 70 chars)
  - Body with Summary and Test Plan sections
- Report the PR URL when done

### 6. Post-ship
- Remind: migrations must run manually post-deploy (`pnpm db:push`) if schema changed
- Remind: auto-deploy triggers on push to main
