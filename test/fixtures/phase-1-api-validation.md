# Phase 1: API Validation Report — COMPLETE

**Date:** 2026-04-09
**Status:** BOTH APIs confirmed working. Ready for Phase 2 (schema migrations).

## Summary

| Source | Status | Access tier | Key findings |
|--------|--------|-------------|--------------|
| Hyros | ✅ WORKING | Full API access | Sales + ads + leads endpoints. Attribution via `firstSource.adSource.adSourceId` (Meta ad ID). |
| Meta Marketing API | ✅ WORKING | `development_access` tier | Sufficient for our workload. No App Review needed. |

## Hyros API — CONFIRMED

### Connection

- **Base URL:** `https://api.hyros.com/v1/api/v1.0`
- **Auth:** `API-Key: <key>` header (NOT `Authorization: Bearer`)
- **Rate limits:** `1000 req/min` + `30 req/sec` (per `x-ratelimit-limit` header)
- **Working key saved to:** `.env` as `HYROS_API_KEY`

### Confirmed endpoints

| Method + Path | Purpose | Fixture |
|---------------|---------|---------|
| `GET /ads` | List Hyros-tracked ads with Meta ad ID mapping | `hyros-ads-sample.json` (50 ads) |
| `GET /sales?fromDate=X&toDate=Y` | List individual sales with firstSource + lastSource attribution | `hyros-sales-sample.json` (50 sales) |
| `GET /leads` | List leads with attribution | `hyros-leads-sample.json` |
| `GET /sources` | List traffic sources/ad groups | Not saved |
| `GET /tags` | List tags | Not saved |
| `GET /calls` | Call tracking | Not saved |

All return `{result: T[], nextPageId, request_id}` with cursor pagination.

### Attribution model (critical)

Hyros tracks at the **sale level**, not the ad level. Each sale has:

```json
{
  "id": "sle-...",
  "usdPrice": 49.95,
  "creationDate": "Thu Apr 09 10:33:18 UTC 2026",
  "firstSource": {
    "adSource": {
      "adSourceId": "120248392781030538",   // <-- Meta ad ID (adset-level in this case)
      "adAccountId": "1177018326051265",
      "platform": "FACEBOOK"
    },
    "sourceLinkAd": {
      "name": "1902_Creative mashup Feb#3_HOOK_KATH_WASH YOUR WEIGHT_SMC_1 – Copy",
      "adSourceId": "120248900448440538"    // <-- actual ad-level ID
    },
    "clickDate": "2026-04-09T20:31:31Z",
    "category": { "name": "..." }
  },
  "lastSource": { /* same shape, different attribution window */ }
}
```

**Attribution coverage:** 46/50 (92%) of sampled ONEST sales have `firstSource.adSource` populated. The rest are organic/direct/email.

**Both Facebook AND Google platforms tracked.** V1 uses Meta only, but Google is there for V2.

### How we aggregate to daily per-ad stats

Sync pseudocode:
```
for each sale in /sales?fromDate=X&toDate=Y (paginated):
  if sale.firstSource.sourceLinkAd?.adSourceId exists:
    key = (sale.firstSource.sourceLinkAd.adSourceId, bucket_to_date(sale.creationDate))
    stats[key].revenue += sale.usdPrice * 100  // store as cents
    stats[key].conversions += 1

for each (hyrosAdId, date), stats in aggregated:
  upsert adAttributionStats row
```

Use `sourceLinkAd.adSourceId` (ad-level) in preference to `adSource.adSourceId` (may be adset-level). This is the actual Meta ad ID for linking.

V1 uses **first-click attribution**. V1.5 can expose a toggle to compute from `lastSource` instead.

## Meta Marketing API — CONFIRMED

### Connection

- **Base URL:** `https://graph.facebook.com/v22.0`
- **Auth:** `?access_token=<token>` query param (System User token, **never expires**)
- **Identity:** `PerformCreative API` system user, id `122099390936787805`
- **Access tier:** `development_access` (sufficient for our workload, see rate limits below)
- **Working token saved to:** `.env` as `META_ACCESS_TOKEN`

### Ad accounts discovered

| Account ID | Name | Lifetime Spend | Notes |
|-----------|------|---------------|-------|
| `act_1177018326051265` | **Onest Health AU** | $5,593,833.54 | Primary account, matches Hyros attribution |
| `act_2387933734797386` | **Onest Health** (US) | $282,985.88 | Smaller, for US market |

Both accounts need to be synced. User confirmed: "We have a US store and AU store. that's why there's two."

**Total ads on ONEST AU alone: 23,915** (all time, active + paused + archived). Realistic active count: probably 500-2000 at any given time.

### Rate limits (development tier)

From `X-Business-Use-Case-Usage` header:

```
ads_insights:   600 + (400 × active_ads) calls/hour per account
ads_management: 300 + (40 × active_ads) calls/hour per account
```

For ONEST AU with ~500-2000 active ads:
- Insights budget: **200,000 - 800,000 calls/hour** per account
- Our daily sync needs: ~100-500 calls/day (2 accounts × daily insights paged + creative lookups)
- **No App Review needed.** Development tier is plenty.

### Confirmed endpoints + fixtures

