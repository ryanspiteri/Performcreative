# Project TODO

## Active

- [ ] [P1] Structured logging for competitor ad pipeline — entry/exit logs in analyseCompetitorAd and generateCompetitorIterationBrief, plus WARNING when brief JSON parse falls back
- [ ] [P2] SSRF mitigation — analyseCompetitorAd fetches imageUrl via axios with no domain allowlist; add check for Foreplay CDN / S3 domains only

## Completed (current session)

- [x] Extract shared utils (_shared.ts): withTimeout, claudeClient, callClaude, STEP_TIMEOUT, VARIATION_TIMEOUT, buildProductInfoContext
- [x] Consolidate Claude API client — single claudeClient in _shared.ts replaces 3 duplicate axios.create() blocks
- [x] Extract buildProductInfoContext helper — shared across all pipelines
- [x] Remove dead service files: bannerbear.ts, fluxPro.ts, productCompositor.ts, geminiImage.ts, imageCompositing.ts
- [x] Remove dead test files: image-pipeline.test.ts, gemini-image.test.ts, api-keys.test.ts, bannerbear-validation.test.ts
- [x] Remove dead Bannerbear router endpoints (3 routes)
- [x] Remove dead two-pass compositing branch from nanoBananaPro.ts
- [x] Migrate childVariationGeneration.ts from geminiImage to nanoBananaPro
- [x] Move ImageSelections type to _shared.ts (single source of truth)
- [x] Fail explicitly on AI errors: iteration brief parse, iteration brief generation, video brief parse (no silent fallbacks)
- [x] Add concurrency=2 to variation generation in static + iteration pipelines (runWithConcurrency helper)
- [x] Add tests for product render DB functions (getDefaultProductRender, getProductInfo)
- [x] Add tests for runWithConcurrency helper (concurrency, ordering, errors, empty)
- [x] Clean up todo.md — archived 1500+ lines of historical rounds

## Historical

Previous rounds (1–15) archived. See git history for full todo.md prior to cleanup.

Key milestones:
- Rounds 1–4: Initial pipeline (video + static), Foreplay integration, Whisper transcription
- Rounds 5–8: Product render manager, product info hub, user selection gate
- Rounds 9–12: Compositing fixes, Foreplay sync, Puppeteer text rendering
- Rounds 13–15: Two-pass compositing experiment → reverted to single-pass
- Rounds 16–26: Bannerbear (removed), Gemini integration, iterate winners, headline bank
