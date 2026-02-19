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
