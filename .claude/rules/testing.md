---
paths:
  - "**/*.test.ts"
  - "vitest.config.ts"
  - "vitest.setup.ts"
---
# Testing Rules

## Framework
- Vitest for all tests — config in `vitest.config.ts`, setup in `vitest.setup.ts`
- Run with `pnpm test` (vitest run)

## Test Files
- Co-locate test files with source: `server/foreplay.test.ts` tests `server/services/foreplay.ts`
- Name pattern: `<feature>.test.ts`

## Patterns
- Test tRPC procedures by calling the service functions directly (not HTTP)
- Mock external APIs (Foreplay, Gemini, Whisper) — never hit real APIs in tests
- Use `vi.mock()` for module mocks, `vi.fn()` for function mocks
- Test DB operations against a real DB connection when possible, mock `getDb()` when not

## What to Test
- Pipeline service logic (input validation, state transitions, error handling)
- tRPC input validation (Zod schemas reject bad input)
- DB helper edge cases (upsert conflicts, missing records)
- Do NOT test Shadcn UI components or simple React rendering
