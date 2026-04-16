/**
 * Ad Detail page — per-creative deep dive.
 *
 * Layout:
 *   1. Back link + creative header (thumbnail + name + launch date + type)
 *   2. Score row (Hook/Watch/Click/Convert, cardless)
 *   3. Metric summary (Spend/Revenue/ROAS/AOV/CPA/Conversions)
 *   4. Time series chart (inline SVG, no Recharts dependency)
 *   5. Ads table (Meta ads using this creative)
 *   6. Linked pipeline asset card (if any)
 */
import { useMemo, useState } from "react";
import { useLocation, useRoute, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, BarChart3, PlayCircle } from "lucide-react";
import { CreativePreviewDialog } from "@/components/analytics/CreativePreviewDialog";

const VALID_DAYS = new Set([7, 14, 30, 90]);
function parseDaysFromSearch(search: string): number {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const raw = Number(params.get("days"));
  return VALID_DAYS.has(raw) ? raw : 30;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function formatInt(n: number): string {
  return n.toLocaleString();
}
function scoreColor(s: number) {
  if (s >= 70) return "#10B981";
  if (s >= 40) return "#F59E0B";
  return "#EF4444";
}

function ScoreBlock({ label, score }: { label: string; score: number }) {
  return (
    <div className="flex flex-col gap-2 pr-8 border-r border-[rgba(255,255,255,0.06)] last:border-r-0">
      <div className="text-[11px] uppercase tracking-wider text-[#71717A] font-medium">{label}</div>
      <div className="text-[32px] font-mono tabular-nums font-medium" style={{ color: scoreColor(score) }}>{score}</div>
      <div className="h-[2px] w-16 bg-[rgba(255,255,255,0.06)]">
        <div className="h-full" style={{ width: `${Math.max(0, Math.min(100, score))}%`, backgroundColor: scoreColor(score) }} />
      </div>
    </div>
  );
}

function MetricCell({ label, value, subLabel }: { label: string; value: string; subLabel?: string }) {
  return (
    <div className="flex flex-col gap-1 pr-8 border-r border-[rgba(255,255,255,0.06)] last:border-r-0">
      <div className="text-[11px] uppercase tracking-wider text-[#71717A] font-medium">{label}</div>
      <div className="text-xl font-mono tabular-nums text-white font-medium">{value}</div>
      {subLabel && <div className="text-[11px] text-[#A1A1AA] font-mono">{subLabel}</div>}
    </div>
  );
}

function TimeSeriesChart({ data, height = 240 }: { data: { date: Date; spendCents: number; roasBp: number }[]; height?: number }) {
  const width = 800;
  const pad = { top: 16, right: 16, bottom: 28, left: 48 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[240px] text-[#71717A] text-sm">
        No data for this range
      </div>
    );
  }

  const maxSpend = Math.max(1, ...data.map((d) => d.spendCents));
  const maxRoas = Math.max(100, ...data.map((d) => d.roasBp));

  const xStep = innerW / Math.max(1, data.length - 1);
  const spendPath = data.map((d, i) => {
    const x = pad.left + i * xStep;
    const y = pad.top + innerH - (d.spendCents / maxSpend) * innerH;
    return `${i === 0 ? "M" : "L"} ${x} ${y}`;
  }).join(" ");
  const roasPath = data.map((d, i) => {
    const x = pad.left + i * xStep;
    const y = pad.top + innerH - (d.roasBp / maxRoas) * innerH;
    return `${i === 0 ? "M" : "L"} ${x} ${y}`;
  }).join(" ");

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        {/* Gridlines */}
        {[0.25, 0.5, 0.75].map((p, i) => (
          <line key={i} x1={pad.left} x2={pad.left + innerW} y1={pad.top + innerH * p} y2={pad.top + innerH * p} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        ))}
        <path d={spendPath} fill="none" stroke="#FF3838" strokeWidth="2" />
        <path d={roasPath} fill="none" stroke="#10B981" strokeWidth="2" />
        {/* Axis labels */}
        <text x={pad.left} y={pad.top + innerH + 18} fill="#71717A" fontSize="11" fontFamily="ui-monospace, monospace">
          {data[0].date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </text>
        <text x={pad.left + innerW - 60} y={pad.top + innerH + 18} fill="#71717A" fontSize="11" fontFamily="ui-monospace, monospace">
          {data[data.length - 1].date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </text>
        <text x={pad.left + innerW} y={pad.top + 12} fill="#FF3838" fontSize="11" fontFamily="ui-monospace, monospace" textAnchor="end">
          Spend
        </text>
        <text x={pad.left + innerW} y={pad.top + 26} fill="#10B981" fontSize="11" fontFamily="ui-monospace, monospace" textAnchor="end">
          ROAS
        </text>
      </svg>
    </div>
  );
}

export default function AdDetail() {
  const [, params] = useRoute("/analytics/ads/:id");
  const [, setLocation] = useLocation();
  const search = useSearch();
  const creativeAssetId = params?.id ? Number(params.id) : NaN;

  // Read the lookback from the query string so clicking from a 90-day table
  // view lands on a 90-day detail view (not a hardcoded 30-day fallback).
  const lookbackDays = useMemo(() => parseDaysFromSearch(search ?? ""), [search]);
  const { dateFrom, dateTo } = useMemo(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - lookbackDays);
    return { dateFrom: from, dateTo: to };
  }, [lookbackDays]);

  const detail = trpc.analytics.getCreativeDetail.useQuery(
    { creativeAssetId },
    { enabled: !isNaN(creativeAssetId) }
  );
  const timeSeries = trpc.analytics.getCreativeTimeSeries.useQuery(
    { creativeAssetId, dateFrom, dateTo },
    { enabled: !isNaN(creativeAssetId) }
  );
  // Single-row lookup scoped to this creative + date range. Replaces the
  // old "refetch top-500 and find by id" hack.
  const perfRowQuery = trpc.analytics.getCreativeRow.useQuery(
    { creativeAssetId, dateFrom, dateTo },
    { enabled: !isNaN(creativeAssetId) }
  );
  const perfRow = perfRowQuery.data ?? null;

  // Back nav preserves the filter state the user came from. If they deep-linked
  // directly to AdDetail with no ?days param, fall back to the current lookback.
  const backQueryString = (search && search.length > 0) ? (search.startsWith("?") ? search : `?${search}`) : `?days=${lookbackDays}`;
  const backHref = `/analytics${backQueryString}`;

  const [previewOpen, setPreviewOpen] = useState(false);

  if (isNaN(creativeAssetId)) {
    return <div className="p-6 text-white">Invalid creative ID</div>;
  }

  if (detail.isLoading) {
    return (
      <div className="min-h-screen bg-[#0A0B0D] p-6">
        <Skeleton className="h-8 w-48 mb-6 bg-[rgba(255,255,255,0.06)]" />
        <Skeleton className="h-32 w-full mb-6 bg-[rgba(255,255,255,0.06)]" />
        <Skeleton className="h-64 w-full bg-[rgba(255,255,255,0.06)]" />
      </div>
    );
  }

  if (!detail.data) {
    return (
      <div className="min-h-screen bg-[#0A0B0D] p-6 text-white">
        <Button variant="ghost" onClick={() => setLocation(backHref)} className="text-[#A1A1AA] mb-4">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Creative Performance
        </Button>
        <p>Creative not found.</p>
      </div>
    );
  }

  const asset = detail.data.asset;
  const ads = detail.data.ads;

  return (
    <div className="min-h-screen bg-[#0A0B0D] text-white">
      <div className="px-6 py-5">
        <Button
          variant="ghost"
          onClick={() => setLocation(backHref)}
          className="text-[#A1A1AA] hover:text-white hover:bg-[#15171B] mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Creative Performance
        </Button>

        {/* Header */}
        <div className="flex gap-6 mb-8">
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            aria-label={`Preview ${asset.name || "creative"}`}
            className="relative w-[120px] h-[120px] rounded-lg bg-[#15171B] overflow-hidden flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-[#FF3838] group"
          >
            {asset.thumbnailUrl ? (
              <img
                src={asset.thumbnailUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <BarChart3 className="w-10 h-10 text-[#71717A]" />
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-80 group-hover:opacity-100 transition-opacity">
              <PlayCircle className="w-10 h-10 text-white drop-shadow-md" />
            </div>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-semibold text-white truncate">{asset.name || "(unnamed creative)"}</h1>
            <div className="flex gap-4 mt-2 text-sm text-[#A1A1AA]">
              <span className="uppercase tracking-wider text-[11px] font-medium px-2 py-0.5 rounded-full bg-[rgba(255,255,255,0.05)]">
                {asset.creativeType}
              </span>
              <span>Launched: {asset.firstSeenAt ? new Date(asset.firstSeenAt).toLocaleDateString() : "—"}</span>
              <span>{ads.length} ad{ads.length !== 1 ? "s" : ""} using this creative</span>
            </div>
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="inline-flex items-center gap-1 text-sm text-[#FF3838] hover:text-[#FF5555] mt-2"
            >
              <PlayCircle className="w-4 h-4" /> Preview ad
            </button>
          </div>
        </div>

        {/* Score row */}
        {perfRow && (
          <div className="flex flex-wrap gap-8 mb-8 p-6 bg-[#15171B] rounded-lg border border-[rgba(255,255,255,0.06)]">
            <ScoreBlock label="Hook" score={perfRow.hookScore} />
            <ScoreBlock label="Watch" score={perfRow.watchScore} />
            <ScoreBlock label="Click" score={perfRow.clickScore} />
            <ScoreBlock label="Convert" score={perfRow.convertScore} />
          </div>
        )}

        {/* Metric summary */}
        {perfRow && (
          <div className="flex flex-wrap gap-8 mb-8 p-6 bg-[#15171B] rounded-lg border border-[rgba(255,255,255,0.06)]">
            {/* Both values reconcile to the Hyros dashboard. Revenue comes directly
                from Hyros /sales attribution. Spend is Meta's number, which is exactly
                what the Hyros dashboard displays (Hyros pulls spend from the Meta API
                — same upstream source). Labeled 'Hyros' so ROAS here matches Hyros UI. */}
            <MetricCell label="Spend" value={formatCents(perfRow.spendCents)} subLabel="Hyros" />
            <MetricCell label="Revenue" value={formatCents(perfRow.revenueCents)} subLabel="Hyros" />
            <MetricCell label="ROAS" value={`${(perfRow.roasBp / 100).toFixed(2)}x`} />
            <MetricCell label="AOV" value={formatCents(perfRow.aovCents)} />
            <MetricCell label="CPA" value={formatCents(perfRow.cpaCents)} />
            <MetricCell label="Impressions" value={formatInt(perfRow.impressions)} />
            <MetricCell label="Conversions" value={formatInt(perfRow.conversions)} />
          </div>
        )}

        {/* Time series */}
        <div className="mb-8 p-6 bg-[#15171B] rounded-lg border border-[rgba(255,255,255,0.06)]">
          <h2 className="text-sm uppercase tracking-wider text-[#71717A] font-medium mb-4">Daily Performance (Last {lookbackDays} Days)</h2>
          {timeSeries.isLoading ? (
            <Skeleton className="h-[240px] w-full bg-[rgba(255,255,255,0.04)]" />
          ) : (
            <TimeSeriesChart data={(timeSeries.data ?? []).map((d) => ({ date: new Date(d.date), spendCents: d.spendCents, roasBp: d.roasBp }))} />
          )}
        </div>

        {/* Ads table */}
        <div className="mb-8 p-6 bg-[#15171B] rounded-lg border border-[rgba(255,255,255,0.06)]">
          <h2 className="text-sm uppercase tracking-wider text-[#71717A] font-medium mb-4">Meta Ads Using This Creative ({ads.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-[#71717A] border-b border-[rgba(255,255,255,0.06)]">
                  <th className="pb-2 font-medium">Ad Name</th>
                  <th className="pb-2 font-medium">Campaign</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Launched</th>
                </tr>
              </thead>
              <tbody>
                {ads.slice(0, 20).map((ad) => (
                  <tr key={ad.id} className="border-b border-[rgba(255,255,255,0.06)]">
                    <td className="py-2 text-white truncate max-w-[300px]">{ad.name}</td>
                    <td className="py-2 text-[#A1A1AA] truncate max-w-[240px]">{ad.campaignName ?? "—"}</td>
                    <td className="py-2 text-[#A1A1AA] text-xs">{ad.status}</td>
                    <td className="py-2 text-[#A1A1AA] font-mono tabular-nums text-xs">
                      {ad.launchDate ? new Date(ad.launchDate).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
                {ads.length > 20 && (
                  <tr>
                    <td colSpan={4} className="py-2 text-center text-[11px] text-[#71717A]">
                      +{ads.length - 20} more ads
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Linked pipeline */}
        {asset.pipelineRunId && (
          <div className="mb-8 p-6 bg-[#15171B] rounded-lg border border-[rgba(255,255,255,0.06)]">
            <h2 className="text-sm uppercase tracking-wider text-[#71717A] font-medium mb-4">Perform Pipeline Link</h2>
            <a
              href={`/results/${asset.pipelineRunId}`}
              className="text-sm text-[#FF3838] hover:text-[#FF5555]"
            >
              View pipeline run #{asset.pipelineRunId}
            </a>
          </div>
        )}
      </div>

      <CreativePreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        creativeAssetId={creativeAssetId}
        creativeName={asset.name ?? ""}
        thumbnailUrl={asset.thumbnailUrl ?? null}
      />
    </div>
  );
}
