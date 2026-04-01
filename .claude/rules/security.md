# Security Rules

## Authentication & Authorization
- All mutating endpoints must use `protectedProcedure` or `adminProcedure` — never `publicProcedure`
- Admin-only operations (settings, destructive actions) must use `adminProcedure`
- The `/api/health/db` endpoint is intentionally public — do not add auth to it
- Never expose `OWNER_OPEN_ID` or JWT secrets in client code

## Input Validation
- Validate all tRPC inputs with Zod schemas — no raw `any` inputs in new procedures
- Sanitize string inputs before SQL (Drizzle parameterizes, but truncate to column limits)
- Validate file uploads: check MIME type, extension, and size before processing
- Validate URLs before passing to external services (Foreplay, Whisper, Magic Hour)

## Secrets
- All secrets live in `.env` and are accessed via `server/_core/env.ts` → `ENV`
- Never import `process.env` directly — always go through `ENV`
- Never log secrets, tokens, or API keys — even in error handlers
- Client-side env vars must be prefixed `VITE_` and contain no secrets

## File Handling
- Multer uploads go to memory storage — never write temp files to disk in production
- Storage keys must be namespaced (`ugc-uploads/`, `organic-videos/`) — no root-level writes
- Validate file extensions against allowlists before upload

## External Services
- Rate-limit calls to external APIs (Foreplay, Gemini, Whisper, ClickUp)
- Never trust external API responses without validation
- Log external API errors with context but without request/response bodies containing secrets
