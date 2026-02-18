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
- [ ] TEST: End-to-end video pipeline with transcription
- [ ] TEST: End-to-end static pipeline with image generation
