# Perform Creative — Claude Code Context

## Project
AI-powered performance ad creative tool. Generates, tests, and varies ad creatives at scale. Potential SaaS product.

## Tech Stack
- Check current repo for actual stack
- Hosting: DigitalOcean App Platform

## Purpose
- Ad generation and creative testing
- UGC-style creative at scale
- Variation engine (preserves composition, varies copy/backgrounds)
- Integration with Meta Ads

## Development Rules
- Always run /review before /ship
- Commit messages: feat/fix/improve/chore prefix
- Run node --check on JS before committing

## Key Commands
- /review — code review
- /ship — commit and push
- /qa — test UI


## Design System

Always read DESIGN.md before making any visual or UI decisions. All font choices, colors, spacing, border radius, and aesthetic direction are defined there. Do not deviate without explicit user approval. In QA and code review mode, flag any code that doesn't match DESIGN.md. Known drift is documented in DESIGN.md "Drift to Migrate" section — migrate incrementally, not in big-bang refactors.

## Email Access Rule — CRITICAL

When accessing any Gmail inbox via IMAP:
- ALWAYS use `BODY.PEEK[]` or `BODY.PEEK[HEADER]` — NEVER use `RFC822`
- NEVER mark any email as read
- NEVER call `mail.store(eid, '+FLAGS', '\Seen')`
- Emails must remain in exactly the same read/unread state as before you accessed them
