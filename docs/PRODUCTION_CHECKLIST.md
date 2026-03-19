# Production checklist — Iterate pipeline (Gemini)

Use this when running or deploying the **Iterate Winners** pipeline (Gemini: nanoBananaPro, geminiPromptBuilder, productCompositor, single-pass, `useCompositing: false`).

## Required to run the app

1. **Environment variables**  
   Copy `.env.example` to `.env` and set at least:
   - `DATABASE_URL` — TiDB/MySQL connection string
   - `JWT_SECRET` — session signing (min 32 chars)
   - `GOOGLE_AI_API_KEY` — **required for Iterate pipeline** (Gemini image generation). Server will not start if any code path loads `nanoBananaPro` without this key.
   - `ANTHROPIC_API_KEY` — Claude (analysis + brief for Iterate)
   - `FOREPLAY_API_KEY` — if using Foreplay ad picker
   - `CLICKUP_API_KEY` — if pushing tasks to ClickUp after approval

2. **Database**  
   Schema in `drizzle/schema.ts`. Apply migrations (or run `pnpm db:push`) before first run.

3. **Start**  
   - Dev: `pnpm dev` or `npm run dev`
   - Prod: `pnpm build` then `pnpm start` (or `node dist/index.js`)

## Required to run the Iterate pipeline end-to-end

- **GOOGLE_AI_API_KEY** — Gemini (nanoBananaPro) for image generation
- **ANTHROPIC_API_KEY** — Claude for Stage 1 (analyse winning ad) and Stage 2 (iteration brief)
- **DATABASE_URL** — store run, stages, and approvals
- **Product render** — at least one product render uploaded per product (Product Render Manager) so Stage 3 can pull the ONEST product image
- **S3/storage** — configured so generated images can be stored (Manus provides this in production)

Optional: **CLICKUP_API_KEY** if you want to push approved variations to ClickUp (Stage 4).

## Critical rules (do not change)

- `useCompositing` must stay `false` at all 4 call sites in `iterationPipeline.ts`.
- Image order to Gemini: Image 1 = reference ad (style only), Image 2 = ONEST product render.
- All Gemini `contents.push()` must use `role: "user"`.

## Tests

- `npm run test` — full suite. Uses `vitest.setup.ts` to set a dummy `GOOGLE_AI_API_KEY` so modules load; tests that need real API keys or DB skip when not configured.
- With a real `.env` (GOOGLE_AI_API_KEY, DATABASE_URL, JWT_SECRET, etc.), more tests run (e.g. auth login, pipeline.list, Foreplay sync, UGC).

## Debugging “can’t run pipeline”

1. Server won’t start: check for `GOOGLE_AI_API_KEY environment variable is not set` — set it in `.env`.
2. Stage 1/2 fail: check ANTHROPIC_API_KEY and that the source image URL is reachable (Claude gets it as base64).
3. Stage 3 fails: check GOOGLE_AI_API_KEY, product render exists for the selected product, and storage/S3 is configured for saving outputs.
