/**
 * Timezone-aware date helpers for analytics sync + reporting.
 *
 * All ad accounts we sync (Meta, Hyros) are anchored to Australia/Sydney. To
 * make our numbers line up with what Meta Ads Manager and Hyros dashboard
 * show, every date boundary — API query params, DB bucketing, report filters
 * — must use the same calendar day as those UIs. Mixing UTC and Sydney
 * boundaries silently shifts revenue by up to a day near midnight.
 *
 * Two primitives:
 *   - `formatYmdInTz(d, tz)` → "YYYY-MM-DD" for a Date's calendar day in tz.
 *     Used when building API query params that the remote interprets in its
 *     account timezone (Meta `time_range.since/until`, Hyros fromDate/toDate).
 *
 *   - `tzMidnightAsUtc(d, tz)` → the UTC Date instant that corresponds to
 *     midnight of `d`'s calendar day in `tz`. Used for DB bucketing so that
 *     a sync row's `date` column represents "start of the Sydney day this
 *     event belongs to" — regardless of what UTC hour the event landed on.
 *
 * Uses Intl.DateTimeFormat (native Node, no library needed) so DST is
 * handled correctly. Sydney flips between AEST (UTC+10) and AEDT (UTC+11)
 * twice a year; we never hardcode an offset.
 */

/**
 * The reporting timezone. Hardcoded to Australia/Sydney for V1 because both
 * the AU Meta account and the Hyros store are anchored there. When
 * multi-region support is added, thread this through ENV.
 */
export const REPORTING_TZ = "Australia/Sydney";

/**
 * Format a Date as "YYYY-MM-DD" in the given timezone's calendar.
 *
 * Example: `formatYmdInTz(new Date("2026-04-15T14:30:00Z"), "Australia/Sydney")`
 *   = "2026-04-16"  (14:30 UTC is 00:30 next day in Sydney during AEST)
 *
 * Uses `en-CA` locale because its short-date format happens to be ISO
 * "YYYY-MM-DD" out of the box. Avoids building the string from parts.
 */
export function formatYmdInTz(d: Date, tz: string = REPORTING_TZ): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Return the UTC Date instant that represents midnight of `d`'s calendar day
 * in the given timezone.
 *
 * Algorithm:
 *   1. Get YYYY-MM-DD of `d` in `tz` (via Intl).
 *   2. Start with UTC midnight of that YYYY-MM-DD as a rough guess.
 *   3. Compute the offset of `tz` at that guess instant.
 *   4. Subtract the offset to get the actual UTC instant for tz-midnight.
 *
 * DST edge cases: Sydney never falls back across midnight (DST transitions
 * happen at 02:00/03:00 local), so step 3 always lands in a stable-offset
 * window — we don't need the iterative refinement some TZ libs use.
 */
export function tzMidnightAsUtc(d: Date, tz: string = REPORTING_TZ): Date {
  const ymd = formatYmdInTz(d, tz);
  const year = parseInt(ymd.slice(0, 4), 10);
  const month = parseInt(ymd.slice(5, 7), 10);
  const day = parseInt(ymd.slice(8, 10), 10);
  const utcGuess = new Date(Date.UTC(year, month - 1, day));
  const offsetMin = getTzOffsetMinutes(utcGuess, tz);
  return new Date(utcGuess.getTime() - offsetMin * 60_000);
}

/**
 * Return the offset (in minutes) between the given timezone and UTC at the
 * given instant. Positive for east-of-UTC (Sydney AEST = +600, AEDT = +660).
 *
 * Works by formatting the instant as local-time parts in the target tz, then
 * interpreting those parts as-if-UTC and taking the delta.
 */
export function getTzOffsetMinutes(d: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(d);
  const pick = (type: string): number => {
    const p = parts.find((x) => x.type === type);
    return p ? parseInt(p.value, 10) : 0;
  };
  const asUtc = Date.UTC(
    pick("year"),
    pick("month") - 1,
    pick("day"),
    pick("hour"),
    pick("minute"),
    pick("second"),
  );
  return Math.round((asUtc - d.getTime()) / 60_000);
}

/**
 * Parse an API-returned date string (Meta's "YYYY-MM-DD", Hyros's
 * "Thu Apr 09 10:33:18 UTC 2026") and bucket it to the target-tz midnight
 * UTC instant. Returns null for unparseable input so callers can `salesSkipped++`.
 *
 * For bare "YYYY-MM-DD" input (Meta insight rows), treats the string as
 * already being a calendar day in the target timezone — no conversion, just
 * anchoring to midnight in that tz.
 */
export function parseAndBucketToTz(
  raw: string | undefined | null,
  tz: string = REPORTING_TZ,
): Date | null {
  if (!raw) return null;
  // Bare YYYY-MM-DD from Meta: the string IS the tz-calendar day. Skip reparse.
  const bareYmd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (bareYmd) {
    const [, y, m, d] = bareYmd;
    const utcGuess = new Date(Date.UTC(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10)));
    const offsetMin = getTzOffsetMinutes(utcGuess, tz);
    return new Date(utcGuess.getTime() - offsetMin * 60_000);
  }
  const parsed = new Date(raw);
  if (isNaN(parsed.getTime())) return null;
  return tzMidnightAsUtc(parsed, tz);
}
