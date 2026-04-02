---
name: code-reviewer
description: Reviews code for quality, bugs, security issues, and consistency with project standards before any commit. Invoke before every /ship.
---

# Code Reviewer

## When to invoke
Before EVERY commit. Never commit without running this first.

## What to check
1. **Correctness** — does the code do what it's supposed to?
2. **No regressions** — does it break anything that was working?
3. **Security** — no hardcoded secrets, no SQL injection risks, no exposed PII
4. **Standards** — matches the project's coding conventions in CLAUDE.md
5. **JS/TS syntax** — run `node --check` on any JS files
6. **Commit message** — uses feat/fix/improve/chore prefix

## Output
Return a clear PASS or FAIL with specific issues listed.
If FAIL — fix the issues before committing.
If PASS — proceed with /ship.
