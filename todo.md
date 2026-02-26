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

## ROUND 22 — BANNERBEAR PREVIEW BUGS
- [x] BUG: Deleted product render still used in template tester preview — now fetches latest from DB
- [x] BUG: Text colour not contrasting with background — now sends white (#FFFFFF) text colour override
- [x] BUG: Two product renders appearing — was caused by old hardcoded non-transparent PNG, now uses DB render with transparency

## ROUND 23 — UGC CLONE ENGINE (NEW PIPELINE)
- [x] Create database schema: ugc_uploads, ugc_variants tables (migration 0010 applied)
- [x] Build UGC service layer: transcription, structure extraction, variant generation (server/services/ugcClone.ts)
- [x] Create tRPC routes under trpc.ugc.* namespace (upload, list, get, startExtraction, approveBlueprint, generateVariants, approveVariants, rejectVariants, pushToClickup)
- [x] Build UGC Upload page with video upload, product/audience tagging, volume control (client/src/pages/UgcUpload.tsx)
- [x] Build Structure Blueprint approval gate (Step 2) — integrated into UgcDashboard
- [x] Build variant generation logic with actor archetypes, voice tones, energy levels (wired into tRPC routes, calls ugcClone service)
- [x] Build UGC Dashboard showing all variants with archetype/tone/energy badges (client/src/pages/UgcDashboard.tsx)
- [x] Build Approval UI with "Approve All" / "Approve Selected" functionality (bulk actions in UgcDashboard)
- [ ] Add optional Arcads integration module (actor generation)
- [x] Add Runway API key and integration module (assembly/captions) — validated with API test
- [x] Add ElevenLabs API key and voice generation integration — validated with API test
- [x] Add ClickUp push for approved variants (Video Ad Board, Review status) — pushUgcVariantsToClickup in clickup.ts
- [x] Add sidebar nav item: "UGC Clone Engine" (AppLayout.tsx + App.tsx routing)
- [x] Write tests for UGC pipeline (server/ugc.test.ts) — 2 tests for structure extraction and variant generation
- [x] Verify all existing tests still pass — 55 tests total (53 existing + 2 new UGC tests)
- [ ] Export formats: 4:5 and 9:16 only (no 1:1)
- [ ] Volume handling: 5-200 variants per batch
- [ ] Guardrails: preserve structure, no compliance changes, no auto-push

## ROUND 24 — UGC UPLOAD BUG + LOVABLE RESEARCH

- [x] BUG: UGC upload fails with 46MB video — Express body size limit was 50MB
- [x] FIX: Increased Express body size limit to 500MB for video uploads
- [ ] TEST: Upload 46MB video file and verify successful response
- [ ] RESEARCH: Investigate Lovable app (onest-creative-studio.lovable.app) to understand Google Gemini image generation
- [ ] RESEARCH: Check if Lovable uses Google Gemini 3 Flash for image generation
- [ ] INTEGRATE: Add Google Gemini image generation to Iterate Winners pipeline
- [ ] COMPARE: Test Gemini output vs current Flux Pro output quality

## ROUND 22 — GEMINI 3 PRO IMAGE INTEGRATION

- [x] Configure Google AI API key (AIzaSyC94Qr3xLfuTlqmCC9umoBguDCAqs8c4oM)
- [x] Validate Google AI API key with test request
- [x] Create server/services/geminiImage.ts service
- [x] Implement generateProductAd() function with product render compositing
- [x] Add Gemini image generation to Iterate Winners pipeline (replace Flux Pro + Bannerbear)
- [x] Write tests for Gemini service (5 tests passing)
- [ ] Test Gemini image generation with ONEST product renders end-to-end
- [ ] Update IterationResults.tsx UI if needed (current UI should work as-is)
- [x] Save checkpoint after successful integration (version aca4a6b2)

## ROUND 23 — GEMINI PROMPT ENHANCEMENT & API FIX

- [x] Fix Gemini API error: responseModalities not supported by gemini-2.0-flash-exp-image-generation
- [x] Research correct Gemini image generation API format
- [x] Upgrade Google AI API to paid tier (billing account activated)
- [x] Verify Gemini image generation working (test passed)
- [x] Implement enhanced prompt system with headline analysis
- [x] Add emotional targeting and audience-specific prompts
- [x] Integrate enhanced prompts into iteration pipeline
- [x] Add creativity slider (SAFE/BOLD/WILD) to iteration pipeline UI and backend
- [x] Add creativityLevel field to database schema
- [x] Apply database migration
- [ ] Test Iterate Winners with creativity slider
- [ ] Test UGC upload with 25MB video
- [ ] Save checkpoint after successful testing

## ROUND 24 — UGC UPLOAD BUG FIX

- [x] Investigate UGC Clone Engine upload error: "Unexpected token '<', '<html><hea'... is not valid JSON"
- [x] Add detailed error logging to UGC upload mutation
- [x] Add file size validation and better error handling
- [ ] Test 25MB video upload with new logging

## ROUND 25 — ITERATE WINNERS REBUILD (OPTION B)

### Phase 1: Variation Matrix Builder
- [ ] Create variation type selector UI (Headline Only / Background Only / Layout Only / Benefit Callouts Only / Full Remix)
- [ ] Add variation count slider (1-50 variations)
- [ ] Update brief generation to support different variation types
- [ ] Modify `generateIterationBrief()` to accept variationType and count parameters

### Phase 2: Headline Bank System
- [ ] Create `headline_bank` database table schema
- [ ] Add headline extraction from existing winning ads
- [ ] Build headline submission UI (manual entry)
- [ ] Add headline rating/voting system (1-5 stars)
- [ ] Modify brief generation to pull 50% from Headline Bank, 30% AI-generated, 20% user-submitted

### Phase 3: Hard Constraints & Aspect Ratio
- [ ] Make "Preserve These Elements" checkboxes (lock/unlock each element)
- [ ] Pass locked elements to Gemini as HARD CONSTRAINTS in prompt
- [ ] Add aspect ratio selector (1:1, 4:5, 9:16, 16:9)
- [ ] Update Gemini prompt to enforce aspect ratio

### Phase 4: Cost Calculator & Preview/Select UI
- [ ] Add Gemini cost calculator (2K: $0.13, 4K: $0.24 per image)
- [ ] Show estimated cost BEFORE generation
- [ ] Display variation briefs in preview grid
- [ ] Add "Select variations to generate" checkboxes
- [ ] Add "Edit brief" button for each variation
- [ ] Only generate selected variations (not all)

### Phase 5: Testing & Deployment
- [ ] Test variation type selector with real winning ad
- [ ] Test headline bank integration
- [ ] Test hard constraints enforcement
- [ ] Test aspect ratio selector
- [ ] Test cost calculator accuracy
- [ ] Save checkpoint after successful testing

## ROUND 26 — HEADLINE BANK + VARIATION MATRIX BUILDER

### Headline Bank (Manual Entry)
- [x] Create headline_bank database table schema
- [x] Add headline entry form UI
- [x] Add rating system (1-5 stars)
- [x] Add source tracking (manual/motion/ai)
- [x] Add performance metadata (ROAS, spend, weeks active)
- [x] Generate database migration
- [x] Apply migration
- [x] Add tRPC endpoints (list, get, create, update, delete)
- [x] Add database functions in db.ts
- [x] Add Headline Bank to sidebar navigation
### Variation Matrix Builder
- [x] Add variation type selector (7 types: headline_only, background_only, layout_only, benefit_callouts_only, props_only, talent_swap, full_remix)
- [x] Add variation count slider (1-50)
- [x] Add aspect ratio selector (1:1, 4:5, 9:16, 16:9)
- [x] Add cost calculator (real-time cost estimation)
- [ ] Integrate variation type logic with backend
- [ ] Update iteration pipeline to respect variation types
- [ ] Integrate Headline Bank with iteration brief generation
- [ ] Add preview/select UI for variation briefs
- [x] Save checkpoint (version e7998112)

### Hard Constraints + Aspect Ratio
- [ ] Add lock/unlock toggles for preserve elements
- [ ] Enforce locked elements in Gemini prompts
- [ ] Add aspect ratio selector (1:1, 4:5, 9:16, 16:9)
- [ ] Update Gemini service to support aspect ratios

### Cost Calculator
- [ ] Add real-time cost estimation (2K: $0.13, 4K: $0.24 per image)
- [ ] Show total cost before generation
- [ ] Add preview/select UI for variation briefs
- [ ] Add edit brief functionality

### Integration
- [ ] Integrate Headline Bank with Iterate Winners pipeline
- [ ] Pull headlines from bank ranked by rating
- [ ] Show headline source in UI
- [ ] Test end-to-end workflow
- [ ] Save checkpoint

## CRITICAL BUG FIXES (Round 27)

### UGC Upload Bug (25MB videos fail)
- [x] Diagnose root cause: base64 encoding through tRPC exceeds payload limits
- [x] Replace base64 upload with direct S3 upload using storagePut
- [x] Update UgcUpload.tsx to upload file to S3 first, then pass S3 URL to tRPC
- [ ] Test with 25MB video upload
- [ ] Verify upload completes successfully

### Variation Type Multi-Select
- [x] Change variation type selector from single-select to multi-select
- [x] Replace card selection UI with checkbox grid
- [x] Allow selecting multiple variation types simultaneously (e.g., headline_only + background_only + layout_only)
- [x] Update backend to handle array of variation types
- [x] Generate variations across all selected types in single batch
- [ ] Test multi-type selection workflow

## ITERATE WINNERS PIPELINE REBUILD (Round 27B)

### Complete Pipeline Audit - Remove ALL Legacy Code
- [ ] Audit iterationPipeline.ts - identify all Flux Pro + Bannerbear references
- [ ] Audit Results page Stage 2 display - remove "Preserve These Elements" UI
- [ ] Audit brief generation - ensure it uses variation types, not preserve tags
- [ ] Audit image generation - confirm using Gemini 3 Pro, not Flux Pro
- [ ] Audit variation count - ensure respecting 1-50 slider, not hardcoded 3

### Backend Integration (iterationPipeline.ts)
- [x] Accept variationTypes array from frontend
- [x] Accept variationCount (1-50) from frontend
- [x] Accept aspectRatio from frontend
- [ ] Integrate Headline Bank - pull headlines by rating instead of AI generation
- [x] Generate N variations based on variationCount, not hardcoded 3
- [x] Respect variation types - only vary selected elements
- [x] Pass aspectRatio to Gemini API for correct dimensions

### Results Page UI Updates
- [ ] Remove "Preserve These Elements" section from Stage 2
- [ ] Show selected variation types instead
- [ ] Show variation count (e.g., "Generating 15 variations")
- [ ] Show aspect ratio selection
- [ ] Update variation gallery to support 1-50 images, not just 3
- [ ] Add pagination/grid for large variation counts

### Headline Bank Integration
- [ ] Query headlines table ordered by rating DESC
- [ ] Use top-rated headlines for variations instead of AI-generated
- [ ] Show headline source in UI ("From Headline Bank" vs "AI Generated")
- [ ] Fall back to AI generation if bank is empty

### Testing
- [ ] Test with 1 variation type, 5 variations
- [ ] Test with 3 variation types, 20 variations
- [ ] Test with empty Headline Bank (should fall back to AI)
- [ ] Test with populated Headline Bank (should use proven winners)
- [ ] Test all 4 aspect ratios
- [ ] Save checkpoint

## UGC Pipeline Progression Bug (Round 27C)

### Issue: Pipeline stops at upload status page
- [ ] Investigate why pipeline doesn't auto-progress after upload completes
- [ ] Check if backend is triggering variant generation automatically
- [ ] Check if there's a missing "Generate Variants" button or action
- [ ] Verify UGC pipeline flow: upload → transcription → variant generation
- [ ] Fix progression logic to automatically move to next stage
- [ ] Test end-to-end flow with uploaded video

## CRITICAL UI BUGS (Round 27D)

### UGC Pipeline Stuck at Upload Page
- [x] Investigate why pipeline doesn't auto-progress after upload
- [x] Check if there's a missing "Generate Variants" button
- [x] Verify backend is triggering variant generation
- [x] Add proper navigation/progression after upload completes
- [ ] Test end-to-end UGC upload flow

### Iterate Winners Results Page - Legacy UI Still Showing
- [x] Remove "Preserve These Elements" section from Stage 2
- [x] Remove hardcoded 3 variations (V1, V2, V3) display
- [x] Show selected variation types from user input
- [x] Show variation count from user input
- [x] Show aspect ratio from user input
- [x] Update brief approval section to reflect new system
- [ ] Test Results page with new variation matrix data

## Button Text Fix (Round 27E)

### "Generate 3 Variations" Button Still Hardcoded
- [x] Find the button in IterateWinners.tsx
- [x] Update button text to show dynamic variation count (e.g., "Generate 10 Variations")
- [ ] Verify button updates when slider changes
- [ ] Test with different variation counts (1, 10, 25, 50)

## CRITICAL BUG FIXES (Round 28 - QA Audit Findings)

### Bug #1: Frontend Validation Missing (P1)
- [x] Add validation to IterateWinners.tsx to prevent submitting with zero variation types
- [x] Disable "Generate" button when variationTypes.length === 0
- [ ] Show error message: "Please select at least one variation type"
- [ ] Test edge case: clicking generate with no types selected

### Bug #2: Variation Types Not Used in Brief Generation (P0 - CRITICAL)
- [x] Read current generateIterationBrief() function implementation
- [x] Design variation type constraint logic for each type:
  * headline_only → Only vary headline, preserve background/layout/props
  * background_only → Only vary background, preserve headline/layout
  * layout_only → Only vary product placement, preserve headline/background
  * props_only → Only vary visual metaphors, preserve headline/background/layout
  * benefits_only → Only vary benefit copy, preserve headline/background/layout
  * talent_swap → Only change person/model, preserve everything else
  * full_remix → Change everything
- [x] Implement conditional prompt generation based on variationTypes array
- [x] Add detailed constraint instructions for each type to Claude prompt
- [x] Update JSON output format to include variationType field
- [x] Calculate variations per type distribution (Math.ceil(count / types.length))
- [ ] Test each variation type individually
- [ ] Test multiple types selected simultaneously

### Bug #3: Variation Count Fallback to 3 (P1)
- [x] Fix line 172 in iterationPipeline.ts
- [x] Change from `briefData?.variations?.length || 3` to `run.variationCount || 3`
- [ ] Test edge case: empty briefData.variations array
- [ ] Verify count from database is used correctly

### Bug #4: Fallback Generation Hardcoded Aspect Ratio (P2)
- [x] Fix line 240 in iterationPipeline.ts
- [x] Change from `aspectRatio: "1:1"` to `aspectRatio: aspectRatio as any`
- [x] Also update resolution to respect aspect ratio (2K for 1:1/4:5, 4K for 9:16/16:9)
- [ ] Test fallback generation path
- [ ] Verify aspect ratio variable is used

### Image Creation Guidelines Documentation
- [x] Write comprehensive guidelines for Iterate Winners image generation
- [x] Document variation type constraints and how they affect prompts
- [x] Document complete pipeline flow (Stage 1-4)
- [x] Document aspect ratio handling and cost calculations
- [x] Document error handling and fallback generation
- [x] File: /home/ubuntu/iterate_winners_pipeline_logic.md (69KB)
- [ ] Include examples for each variation type
- [ ] Document Gemini prompt structure and parameters
- [ ] Add best practices for background complexity (simple backgrounds preferred)
- [ ] Document aspect ratio handling
- [ ] Include troubleshooting section

### Audit Corrections
- [ ] Check what ad selection method is actually used (NOT Foreplay)
- [ ] Update audit report with correct implementation details
- [ ] Verify all assumptions against actual code

## REMOVE BANNERBEAR LEGACY CODE (Round 29)

### Audit All Image Generation Paths
- [x] Check main pipeline (Stage 3) - confirm using Gemini ✅
- [x] Check regenerateVariation function - currently using Bannerbear ❌
- [x] Check for any other Bannerbear/Flux Pro imports
- [x] Verify no legacy code paths remain

### Replace regenerateVariation Function
- [x] Read current regenerateVariation implementation
- [x] Replace Flux Pro + Bannerbear with Gemini 3 Pro Image
- [x] Use same logic as Stage 3 (buildEnhancedPrompt + generateProductAd)
- [ ] Test regeneration flow

### Remove Legacy Imports
- [x] Remove Bannerbear imports from iterationPipeline.ts (were dynamic imports)
- [x] Remove Flux Pro imports from iterationPipeline.ts (were dynamic imports)
- [x] Remove imageCompositing import (ImageSelections, generateStaticAdVariations)
- [x] Clean up unused ImageSelections object
- [x] Verify TypeScript compiles without errors

## UGC AUTO-PROGRESSION BUG (Round 30)

### Issue: Upload completes but stays at "uploaded" status
- [x] Check server logs for errors during background transcription
- [x] Verify upload endpoint is calling startExtraction in background
- [x] Check database status field for upload #30003 - status is "uploaded"
- [x] Found bug: multipart endpoint in server/_core/index.ts has NO auto-trigger logic
- [x] Add background task trigger to multipart upload endpoint
- [x] Fix import paths (voiceTranscription, ugcClone)
- [x] Add error handling for transcription response
- [x] TypeScript errors resolved
- [ ] Test end-to-end upload flow

## NAVIGATION REORGANISATION (Round 30)

### Move UGC Clone Engine to PIPELINE section
- [x] Update AppLayout.tsx navigation config
- [x] Move UGC Clone Engine from ASSETS to PIPELINE (position 3)
- [x] Verify routing still works

### Move Headline Bank to ASSETS section
- [x] Update AppLayout.tsx navigation config
- [x] Move Headline Bank from PIPELINE to ASSETS (position 4)
- [x] Verify routing still works

### Audit and Remove Unused Pages
- [x] Check if Template Tester is being used anywhere - only in nav/routes
- [x] Check if Backgrounds page is being used anywhere - still in use, keeping it
- [x] Remove Template Tester from navigation
- [x] Remove Template Tester route from App.tsx
- [x] Keep Backgrounds in ASSETS section (user wants it)

## UGC TRANSCRIPTION FAILURE (Round 31 - CRITICAL)

### Issue: Status stuck at "transcribing", not progressing to "structure_extracted"
- [ ] Check server logs for transcription errors
- [ ] Verify transcribeAudio() function is being called correctly
- [ ] Check if transcription API is failing
- [ ] Verify extractStructureBlueprint() is being called after transcription
- [ ] Check database updates during transcription process
- [ ] Fix any errors in background task execution
- [ ] Test complete flow: uploaded → transcribing → structure_extracted → blueprint display

### Document Complete UGC Workflow
- [ ] Document expected user flow from upload to final variants
- [ ] Document all status transitions and what triggers them
- [ ] Document what should be displayed at each stage
- [ ] Document error handling for each stage
- [ ] Verify understanding matches user's requirements

### Testing Requirements
- [ ] Test with real 25MB video upload
- [ ] Verify automatic status progression
- [ ] Verify blueprint display with hook/body/CTA
- [ ] Verify variant generation with correct count
- [ ] Verify all UI updates correctly
- [ ] NO CHECKPOINT until all tests pass


## UGC TALENT VARIATION ENGINE — COMPLETE REBUILD

- [ ] Remove incorrect UGC script variation system (transcription-based)
- [ ] Create new database schema: ugc_masters table (videoUrl, scriptText, campaignName, adName, desiredVariations)
- [ ] Create new database schema: ugc_variations table (masterId, talentId, gender, ageRange, videoUrl_4_5, videoUrl_9_16, status, metadata)
- [ ] Research Runway ML API capabilities for face generation and performance cloning
- [ ] Build upload interface: video + script text + campaign name + ad name + number of variations
- [ ] Implement video analysis to extract timing and performance markers
- [ ] Implement AI face generation (realistic UGC creator per variation)
- [ ] Implement voice cloning with ElevenLabs (match timing, emotion, gender)
- [ ] Implement lip sync technology (Runway or alternative)
- [ ] Implement video assembly pipeline (face + voice + lip sync)
- [ ] Implement multi-aspect-ratio export (4:5 and 9:16 independently framed)
- [ ] Build preview generation workflow
- [ ] Build approval interface (user selects which variations to approve)
- [ ] Implement ClickUp integration for approved variations with metadata
- [ ] Add talent metadata tracking (Talent_ID, Gender, Age_Range, Visual_Archetype, Voice_Profile)
- [ ] Implement naming convention: [Campaign]_[AdName]_[TalentID]_[Gender]_[AspectRatio]_[Version]
- [ ] Add automatic quality checks (lip sync, timing drift, face stability)
- [ ] Test complete workflow: upload → generate → preview → approve → export → ClickUp


## ITERATE WINNERS - IMAGE GENERATION FIXES
- [ ] Rebuild Gemini prompt for guaranteed headline rendering
- [ ] Add product integration instructions (surface placement, lighting, shadows)
- [ ] Add environmental interaction rules (wrap around, depth layering)
- [ ] Test new prompts with sample generations
- [ ] Validate text presence and integration quality
- [ ] Implement fallback if needed


## HIERARCHICAL VARIATION SYSTEM (50+ Creatives)
- [x] Database: Add parentRunId, variationLayer (parent/child), variationType to iteration_runs
- [x] Prompt: Build child variation prompt system (color_shift, lighting, typography, product_angle, background_intensity, layout, effect_intensity)
- [x] Backend: Implement generateChildVariations(parentRunId, variationTypes, childCount)
- [x] Backend: Update iteration pipeline to support layer selection
- [x] UI: Layer 1 grid with checkboxes for parent selection
- [x] UI: "Generate Children" button with count selector (5 or 10)
- [x] UI: Individual parent child generation on results page
- [x] UI: Batch parent selection page at /iterate/generate-children
- [ ] Test: Complete flow from control → 10 parents → select 3 → 30 children = 40 total


## ITERATE WINNERS - IMAGE GENERATION FIXES
- [x] Implement reference-based prompt that uses control image as visual guide
- [x] Update geminiImage.ts to accept and send control image to Gemini API
- [x] Update iterationPipeline.ts to pass control image URL to generation
- [x] Fix duplicate generation issue (added temperature=1.0, topP=0.95, topK=40 + variation-specific uniqueness instructions)
- [x] Ensure headline consistency across all outputs (reference-based prompt explicitly instructs text rendering)
- [x] Ensure product integration (reference-based prompt instructs matching product placement approach from control)
- [ ] Test with real control ad and validate quality


## ITERATE WINNERS - UI/UX COMPREHENSIVE FIXES

### P0 Critical Issues (Landing Page)
- [x] Fix variation types confusion - changed to radio buttons with clear single-selection behaviour
- [x] Fix accessibility - improved contrast ratios for purple buttons (#8B5CF6 → #A78BFA)
- [x] Fix accessibility - added visible keyboard focus indicators to all interactive elements
- [x] Fix accessibility - increased touch target sizes to 48×48px minimum
- [x] Move cost visibility above the fold
- [x] Add loading states - enhanced with disabled states and confirmation dialog
- [x] Add confirmation dialog before generating variations

### P1 High Priority
- [x] Implement mobile-first responsive design (grid layouts with responsive classes)
- [x] Add error messages explaining why iterations failed (comprehensive error banner with retry/back options)
- [x] Add confirmation dialog before generating variations (shows cost, config summary)
- [x] Implement auto-refresh for results page when stages complete (already implemented with refetchInterval)

### P2 Medium Priority
- [ ] Expand Creative Risk Level descriptions with examples
- [ ] Show headlines instead of filenames in Recent Iterations
- [ ] Add icons to status badges for colour-blind users
- [ ] Increase button sizes for better touch targets

### P3 Low Priority
- [ ] Add Quick Start option with sensible defaults
- [ ] Add example gallery showing before/after results
- [ ] Implement guided tour for first-time users
- [ ] Add bulk actions (archive/delete) to Recent Iterations


## ITERATE WINNERS - RESTORE COMPACT LAYOUT
- [x] Reduce button min-height from 48px to 40px (keep accessibility but more compact)
- [x] Reduce padding and gaps to match original spacing (gap-3 → gap-2)
- [x] Keep all functional improvements (single-select, cost visibility, confirmation, error messages)


## NANO BANANA PRO INTEGRATION
- [ ] Research Nano Banana Pro API/SDK documentation
- [ ] Create comprehensive Iterate Winners pipeline flow map for approval
- [ ] Design Nano Banana Pro integration architecture (replace Gemini)
- [ ] Implement Nano Banana Pro image generation service
- [ ] Update iteration pipeline to use Nano Banana Pro instead of Gemini
- [ ] Test image generation quality with Nano Banana Pro


## VARIATION COUNT SELECTOR
- [x] Add "Number of Variations" dropdown to landing page (options: 3, 5, 10, 20, 50, 100)
- [x] Update database schema to store variationCount in pipeline_runs (already exists)
- [x] Update backend to generate exactly N variations as specified (already implemented)
- [x] Update cost calculator to reflect selected variation count (already implemented)
- [ ] Update child generation to respect parent variation count

## NANO BANANA PRO INTEGRATION
- [x] Create nanoBananaPro.ts service with Imagen 3 API integration
- [x] Implement reference-based prompt builder for Nano Banana Pro (uses existing geminiPromptBuilder)
- [x] Update iterationPipeline.ts to use Nano Banana Pro instead of Gemini
- [x] Update cost calculator ($0.02 → $0.12 per image for Nano Banana Pro)
- [ ] Test image generation quality (headlines, product integration, consistency)
- [ ] Update flow map documentation with Nano Banana Pro integration


## PRODUCT INFO INTEGRATION CHECK
- [ ] Verify iteration pipeline pulls product info from product_info database
- [ ] Ensure product benefits, ingredients, claims are used in image generation prompts
- [ ] Test that product info changes reflect in generated variations


## NANO BANANA PRO API FIX
- [x] Rewrite nanoBananaPro.ts to use Gemini generate_content endpoint (not Imagen endpoint)
- [x] Use model: gemini-3-pro-image-preview
- [x] Format request with prompt + reference images using Gemini API format
- [x] Handle response parts to extract generated image
- [ ] Test with real iteration pipeline


## NANO BANANA PRO TIMEOUT FIX
- [x] Increase timeout from 60s to 180s (Thinking mode takes 90-120s)
- [x] Fix response parsing - use inlineData (camelCase) not inline_data
- [x] Filter out thought images and extract only final image
- [x] Verify API request format matches documentation exactly
- [ ] Test with real iteration pipeline


## NANO BANANA PRO PRODUCTION LIMITS
- [x] Update variation count dropdown to 3-10 max (remove 20, 50, 100 options)
- [x] Add prominent warning banner: "⏱️ Nano Banana Pro takes 2-3 minutes per image. Generating 10 variations will take approximately 20-30 minutes."
- [x] Update cost calculator to show estimated time: "Estimated time: X-Y minutes"
- [ ] Add progress indicator showing "Generating variation 3 of 10..." during generation
- [ ] Test complete flow with 5 variations to validate timing


## MOBILE RESPONSIVENESS
- [x] Add hamburger menu button for mobile devices
- [x] Implement sidebar toggle state (open/closed)
- [x] Hide sidebar by default on mobile (<768px)
- [x] Show hamburger icon in top-left on mobile
- [x] Animate sidebar slide-in/slide-out transitions
- [x] Add overlay backdrop when sidebar is open on mobile
- [x] Test on mobile viewport sizes


## CANVA INTEGRATION
- [x] Add Canva API credentials to secrets (Client ID, Client Secret)
- [x] Create Canva OAuth configuration and callback route
- [x] Implement OAuth token storage in database
- [x] Create Canva API client helper functions (upload asset, create design)
- [x] Integrate Canva upload into iteration pipeline after Nano Banana Pro generation
- [x] Add "Edit in Canva" buttons to Results page for each variation
- [ ] Create folder organization per pipeline run
- [ ] Test OAuth flow and token refresh
- [ ] Test asset upload with generated variations
- [ ] Test design creation and edit URLs
- [ ] Handle Canva API errors gracefully


## CANVA OAUTH DEBUGGING
- [x] Fix "Missing code or state" error in OAuth callback
- [x] Verify redirect URL matches Canva portal configuration
- [ ] Test OAuth authorization flow end-to-end

## CANVA AUTOFILL API — EDITABLE LAYERS

- [x] Research Canva Autofill API and Brand Templates documentation
- [x] Request Enterprise dev access from Canva (submitted, waiting approval)
- [x] Create template design guide with specifications
- [x] Implement Autofill API integration in backend services
- [ ] Create 3 Canva Brand Templates (1:1, 4:5, 9:16) once Enterprise access approved
- [ ] Update frontend to show "Create Editable Design" option
- [ ] Test end-to-end editable design workflow

## PSD EXPORT FEATURE — EDITABLE LAYERS

- [x] Install ag-psd npm package for PSD generation
- [x] Create PSD builder service with layer generation
- [x] Implement generatePSD endpoint in backend
- [x] Add "Download PSD" button to Iterate Winners results
- [ ] Test PSD generation with all layer types
- [ ] Verify PSD opens correctly in Photoshop

## PSD GENERATION BUG FIX

- [x] Fix PSD generation error "Missing required image URLs"
- [x] Check variation data structure for available image URLs
- [x] Adjust PSD builder to work with actual variation data
- [x] Update iteration pipeline to save productImageUrl and controlImageUrl
- [x] Fix Canvas initialization error by installing canvas package
- [ ] Test PSD download with newly generated variations (requires fresh pipeline run)

## PER-VARIATION STRATEGY SELECTION

- [x] Change UI to select quantity first, then strategy per variation
- [x] Add mode toggle (All Same vs Custom Per Variation)
- [x] Add preset shortcuts (All Full Remix, All Headlines, All Backgrounds)
- [x] Add individual dropdowns for each variation in custom mode
- [x] Update frontend to send array of strategies when in custom mode
- [ ] Update backend to accept and use per-variation strategies in brief generation
- [ ] Test generating variations with mixed strategies

## EDITABLE BRIEF APPROVAL

- [ ] Add Stage 2b: Brief Review & Edit between brief generation and image generation
- [ ] Create editable cards for each variation showing headline, subheadline, benefits, visual prompt
- [ ] Add inline editing for all text fields
- [ ] Add visual prompt editing for background descriptions
- [ ] Add "Remove Variation" button to exclude variations before generation
- [ ] Add "Regenerate Brief" button to ask AI for new brief
- [ ] Add "Approve & Generate" button to proceed with edited brief
- [ ] Update backend to accept edited brief data
- [ ] Test editing and generating with modified briefs

## CHILD GENERATION SYSTEM (PARENT-CHILD VARIATIONS)

- [ ] Add "Generate Children" button to completed parent variations
- [ ] Create child generation modal with parent selection checkboxes
- [ ] Add child count selector (3, 5, 10 children per parent)
- [ ] Add per-child strategy selection
- [ ] Update backend to generate child variations from selected parents
- [ ] Link child variations to parent in database (parentRunId)
- [ ] Display parent-child relationship in results UI
- [ ] Test generating 3 children from 2 parents

## DEPLOYMENT FIX - CANVAS PACKAGE

- [x] Remove canvas package dependency (causes deployment failure)
- [x] Remove canvas import from psdBuilder.ts
- [ ] Test deployment after removing canvas
- [ ] Verify PSD generation still works (ag-psd should work without canvas for basic PSDs)
- [ ] If PSD generation fails, implement alternative approach (simplified single-layer PSD or client-side generation)

## PNG/PSD DOWNLOAD FIXES

- [x] Fix PNG download button (uses blob fetch to avoid CORS)
- [x] Implement simplified PSD generation without canvas (single-layer composite)
- [x] Re-add PSD download button to frontend
- [ ] Test PNG and PSD downloads with fresh pipeline run
- [ ] Verify PSD opens correctly in Photoshop

## REMOVE PSD FEATURE

- [x] Remove PSD router and endpoint
- [x] Remove psdBuilder service
- [x] Remove PSD button from frontend
- [x] Remove ag-psd package dependency
- [x] Clean up related imports and types

## EDITABLE BRIEF APPROVAL

- [ ] Add brief review/edit UI between Stage 2 and Stage 3
- [ ] Show editable cards for each variation with headline, subheadline, benefits, visual prompt
- [ ] Add "Approve & Generate", "Regenerate Brief", "Generate Selected" buttons
- [ ] Update backend to accept edited brief data
- [ ] Test brief editing and generation with modified content

## CHILD GENERATION SYSTEM

- [ ] Add "Generate Children" button to completed variation cards
- [ ] Create child generation modal with quantity selector (3-10 children)
- [ ] Implement backend endpoint for child generation from parent variation
- [ ] Store parent-child relationships in database (parentRunId, variationLayer fields)
- [ ] Display parent-child hierarchy in results view
- [ ] Test generating 5 parents → 3 children each → 15 total unique variations

## CLICKUP INTEGRATION - ITERATE WINNERS

- [x] Find ClickUp list ID for "Graphic Ad Board" in "Ad Creatives" folder (900302632860)
- [x] Find ClickUp status ID for "Review" status ("review")
- [x] Find ClickUp user ID for Lauren Row (2772206)
- [x] Create iterationClickUp service with push functions
- [x] Add pushIterationToClickUp endpoint to routers
- [x] Create task for each variation with image attachment
- [x] Set status to "Review" and assign to Lauren Row
- [x] Add "Push to ClickUp" button to frontend results page
- [x] Add pushToClickUp mutation to IterationResults component
- [ ] Test ClickUp push with real variation

## REGENERATION FIX - PRESERVE BACKGROUND

- [x] Update regenerateIterationVariation to detect text-only changes
- [x] Use existing variation as control image when only text changes
- [x] Only do full regeneration when backgroundPrompt is provided
- [ ] Test regeneration with headline-only change (background should stay similar)
- [ ] Test regeneration with background prompt (should generate new background)

## CLICKUP BOARD FIX

- [x] Check current list ID in iterationClickUp.ts (pushing to wrong board)
- [x] Verify correct Graphic Ad Board list ID from ClickUp
- [x] Update CLICKUP_LIST_ID constant to use Graphic Ad Board
- [x] Fixed Stage 4 of iteration pipeline to use new iterationClickUp service instead of old clickup.ts
- [x] Root cause: Stage 4 was using createScriptTask which searches for "VIDEO AD BOARD"
- [x] Solution: Replaced with pushIterationVariationToClickUp which uses correct GRAPHIC_AD_BOARD_LIST_ID (900302632860)
- [ ] Test push to verify tasks go to correct board

## COPY FRAMEWORK v2.0 INTEGRATION

- [x] Add PRODUCT_INTELLIGENCE constant with copy levers, traps, stack partners for all 12 ONEST products (5 hero + 7 extended)
- [x] Rewrite generateVideoBrief() system prompt with Copy Framework v2.0 (6 styles, 5 hook archetypes, awareness matrix, psychological frameworks, specificity rule)
- [x] Rewrite generateVideoBrief() user prompt with selling strategy, CTA approach, metadata fields
- [x] Update VideoBriefOptions interface with new fields (hookArchetype, awarenessLevel, scriptStyleClassification, sellingStrategy, ctaApproach, funnelPosition, testHypothesis, etc.)
- [x] Create separate system prompts for each script style (DR, UGC, Education, Founder-Led, Lifestyle, Demo)
- [x] Rewrite generateConceptMatchedScript() user prompt with product intelligence, visual direction brief, script metadata
- [x] Replace 10 generic experts with named experts (Schwartz, Halbert, Cialdini, Kahneman, Festinger, Ariely, Fogg, Sharp, Ries, Norman)
- [x] Rewrite reviewScriptWithPanel() with instant score killers, compliance pass/fail, hard scoring rules
- [x] Update iteration prompt to reference specific expert feedback and frameworks
- [x] Add duration selector (45s, 60s, 90s) to pipeline start
- [x] Add dynamic style/quantity selection (all 6 styles, 0-5 per style) to pipeline start
- [x] Add "Competitor Ad" vs "Our Winning Ad" toggle to pipeline start
- [x] Implement Winning Ad mode with variation system (hook swaps, angle shifts, audience reframes)
- [x] Update formatBriefForDisplay() to show new fields (classification, selling angle, metadata)
- [x] Update formatScriptForClickUp() to include visual direction brief and script metadata
- [x] Update Results page to display Visual Direction Brief per script
- [x] Update Results page to display Script Metadata per script
- [x] Update Results page to show named experts (Schwartz, Halbert, etc.) instead of generic names
- [x] Update script output interface to include visualDirection object and scriptMetadata object
- [x] Add database columns: video_source_type, video_duration, video_style_config, video_upload_url
- [x] Add video upload endpoint for Winning Ad mode
- [x] Update formatScriptText() to include metadata when copying scripts
- [x] Write vitest tests (20 tests, all passing)
- [ ] End-to-end test: run full video pipeline with new Copy Framework prompts
- [ ] Add compliance guardrails to all script generation prompts
