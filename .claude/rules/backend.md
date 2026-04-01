---
paths:
  - "server/**/*.ts"
---
# Backend Rules

## tRPC Procedures
- Define procedures in `server/routers.ts` or sub-routers in `server/routers/`
- Use `protectedProcedure` for authenticated endpoints, `adminProcedure` for admin-only
- Always define Zod input schemas — avoid `.input(z.any())`
- Use `superjson` transformer (already configured) — Date objects serialize automatically
- Return plain objects, not Drizzle row references

## Database Access
- All DB queries go through helper functions in `server/db.ts`
- Always call `await getDb()` and check for null before querying
- Use `(result as any)[0]?.insertId` pattern for MySQL insert IDs
- Use `onDuplicateKeyUpdate` for upserts (MySQL-specific)
- Sanitize/truncate string data to column varchar limits before insert

## Services
- Business logic lives in `server/services/` — one file per pipeline/integration
- Services import from `server/db.ts` for data access and `server/storage.ts` for files
- Long-running operations (transcription, generation) run in background IIFEs with try/catch
- Update status fields to track pipeline progress (`pending` → `running` → `completed`/`failed`)

## Error Handling
- Let tRPC handle HTTP error codes via `TRPCError`
- Log errors with `[ServiceName]` prefix for grep-ability
- Never swallow errors silently — at minimum `console.error` with context

## Environment
- Access config via `ENV` from `server/_core/env.ts` — never raw `process.env`
- Check required env vars at startup where possible
