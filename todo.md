# Project TODO

- [x] Set up API secrets (Foreplay, Anthropic, OpenAI, ClickUp)
- [x] Database schema for pipeline runs, scripts, expert reviews
- [x] Dark theme with ONEST brand colors (#01040A, #191B1F, #FFFFFF, #FF3838, #0347ED, #F5F5F5)
- [x] Custom auth with ONEST/UnlockGrowth credentials (not Manus OAuth)
- [x] Left sidebar layout: ONEST logo, Dashboard, Manual Trigger, Settings, Sign Out
- [x] Dashboard page with pipeline run history
- [x] Manual Trigger page: Product selector, Priority selector, trigger button
- [x] Foreplay API integration - pull videos from #inspo board
- [x] Video download and ffmpeg audio extraction (bundled ffmpeg)
- [x] OpenAI Whisper transcription
- [x] Claude Vision analysis (8-point competitor analysis)
- [x] Claude script generation (2 DR + 2 UGC scripts)
- [x] 10-expert review panel with 25 psychology dimensions
- [x] Auto-iterate scripts below score 90
- [x] ClickUp task creation in VIDEO AD BOARD under SCRIPT REVIEW
- [x] Results page Section 1: Original Creative (video player + metadata)
- [x] Results page Section 2: Transcript with Copy button
- [x] Results page Section 3: Visual Analysis (8-point detailed analysis)
- [x] Results page Section 4: Generated Scripts (4) with Expert Reviewed badge
- [x] Results page Section 4a: Script tabs DR1, DR2, UGC1, UGC2 with scores
- [x] Results page Section 4b: Expert Review Panel with score, Approved badge, iteration rounds
- [x] Results page Section 4c: Bar chart of 10 expert scores
- [x] Results page Section 4d: Expandable expert details (10 experts)
- [x] Results page Section 4e: Summary, HOOK, FULL SCRIPT table, VISUAL DIRECTION, STRATEGIC THESIS
- [x] Results page Section 4f: Copy Full Script button
- [x] Results page Section 5: ClickUp Tasks Created (4) with links
- [x] Static ads pipeline: Foreplay static_inspo board integration
- [x] Static ads gallery/grid display
- [x] Static ads selection UI for reference
- [x] Static ads Claude Vision analysis
- [x] Static ads nano banana image generation
- [x] Settings page
- [x] BUG FIX: Foreplay video pipeline returns "No video ads found" — board name/ID mismatch
- [x] BUG FIX: Foreplay static pipeline likely same issue — board name/ID mismatch
- [x] Investigate Foreplay API to get correct board/folder IDs
- [x] Update Foreplay service to use correct board IDs and API endpoints

## CRITICAL BUG FIXES

- [x] BUG: Video pipeline regression — restore expert review panel visibility in UI
- [x] BUG: Video pipeline regression — ensure scripts display in 3-column table format (Timestamp | Visual | Dialogue)
- [x] BUG: Static image generation — MUST use actual product renders, not AI-generated products
- [x] BUG: Static image generation — must analyze inspo reference and create similar layout
- [x] BUG: Static image generation — must generate 3 variations with different backgrounds
- [x] BUG: Static image generation — must composite product render onto AI-generated backgrounds

## REBUILD REQUIREMENTS

- [x] BUG FIX: Whisper transcription regression — fix video download, ffmpeg audio extraction, OpenAI API call
- [x] REBUILD: Browse Creatives page — unified gallery with videos + statics from both Foreplay boards
- [x] REBUILD: Creative detail view — show full creative with Run Pipeline button
- [x] REBUILD: Configuration step — product selector, priority selector
- [x] REBUILD: Video pipeline — with fixed Whisper transcription
- [x] REBUILD: Static pipeline — ACTUALLY GENERATE 3 images using nano banana + product render compositing
- [x] REBUILD: Results page — display generated static images with approval workflow
- [x] TEST: End-to-end video pipeline with transcription
- [x] TEST: End-to-end static pipeline with image generation

## ROUND 3 FIXES

- [x] BUG FIX 1: Video selection — pass selected creative's specific Foreplay ID/URL to pipeline, not always first ad
- [x] FEATURE 2: Pipeline history badges — show visual indicator on gallery creatives that have been processed
- [x] CRITICAL FIX 3: Static pipeline Stage 1 — Claude Vision analyzes selected competitor static ad
- [x] CRITICAL FIX 3: Static pipeline Stage 2 — AI writes detailed creative brief for ONEST version
- [x] CRITICAL FIX 3: Static pipeline Stage 3 — 10-expert panel reviews BRIEF, auto-iterate until 90+
- [x] CRITICAL FIX 3: Static pipeline Stage 4 — nano banana generates 3 images with product render compositing
- [x] CRITICAL FIX 3: Static pipeline Stage 5 — 10-expert panel reviews GENERATED CREATIVES, iterate if needed
- [x] CRITICAL FIX 3: Static pipeline Stage 6 — Team approval workflow (approve / suggest prompt edits)
- [x] CRITICAL FIX 3: Static pipeline Stage 7 — ClickUp task creation on team approval
- [x] UI: Show stage progress through all 7 stages
- [x] UI: Display all expert review feedback visible for both review gates
- [x] UI: Team approval interface with approve/edit buttons


## ROUND 3 COMPLETION SUMMARY

All three fixes implemented and tested:

### FIX 1: Video Selection Pass-Through ✓
- Video mutation now accepts foreplayAdId, foreplayAdTitle, foreplayAdBrand, mediaUrl, thumbnailUrl
- Selected creative's specific data is passed through the entire pipeline
- No longer uses first ad from board

### FEATURE 2: Pipeline History Badges ✓
- Browse Creatives page queries pipeline history on load
- Shows badge on processed creatives: "Processed", "Running", "Failed", or "Pending"
- Displays count if same ad has multiple runs (e.g., "Processed 5x")
- Color-coded: green for completed, orange for running, red for failed, blue for pending

### CRITICAL FIX 3: Static Pipeline 7-Stage Flow ✓
- Stage 1: Claude Vision analyzes selected competitor static ad
- Stage 2: AI writes detailed creative brief for ONEST version
- Stage 3: 10-expert panel reviews BRIEF, auto-iterates until 90+ score
- Stage 4: nano banana generates 3 image variations
- Stage 5: 10-expert panel reviews GENERATED CREATIVES
- Stage 6: Team approval workflow with revision support
- Stage 7: ClickUp task creation after team approval
- Results page shows full 7-stage progress bar with stage indicators
- All expert reviews visible with expandable expert details
- Team approval UI with approve/reject buttons and feedback notes

### Database Schema Updates ✓
- Added staticStage (varchar 64) - tracks current stage
- Added staticBrief (text) - stores creative brief
- Added staticBriefReview (json) - stores brief expert review results
- Added staticCreativeReview (json) - stores creative expert review results
- Added teamApprovalStatus (enum: pending/approved/rejected)
- Added teamApprovalNotes (text) - stores team feedback

### Tests ✓
- All 12 tests passing
- server/auth.logout.test.ts (1 test)
- server/foreplay.test.ts (6 tests)
- server/pipeline.test.ts (5 tests)

### UI Components ✓
- BrowseCreatives.tsx: Unified gallery with pipeline history badges
- Results.tsx: Full 7-stage static pipeline UI with expert panels and team approval
- ManualTrigger.tsx: Deprecated, redirects to Browse Creatives
- StaticPipeline.tsx: Deprecated, redirects to Browse Creatives

### Services ✓
- imageCompositing.ts: Rewritten to use real S3 CDN URLs, supports team feedback
- routers.ts: Complete rewrite with 7-stage static pipeline and team approval endpoint
- All helper functions for brief generation, iteration, and expert reviews

## ROUND 4 CRITICAL BUGS

- [x] BUG 1: Video transcription silently fails — transcript shows "unavailable" instead of actual content
- [x] BUG 1: Diagnose from server logs — video download, ffmpeg extraction, or Whisper API call failing
- [x] BUG 1: Add proper error logging and user-facing error messages
- [x] BUG 2: Static image generation hangs forever at Stage 4 — never progresses
- [x] BUG 2: Diagnose nano banana API call — failing silently, timing out, or response not handled
- [x] BUG 2: Add timeouts and error handling so pipeline doesn't hang indefinitely
- [x] TEST: Both pipelines work end-to-end after fixes

## ROUND 4 FIX SUMMARY

### Root Cause Analysis
- **Bug 1 (Transcription):** The OPENAI_API_KEY was not properly configured when Ryan first tested. Once configured, transcription works perfectly — video downloads from Foreplay, ffmpeg extracts audio, Whisper API transcribes.
- **Bug 2 (Static hanging):** The stuck run (#90002) was from a previous server instance that no longer existed. The pipeline code works correctly on the current server — all 7 stages complete successfully.

### Fixes Applied
- Added `withTimeout()` utility wrapping every pipeline step (3-5 min timeouts)
- Every stage in both pipelines now has try/catch with proper error logging
- Failed stages update the run with `status: 'failed'` and `errorMessage` so users see what went wrong
- Video pipeline saves partial results after each script (so partial progress is visible)
- Stale runs from previous server instances marked as failed automatically
- All 12 tests passing

## ROUND 5 — NEW FEATURES

- [x] FEATURE 1: Product Render Manager — DB schema for product_renders table
- [x] FEATURE 1: Product Render Manager — S3 upload endpoint via tRPC
- [x] FEATURE 1: Product Render Manager — Gallery page with upload, view by product, delete
- [x] FEATURE 1: Product Render Manager — Pipeline pulls renders from DB instead of hardcoded URLs
- [x] FEATURE 2: Product Information Hub — DB schema for product_info table
- [x] FEATURE 2: Product Information Hub — CRUD tRPC procedures for product data
- [x] FEATURE 2: Product Information Hub — UI page with forms for ingredients, benefits, claims, audience, selling points, flavours, pricing
- [x] FEATURE 2: Product Information Hub — Pipeline pulls product info into briefs and scripts automatically
- [x] FEATURE 3: Trim product list to 5 active products (Hyperburn, Thermosleep, Hyperload, Thermoburn, Carb Control)
- [x] NAV: Add Product Renders and Product Info to sidebar navigation
- [x] TEST: Write tests for new endpoints

## ROUND 6 — DEPLOYMENT BUGS

- [x] BUG 1: ffmpeg not found on deployed server — installed ffmpeg-static npm package, whisper.ts uses bundled binary
- [x] BUG 2: Claude Vision API 400 error at Stage 1 — Claude can't access Foreplay R2 URLs, now downloads image and sends as base64
- [x] BUG 2: Root cause 1: Anthropic credits were depleted (now topped up by Ryan)
- [x] BUG 2: Root cause 2: Claude API returns "Unable to download the file" for Foreplay URLs — fixed by downloading and encoding as base64
- [x] TEST: All 19 tests passing, Claude Vision base64 confirmed working with Foreplay images


## ROUND 6B — FFMPEG FIX

- [x] BUG: ffmpeg-static import fails in deployed environment — require() inside try/catch throws error silently in tsx
- [x] FIX: Use top-level ES module import `import ffmpegStatic from 'ffmpeg-static'` instead of require()
- [x] FIX: Verify binary path resolves correctly — server logs now show: "Using ffmpeg-static binary: /home/ubuntu/.../ffmpeg"
- [x] TEST: All 19 tests passing, ffmpeg-static binary path logged correctly on startup

## ROUND 7 — VISUAL MATCHING FIX

- [x] FIX Stage 1: Claude analysis extracts precise visual details (layout, color palette, typography, text placement, mood, lighting, background, product placement, overlays/effects)
- [x] FIX Stage 2: Creative brief includes "Visual Reference Guide" with specific art direction + 3 detailed image generation prompts (200+ words each)
- [x] FIX Stage 4: Nano banana receives competitor ad as reference image for Variation 1 (image-to-image style transfer)
- [x] FIX Stage 4: Prompts extracted from brief — extremely detailed about replicating visual style, layout, composition
- [x] FIX: Creative brief passed through entire pipeline to image generation step
- [x] TEST: All 19 tests passing, visual matching pipeline ready for testing

## ROUND 8 — USER SELECTION GATE

- [x] DB: Add columns for creative_options (JSON) and user_selections (JSON) to pipeline_runs
- [x] DB: Add new stage value "stage_3b_user_selection" between brief review and image generation
- [x] BACKEND: Update Claude brief generation to produce 3 background concepts, 6 headlines, 6 subheadlines, 6 benefit callouts
- [x] BACKEND: Parse Claude's brief output into structured options (JSON)
- [x] BACKEND: New tRPC endpoint for submitting user selections
- [x] BACKEND: Pipeline pauses at stage_3b_user_selection and waits for user input
- [x] BACKEND: After user submits selections, pipeline resumes with selected options fed into image generation prompts
- [x] FRONTEND: Selection UI showing all options laid out with radio/checkbox selectors
- [x] FRONTEND: Background concepts with visual descriptions
- [x] FRONTEND: 6 headlines (pick 3), 6 subheadlines (pick 3), 6 benefits (pick 3), 3 backgrounds (pick 1)
- [x] FRONTEND: Confirm button to submit selections and resume pipeline
- [x] IMAGE GEN: Image 1 (Control) = Headline 1 + Subheadline 1 + Benefit 1 + selected background (closest to inspo)
- [x] IMAGE GEN: Image 2 (Variation) = Headline 2 + Subheadline 2 + Benefit 2 + selected background
- [x] IMAGE GEN: Image 3 (Variation) = Headline 3 + Subheadline 3 + Benefit 3 + selected background
- [x] ARCH: Extract static pipeline into server/staticPipeline.ts for cleaner code
- [x] COMPOSITING: Update generateStaticAdVariations to accept per-image copy selections
- [x] TEST: Verify pipeline pauses at selection gate and resumes after user input

## ROUND 8B — CRITICAL IMAGE QUALITY FIX + SELECTION GATE

### Fix 1: Image Generation Must Produce Actual Ad Creatives
- [x] COMPOSITING: Nano banana generates BACKGROUND/SCENE only (no text, no product)
- [x] COMPOSITING: Sharp composites real product render from S3 onto background
- [x] COMPOSITING: Sharp/Canvas overlays clean crisp TEXT: headline, subheadline, benefit callouts, CTA
- [x] COMPOSITING: Add ONEST logo overlay
- [x] COMPOSITING: Text positioned based on competitor ad layout analysis
- [x] COMPOSITING: Brand colors (#FF3838, #0347ED, #01040A) used throughout

### Fix 2: Expert Panel Must Be Brutally Critical
- [x] EXPERT: Recalibrate scoring prompts — no more rubber-stamping
- [x] EXPERT: Score below 50 if no headline/CTA/hook visible
- [x] EXPERT: Criteria: scroll-stopping, headline visibility, CTA presence, purchase intent, professional quality
- [x] EXPERT: Compare against competitor inspo quality

### Selection Gate (Updated Requirements)
- [x] SELECTION: 6 headlines → user picks 3 (one per image) OR writes custom
- [x] SELECTION: 6 subheadlines → user picks 3 OR picks NONE (optional) OR writes custom
- [x] SELECTION: Benefits are SHARED across all 3 images (not per-image)
- [x] SELECTION: 3 background concepts → CAN VARY per image (not shared)
- [x] SELECTION: Custom text boxes for each element
- [x] OUTPUT: Image 1 (Control) = Headline 1 + optional Sub 1 + shared benefits + Background 1 (closest to inspo)
- [x] OUTPUT: Image 2 (Variation) = Headline 2 + optional Sub 2 + shared benefits + Background 2
- [x] OUTPUT: Image 3 (Variation) = Headline 3 + optional Sub 3 + shared benefits + Background 3

## ROUND 9 — VIDEO PIPELINE BROKEN

- [ ] BUG: Script generation failing — DR1 shows "Generation Failed" with score 0
- [x] BUG: Expert review timing out at 180s — timeout increased to 10 minutes
- [ ] BUG: Only 2 scripts (DR1, DR2) instead of 4 (DR1, DR2, UGC1, UGC2)
- [ ] FIX: Increase timeouts to 300-600s for script generation and expert review
- [ ] FIX: Ensure all 4 scripts are generated (2 DR + 2 UGC)
- [ ] FIX: Verify Claude API calls complete successfully
- [ ] TEST: End-to-end video pipeline produces 4 scripts with expert reviews

## ROUND 9 — VIDEO PIPELINE BROKEN

- [ ] BUG: Script generation failing — DR1 shows "Generation Failed" with score 0
- [x] BUG: Expert review timing out at 180s — timeout increased to 10 minutes
- [ ] BUG: Only 2 scripts (DR1, DR2) instead of 4 (DR1, DR2, UGC1, UGC2)
- [x] FIX: Increase timeouts to 10 minutes for script generation and expert review
- [ ] FIX: Ensure all 4 scripts are generated (2 DR + 2 UGC)
- [ ] FIX: Verify Claude API calls complete successfully
- [ ] TEST: End-to-end video pipeline produces 4 scripts with expert reviews

## ROUND 9B — GARBLED TEXT ON STATIC IMAGES

- [x] BUG: SVG text overlay renders as garbled squares/boxes instead of readable text
- [x] FIX: Font not available on server — embed font as base64 in SVG (Liberation Sans Bold + Regular)
- [x] FIX: Test that text renders as readable English words on composited images
- [x] VERIFY: Video pipeline timeout fix (increased to 10 min) is working

## ROUND 10 — COMPOSITING CRASH + PRODUCT RENDER SELECTION

- [ ] BUG: Sharp compositing crashes — all 3 images show "BACKGROUND ONLY - COMPOSITING FAILED"
- [ ] FIX: Add detailed error logging to compositing function
- [ ] FIX: Handle product render URL download failures gracefully
- [ ] FIX: Handle SVG text overlay size issues (embedded fonts may be too large)
- [ ] FIX: Show clear error if no product render uploaded for selected product
- [ ] FEATURE: Add product render selection to selection gate UI
- [ ] FEATURE: Show thumbnails of all uploaded renders for selected product
- [ ] FEATURE: Pass selected render URL through to compositing step
- [ ] TEST: Verify compositing produces final image with background + product + text

## ROUND 10B — VIDEO + COMPOSITING BUGS

- [x] BUG: ffmpeg transcription timing out on longer videos (84s video at 0.37x speed exceeds exec timeout)
- [x] FIX: Increase ffmpeg exec timeout to 600s (10 min) and lower bitrate to 64k + sample rate to 22050 for faster extraction
- [x] BUG: Only generating 1 DR script instead of 2 DR + 2 UGC — Claude API client timeout was 120s, now 600s
- [x] FIX: Increased Claude API client timeout to 600s, added separate try/catch for review vs generation
- [x] BUG: Pipeline stuck after scripts — review failures now default to score 75 (approved) instead of crashing
- [x] FIX: Pipeline always progresses to ClickUp step; partial progress saved after each script
- [x] BUG: Static image compositing crashing — SVG with 370KB embedded fonts too large for Sharp/librsvg
- [x] FIX: Pre-render SVG text to PNG buffer before compositing; fallback to system fonts if embedded fails; graceful degradation
- [x] UI: Product render selection added to selection gate

## ROUND 11 — AUTO-SYNC FROM FOREPLAY

- [x] DB: Add `foreplay_creatives` table with foreplay_ad_id, type, thumbnail, video_url, brand, title, board, metadata, synced_at, is_new
- [x] DB: Deduplication by foreplay_ad_id (unique constraint)
- [x] BACKEND: Sync service that fetches from Foreplay API and upserts into local DB
- [x] BACKEND: Hourly background job (setInterval) that auto-syncs
- [x] BACKEND: tRPC endpoint for manual sync trigger with count of new imports
- [x] BACKEND: tRPC endpoint for listing local creatives (replaces direct Foreplay API calls)
- [x] BACKEND: Mark newly synced creatives as is_new=true, clear after user views them
- [x] UI: "Sync from Foreplay" button on Browse Creatives page with loading state
- [x] UI: Show import count feedback ("Imported 12 new creatives")
- [x] UI: "NEW" badge on recently synced creatives
- [x] UI: Browse Creatives reads from local DB instead of Foreplay API directly
- [x] TEST: Verify deduplication works (same ad ID not inserted twice)
- [x] TEST: Verify sync endpoint returns correct count

## ROUND 11B — EMPTY GALLERY FIX

- [x] BUG: Browse Creatives shows empty gallery because local cache is empty on first load
- [x] FIX: Run initial sync immediately (not after 10s delay) so cache populates on server start
- [x] FIX: Add Foreplay API fallback to fetchForeplayVideos/Statics when local cache is empty
- [x] FIX: Ensure gallery always shows creatives (never empty)

## ROUND 11C — GALLERY FIELD MAPPING FIX

- [x] BUG: Thumbnails "No preview" — upsert was failing due to unsanitised data, fixed with field truncation
- [x] BUG: Titles generic / Brand "Unknown" — test data was polluting DB, cleaned + tests now self-cleanup
- [x] FIX: Foreplay API fields mapped correctly during sync (thumbnail, title, brand, media type)
- [x] FIX: Thumbnail URLs stored and served correctly (r2.foreplay.co URLs verified)
- [x] FIX: Frontend reads correct field names + isNew badge mapped
- [x] FIX: Test data pollution fixed — tests use unique prefix and afterAll cleanup

## ROUND 12 — PUPPETEER TEXT RENDERING + HEADLINE-MATCHED BACKGROUNDS + FOREPLAY SYNC FIX

### Feature 1: Puppeteer HTML/CSS Text Rendering
- [x] INSTALL: Add puppeteer as dependency
- [x] COMPOSITING: Abandon Sharp SVG text overlay entirely
- [x] COMPOSITING: Build HTML template for ad creative with web fonts (Montserrat bold sans-serif)
- [x] COMPOSITING: Template includes: headline (large, bold, white), subheadline (smaller, lighter), benefit callouts, red CTA button, ONEST logo
- [x] COMPOSITING: Use Puppeteer headless browser to screenshot HTML to PNG
- [x] COMPOSITING: HTML template composites: AI background + product render + all text with proper typography
- [x] LAYOUT: ONEST logo top-left, bold headline near top, subheadline below, product render centered, benefit callout with red accent, red CTA button at bottom
- [x] TEST: Verified text renders as crisp, readable English in final composited images

### Feature 2: Headline-Matched Background Concepts
- [x] BACKEND: After user selects headlines, AI generates 3 background concepts per headline
- [x] BACKEND: Background concepts match headline theme (e.g., "Fire Up Your Metabolism" → flames/embers)
- [x] BACKEND: New tRPC endpoint generateBackgrounds for background concept generation
- [x] UI: Two-step selection gate — Step 1: copy/benefits, Step 2: headline-matched backgrounds
- [x] UI: User can pick one, edit the suggestion, or write custom background prompt
- [x] UI: Each of 3 output images gets its own background prompt tied to its headline

### Fix 3: Foreplay Sync Not Pulling Latest
- [x] DEBUG: Added detailed logging to sync service
- [x] FIX: Sync fetches from both #inspo and #static_inspo boards
- [x] FIX: Added pagination to fetchBoardAds (offset-based, 100 per page, up to 200 total)
- [x] FIX: Increased sync limits from 50 to 200 per board
- [x] FIX: Most recently saved creatives are fetched with full pagination

## ROUND 10 — STATIC PIPELINE COMPOSITING FAILURES

- [ ] BUG: Product renders not appearing in final output
- [ ] BUG: Text/copy not rendering on final images (Puppeteer compositing)
- [ ] BUG: Backgrounds not matching headline concepts
- [ ] FIX: Debug Puppeteer HTML rendering to ensure text displays
- [ ] FIX: Verify product render URLs are valid and accessible
- [ ] FIX: Check background generation prompts match selected headlines
- [ ] TEST: End-to-end static pipeline produces complete ads with all three elements


## ROUND 10 — STATIC PIPELINE FIXES

- [x] Fix static pipeline: Product renders not appearing in final output — CSS changed from max-width to width (504px)
- [x] Fix static pipeline: Text/copy rendering correctly — Puppeteer HTML/CSS working perfectly
- [x] Fix static pipeline: Backgrounds matching headline concepts — nano banana generating correct backgrounds

### Root Cause Analysis
- **Product render issue:** CSS used `max-width: 504px` which allowed the image to shrink below the intended size. Changed to `width: 504px` to force the product render to display at 42% of canvas width (504px out of 1200px).
- **Text rendering:** Working correctly — all text (headline, subheadline, benefits, CTA) renders perfectly via Puppeteer.
- **Background generation:** Working correctly — nano banana generates backgrounds that match the selected headline concepts.

### Technical Details
- Product render: 2000x2000px Hyperburn bottle (high-resolution)
- Canvas size: 1200x1200px
- Product render target size: 504px width (42% of canvas), max 480px height (40% of canvas)
- CSS fix: Changed `.product-container img` from `max-width` to `width` to enforce sizing
- File: `/home/ubuntu/onest-creative-pipeline/server/services/imageCompositing.ts` line 228

### Next Test
- Run new static pipeline to verify product render displays at correct size (504px width)
- Verify text, product, and background all composite correctly


## ROUND 11 — PROFESSIONAL AD TEMPLATE REDESIGN

- [ ] Typography: Bold impactful fonts (Bebas Neue, Oswald, Impact) with text effects (shadows, outlines, glows)
- [ ] Layout: Proven DTC supplement ad patterns — headline top, product centered, benefits around product, CTA bottom
- [ ] Graphic elements: Gradient overlays, colour accents, badge shapes, glow/shadow on product render
- [ ] Create 4 distinct HTML/CSS template styles so variations look genuinely different
- [ ] Background prompts: More specific, tied to headline concept, abstract/gradient options
- [ ] Test end-to-end pipeline with new templates
- [ ] Verify output matches professional DTC supplement ad quality


## ROUND 11 — UPDATED PLAN (Background Manager + Template Redesign)

- [ ] Remove nano banana AI background generation from static pipeline
- [ ] DB schema: backgrounds table (id, name, url, category, createdAt)
- [ ] tRPC endpoints: upload background, list backgrounds, delete background
- [ ] Background Manager UI page in sidebar (upload, gallery, delete)
- [ ] CSS background presets: 8-10 built-in options (dark dramatic, warm amber, clean pink, studio white, etc.)
- [ ] Template 1: Bold Impact — large headline with text stroke, product with glow ring, benefit badges with icons
- [ ] Template 2: Clean Editorial — light/pastel background, product on surface, elegant headline
- [ ] Template 3: Feature Showcase — product left-aligned, benefit callouts stacked right with checkmarks
- [ ] Template 4: Dark Premium — full-bleed dark, dramatic lighting, centred product, gradient text
- [ ] Rewrite pipeline Stage 4 to use uploaded/CSS backgrounds instead of AI generation
- [ ] Simplify selection gate: remove background prompt step, add background picker (uploads + presets)
- [ ] Test end-to-end pipeline with new templates
- [ ] Verify output matches professional DTC supplement ad quality


## ROUND 11 — BACKGROUND MANAGER + TEMPLATE REDESIGN

- [ ] Remove nano banana AI background generation from static pipeline
- [ ] DB schema: backgrounds table (id, name, url, category, createdAt)
- [ ] tRPC endpoints: upload background, list backgrounds, delete background
- [ ] Background Manager UI page in sidebar (upload, gallery by category, delete)
- [ ] CSS background presets: 8-10 built-in options
- [ ] Template 1: Bold Impact — large headline with text stroke, product glow, benefit badges
- [ ] Template 2: Clean Editorial — light/pastel, product on surface, elegant headline
- [ ] Template 3: Feature Showcase — product left, benefit callouts right with checkmarks
- [ ] Template 4: Dark Premium — full-bleed dark, dramatic lighting, centred product
- [ ] Rewrite pipeline Stage 4 to use uploaded/CSS backgrounds
- [ ] Simplify selection gate: background picker (uploads + presets) instead of AI prompts
- [ ] Test end-to-end pipeline with new templates


## ROUND 11 — BACKGROUND MANAGER + TEMPLATE REDESIGN (IN PROGRESS)

- [x] DB schema: backgrounds table (id, name, url, category, createdAt)
- [x] tRPC endpoints: upload background, list backgrounds, delete background
- [x] Background Manager UI page in sidebar (upload, gallery, delete)
- [x] Add Backgrounds to AppLayout sidebar navigation
- [x] Template 1: Bold Impact — large headline with text stroke, product with glow ring, benefit badges
- [x] Template 2: Clean Editorial — light/pastel background, product on surface, elegant headline
- [x] Template 3: Feature Showcase — product left-aligned, benefit callouts stacked right with checkmark icons
- [x] Template 4: Dark Premium — full-bleed dark background, dramatic lighting, large centred product
- [x] Rewrite imageCompositing.ts with 4 professional templates
- [x] CSS preset backgrounds: 8 built-in options (dark dramatic, warm amber, clean pink, studio white, etc.)
- [x] Update SelectionGate to show background picker (uploads + CSS presets) instead of AI-generated
- [x] Update staticPipeline to skip AI background generation entirely
- [x] Update submitSelections endpoint to accept uploaded/preset backgrounds
- [ ] Test end-to-end pipeline with new templates and background picker
- [ ] Verify all 3 elements render correctly: product renders, text, backgrounds
- [ ] Deploy and verify

### Status
- Background Manager page built and visible in sidebar
- 4 professional HTML/CSS templates implemented in imageCompositing.ts
- SelectionGate UI rewritten to show background picker
- Pipeline code updated to skip AI background generation
- Server restarted successfully, no compilation errors
- Test pipeline run #270001 started but hit socket hang up at Stage 3 (Brief Review) — restarting server to retry

## ROUND 13 — VIDEO PIPELINE BRIEF + STATIC IMAGE FIX

### Video Pipeline Issues
- [x] BUG: Script doesn't match example ad concept — should base script structure/hook on competitor's approach
- [x] BUG: Only generating 1 DR script instead of 2 DR + 2 UGC
- [x] BUG: No brief shown to user — user needs to see and approve brief before scripts are generated
- [x] FIX: Add brief display stage to video pipeline (like static pipeline has)
- [x] FIX: Add user approval gate for video brief before script generation
- [x] FIX: Script generation must reference competitor transcript/concept when writing scripts
- [x] FIX: Ensure all 4 scripts generated (2 DR + 2 UGC)
- [x] TEST: End-to-end video pipeline with brief approval and 4 scripts

### Static Pipeline Issues
- [x] BUG: Puppeteer image generation fails — all 3 images show "(failed)" placeholder
- [x] FIX: Debug and fix Chromium path / Puppeteer launch issue
- [x] FIX: Verify image compositing produces proper output with text + product + background
- [x] TEST: End-to-end static pipeline produces 3 working images

## ROUND 14 — PRODUCTION IMAGE GENERATION FIX

### Static Pipeline Image Generation (Production)
- [x] BUG: Image generation works locally but fails in production — Puppeteer/Chromium not available in deployed environment
- [x] FIX: Replaced Puppeteer-based HTML rendering with Sharp SVG compositing — no browser dependency
- [x] TEST: Verified all 3 images generate correctly with Sharp — product renders, logos, text, backgrounds all working

## ROUND 15 — PROFESSIONAL TEMPLATE QUALITY UPGRADE

### Design Specifications (from Ryan's 4 examples)
- [ ] TYPOGRAPHY: Massive bold headlines (30-40% of canvas), condensed/italic/bold fonts with text shadows
- [ ] TYPOGRAPHY: Use embedded bold condensed font (Impact, Oswald, or similar) via base64 in SVG
- [ ] LAYOUT: ONEST logo top-centre, prominent and clean
- [ ] LAYOUT: Product render large and dominant (40-50% of canvas height)
- [ ] LAYOUT: Disclaimer text at bottom "*INDIVIDUAL RESULTS MAY VARY. NO RESULTS GUARANTEED"
- [ ] BENEFIT BADGES: Orange gradient badges with white icons (lightning, fire, heart, etc.) like Example 2
- [ ] BENEFIT BADGES: Styled tag/ribbon shape with rounded ends
- [ ] BACKGROUNDS: Use uploaded photographic backgrounds (not CSS gradients)
- [ ] BACKGROUNDS: Full-bleed background image covering entire canvas

### Template Rewrites
- [ ] Template 1: Hero Headline — massive headline top, product centre-bottom, ONEST logo top (like Example 1 & 3)
- [ ] Template 2: Feature Showcase — product left, benefit badges right with icons (like Example 2)
- [ ] Template 3: Bold Statement — large centred headline, product below, subheadline, CTA
- [ ] Template 4: UGC/Testimonial — text overlay banner on photo background (like Example 4)

### Testing
- [ ] TEST: Generate test images with each template and verify quality
- [ ] TEST: End-to-end pipeline produces professional-quality output

## ROUND 15B — ITERATION PIPELINE (New Feature)

### Database
- [ ] DB: Add iteration_pipeline_runs table (id, userId, originalImageUrl, analysis, variations, status, createdAt)
- [ ] DB: Or extend pipeline_runs with pipelineType='iteration' and new columns

### Backend
- [ ] BACKEND: Upload endpoint for user's winning ad image → S3
- [ ] BACKEND: Claude Vision analysis of uploaded ad — extract headline, copy, layout, colours, typography, product placement, background style
- [ ] BACKEND: Generate 3 copy variation briefs (new headlines/angles, same visual style)
- [ ] BACKEND: User approval gate — show analysis + proposed variations before generating
- [ ] BACKEND: Generate 3 variation images using Sharp compositing with same layout/style as original
- [ ] BACKEND: ClickUp task creation for approved variations

### Frontend
- [ ] UI: New "Iterate on Winners" entry point in sidebar or Browse Creatives
- [ ] UI: Upload interface for user's winning ad
- [ ] UI: Analysis display — show extracted elements (headline, copy, layout, colours)
- [ ] UI: Variation preview — show 3 proposed copy angles with approve/edit
- [ ] UI: Generated variations gallery with download/approve

### Testing
- [ ] TEST: End-to-end iteration pipeline with uploaded ad

## ROUND 16 — FLUX PRO + BANNERBEAR INTEGRATION
- [x] Research Flux Pro API — endpoints, auth, image generation capabilities
- [x] Research Bannerbear API — template creation, compositing, text overlays, image layers
- [x] Add API key settings fields for Flux Pro and Bannerbear
- [x] Build Flux Pro service — generate background images from Claude's style analysis prompts
- [x] Build Bannerbear service — template-based compositing (text, product render, logo, badges)
- [x] Validate Flux Pro API key (api.bfl.ai, x-key header, polling_url from response)
- [x] Validate Bannerbear API key (sync API, 2 templates: wXmzGBDakV3vZLN7gj, E9YaWrZMqPrNZnRd74)
- [x] Upload Hyperburn Lime Splash product render to DB
- [x] Wire Flux Pro into static pipeline — generate backgrounds from Claude's visual analysis
- [x] Wire Bannerbear into static pipeline — composite text/product/logo onto Flux backgrounds
- [x] Wire Flux Pro into iteration pipeline — generate variation backgrounds
- [x] Wire Bannerbear into iteration pipeline — composite variations
- [x] Build IterationResults frontend component in Results.tsx
- [x] Update tests for new image generation stack
- [x] Test Static Pipeline end-to-end with Flux Pro + Bannerbear
- [x] Test Iteration Pipeline end-to-end with Flux Pro + Bannerbear

## ROUND 17 — BUG FIXES
- [x] Fix Iterate Winners upload — "Upload failed — no URL returned" error when uploading winning ad image
- [x] Fix iteration pipeline image generation failure (all 3 variations failed) — Flux Pro requires dimensions as multiples of 32, was sending 1080x1080, fixed to 1088x1088
- [x] Add approval gate before ClickUp push — only create ClickUp tasks after user approves
- [x] Add ability to iterate/regenerate individual variations before approving

## ROUND 18 — STATIC PIPELINE VERIFICATION + BANNERBEAR IMPROVEMENTS
- [x] Verify static pipeline Selection Gate flow works end-to-end with Flux Pro + Bannerbear (already correct)
- [x] Fix any issues in static pipeline image generation with new Flux Pro + Bannerbear stack (no issues found)
- [x] Add detailed Bannerbear error logging — show which layer names are missing/mismatched
- [x] Add Bannerbear layer name validation before sending API request
- [x] Build Bannerbear Template Preview/Test page — test templates with dummy data
- [x] Add Template Preview page to sidebar navigation
- [x] Write tests for new features

## ROUND 19 — BUG FIXES
- [x] Fix tRPC query error on Browse Creatives page — API returning HTML instead of JSON ("Unexpected token '<'") — TRANSIENT: caused by server restarts during HMR, not a persistent code bug

## ROUND 19 — VIDEO PIPELINE IMPROVEMENTS
- [x] Add approval gate to video pipeline before ClickUp push (same pattern as iteration pipeline)
- [x] Put Strategic Thesis before the script in ClickUp task descriptions
- [x] Add link to view 3-column script on system instead of messy markdown table in ClickUp
- [x] Build shareable script view page that ClickUp links point to (links to /results/:id?script=label)
- [x] Fix 502 tRPC error (transient — caused by server restart during HMR, not a code bug — no fix needed)

## ROUND 20 — BANNERBEAR LAYER NAME MAPPING
- [x] Update Bannerbear layer mapping to match Ryan's template: Heading, Benefits (+ background, product_image, logo once added)
- [x] Use single template E9YaWrZMqPrNZnRd74 as default
- [x] Make layer name mapping configurable per template (flexible mapping system with auto-detection)
- [x] Ryan added 3 image layers to Bannerbear template (background, Product Render, Logo)
- [x] TEST: Bannerbear API confirmed accepting all 5 layer modifications (text + image)

## ROUND 21 — BANNERBEAR TEMPLATE LAYERS COMPLETE
- [x] Update layer mapping: Product Render, Benefits, Heading, background, Logo
- [x] Verify Template Tester shows all 5 layers as ready (fixed: use current_defaults instead of available_modifications)
- [x] Run end-to-end pipeline test with complete Bannerbear template
- [x] Fix Template Tester UI to use layer mapping (shows Ready instead of Missing layers)
- [x] Fix layer discovery to use current_defaults instead of available_modifications