| Endpoint | Purpose | Fixture |
|----------|---------|---------|
| `GET /me` | Validate token | — |
| `GET /me/adaccounts?fields=id,name,account_status,amount_spent` | List accessible accounts | — |
| `GET /act_{id}/ads?fields=...&limit=N` | List ads with creative nested | `meta-ads-sample.json` |
| `GET /act_{id}/ads?summary=total_count&limit=1` | Get total ad count | — |
| `GET /act_{id}/insights?level=ad&time_range=...&fields=...` | Aggregated insights per ad | `meta-insights-aggregated.json` |
| `GET /act_{id}/insights?level=ad&time_range=...&time_increment=1&fields=...` | **Daily** per-ad insights | `meta-insights-daily.json` |
| `GET /{ad_id}?fields=id,name,creative{id,thumbnail_url,video_id,body,title}` | Get ad + creative details | `meta-ad-creative-sample.json` |

### Important: Field shape quirks

**Video metrics come as arrays of action objects, not scalars:**

```json
"video_p50_watched_actions": [
  { "action_type": "video_view", "value": "3" }
]
```

To extract the number, filter by `action_type === "video_view"` and parse `.value` as int.

**Actions field** is a similar array with multiple action_types (purchase, add_to_cart, etc.). We ignore these for V1 scoring (Hyros handles conversion attribution).

**`video_3_sec_watched_actions` is REMOVED in v22.** Use `video_play_actions` instead (plays ≥ 2 seconds).

### Metric formula mapping (LOCKED for scoreEngine)

```ts
// All inputs in basis points (x100 → x10000 in storage)
// For a given ad's daily insight row:

impressions = parseInt(row.impressions)

// Thumbstop = Motion's "3-second view rate" approximation
videoPlayCount = row.video_play_actions?.find(a => a.action_type === "video_view")?.value ?? 0
thumbstopBp = impressions > 0 ? Math.round((videoPlayCount / impressions) * 10000) : 0

// Hold rate = Motion's "50% view rate"
video50Count = row.video_p50_watched_actions?.find(a => a.action_type === "video_view")?.value ?? 0
holdRateBp = impressions > 0 ? Math.round((video50Count / impressions) * 10000) : 0

// CTR (Meta reports as %, we convert to bp × 100 = x10000)
ctrBp = Math.round(parseFloat(row.ctr ?? 0) * 10000)  // "2.50" → 25000

// Spend (Meta reports as string USD like "0.03", we convert to cents)
spendCents = Math.round(parseFloat(row.spend ?? 0) * 100)

// CPM, CPC
cpmCents = Math.round(parseFloat(row.cpm ?? 0) * 100)
cpcCents = Math.round(parseFloat(row.cpc ?? 0) * 100)
```

### Nested field query syntax

To fetch creative inline with ad, use curl with `--data-urlencode` (NOT command-line args) to avoid shell escaping the braces:

```bash
curl -G "$BASE/$AD_ID" \
  --data-urlencode "fields=id,name,creative{id,thumbnail_url,video_id,body,title}" \
  --data-urlencode "access_token=$TOKEN"
```

TypeScript axios calls won't have this issue — they serialize query params properly.

### Rate limit monitoring

Every response includes the `X-Business-Use-Case-Usage` header:

```json
{
  "1177018326051265": [{
    "type": "ads_insights",
    "call_count": 1,
    "total_cputime": 1,
    "total_time": 2,
    "estimated_time_to_regain_access": 0,
    "ads_api_access_tier": "development_access"
  }]
}
```

When `call_count`, `total_cputime`, or `total_time` approach 80, back off. When `estimated_time_to_regain_access > 0`, sleep that many minutes.

## Plan updates required

The revised plan needs minor updates based on Phase 1 findings. Applying to the plan file next:

1. **Dual ad account support** — sync BOTH `act_1177018326051265` (AU) AND `act_2387933734797386` (US)
   - `adSyncState` table: one row per account (compound key on `sourceName + adAccountId`)
   - `ads` table: already has `adAccountId` column ✓
   - `creativeAssets` table: scope `creativeHash` uniqueness to include `adAccountId`? Or treat creatives as global? Decision: **global** — if the same video is used in both US and AU accounts, it's the same creative asset with summed stats.

2. **Thumbstop formula** — use `video_play_actions` not `video_3_sec_watched_actions`. Document in the score engine spec.

3. **Hyros `sourceLinkAd.adSourceId` is the join key**, not `firstSource.adSource.adSourceId` (which can be adset-level).

4. **Meta field arrays** need unwrapping — the sync service must extract `.value` from the action arrays before storing.

5. **Config is multi-account** — `ENV.metaAdAccountIds` is a CSV of account IDs, not a single value.

## Security

- Both API keys saved to local `.env` only (gitignored, confirmed via `git ls-files`)
- Keys will need to be added to DigitalOcean App Platform env config before production deploy
- No keys saved in memory files, plan files, commit history, or any git-tracked location

## Phase 1 Gate: PASSED ✅

Both data sources validated. Metric formulas confirmed. Field shapes understood. Rate limits within budget. Ready to proceed to Phase 2 (schema migrations).
