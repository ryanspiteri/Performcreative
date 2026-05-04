/**
 * Creative Performance page — the Motion replacement landing view.
 *
 * Layout (per plan):
 *   1. Page header (h1)
 *   2. Filter bar (sticky): date range, creative type, account
 *   3. KPI strip (4 cardless metrics)
 *   4. Table (14 columns, sticky first 2 cols on scroll)
 *
 * Design compliance:
 *   - Dark theme tokens (bg-page, bg-surface, border-subtle)
 *   - Geist font, 14px base
 *   - Numeric cells: font-mono tabular-nums
 *   - Score thresholds: green 70+, yellow 40-69, red 0-39 (semantic tokens)
 */
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, ArrowDown, ArrowUp, RefreshCw, Settings, PlayCircle, Sparkles, Loader2, TrendingDown } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CreativePreviewDialog } from "@/components/analytics/CreativePreviewDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

type SortBy = "spendCents" | "revenueCents" | "roasBp" | "hookScore" | "watchScore" | "clickScore" | "convertScore" | "launchDate";
type CreativeType = "all" | "video" | "image";
type SortDir = "asc" | "desc";

// Allowlist for URL query-string validation. Invalid values fall back to defaults.
const VALID_DAYS = new Set([7, 14, 30, 90]);
const VALID_TYPES: CreativeType[] = ["all", "video", "image"];
const VALID_SORTS: SortBy[] = ["spendCents", "revenueCents", "roasBp", "hookScore", "watchScore", "clickScore", "convertScore", "launchDate"];
const VALID_DIRS: SortDir[] = ["asc", "desc"];

interface FilterState {
  days: number;
  type: CreativeType;
  sort: SortBy;
  dir: SortDir;
  campaign: string; // "" = all
  account: string;  // "" = all
  minSpend: number; // 0 = no minimum
}

function parseFilters(search: string): FilterState {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const daysRaw = Number(params.get("days"));
  const days = VALID_DAYS.has(daysRaw) ? daysRaw : 30;
  const typeRaw = params.get("type");
  const type = (VALID_TYPES as string[]).includes(typeRaw ?? "") ? (typeRaw as CreativeType) : "all";
  const sortRaw = params.get("sort") as SortBy | null;
  const sort = sortRaw && VALID_SORTS.includes(sortRaw) ? sortRaw : "spendCents";
  const dirRaw = params.get("dir") as SortDir | null;
  const dir = dirRaw && VALID_DIRS.includes(dirRaw) ? dirRaw : "desc";
  const campaign = params.get("campaign") ?? "";
  const account = params.get("account") ?? "";
  const minSpendRaw = Number(params.get("minSpend"));
  const minSpend = Number.isFinite(minSpendRaw) && minSpendRaw > 0 ? minSpendRaw : 0;
  return { days, type, sort, dir, campaign, account, minSpend };
}

function serializeFilters(f: FilterState): string {
  const params = new URLSearchParams();
  params.set("days", String(f.days));
  if (f.type !== "all") params.set("type", f.type);
  params.set("sort", f.sort);
  params.set("dir", f.dir);
  if (f.campaign) params.set("campaign", f.campaign);
  if (f.account) params.set("account", f.account);
  if (f.minSpend > 0) params.set("minSpend", String(f.minSpend));
  return params.toString();
}

const DATE_PRESETS = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 14 days", days: 14 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
];

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function formatBpAsRoas(bp: number): string {
  return `${(bp / 100).toFixed(2)}x`;
}
function formatBpAsPct(bp: number): string {
  return `${(bp / 100).toFixed(2)}%`;
}
function formatInt(n: number): string {
  return n.toLocaleString();
}
function scoreColorClass(score: number): string {
  if (score >= 70) return "text-[#10B981]";
  if (score >= 40) return "text-[#F59E0B]";
  return "text-[#EF4444]";
}
function scoreFillClass(score: number): string {
  if (score >= 70) return "bg-[#10B981]";
  if (score >= 40) return "bg-[#F59E0B]";
  return "bg-[#EF4444]";
}

/** Formats the underlying metric value shown inside a score tooltip. */
function formatScoreMetric(label: string, bpOrCount: number): string {
  switch (label) {
    case "Hook":
      return `${(bpOrCount / 100).toFixed(2)}% thumbstop rate`;
    case "Watch":
      return `${(bpOrCount / 100).toFixed(2)}% hold rate`;
    case "Click":
      return `${(bpOrCount / 100).toFixed(2)}% CTR`;
    case "Convert":
      return `${(bpOrCount / 100).toFixed(2)}x ROAS`;
    default:
      return String(bpOrCount);
  }
}

function ScoreCell({ score, label, metricBp }: { score: number; label: string; metricBp: number }) {
  const metricText = formatScoreMetric(label, metricBp);
  return (
    <TooltipProvider delayDuration={400}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex flex-col gap-1 items-end min-w-[48px]" aria-label={`${label} score ${score} of 100`}>
            <span className={`font-mono tabular-nums text-sm font-medium ${scoreColorClass(score)}`}>{score}</span>
            <div className="w-12 h-[2px] bg-[rgba(255,255,255,0.06)] rounded-none">
              <div className={`h-full ${scoreFillClass(score)}`} style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[300px]">
          <div className="text-sm">
            <div className="font-medium">{label} score: {score}/100</div>
            <div className="text-xs text-[#A1A1AA] mt-1">
              This creative's {metricText} beats {score}% of your account's ads in the last 90 days.
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function KpiCard({ label, value, subLabel }: { label: string; value: string; subLabel?: string }) {
  return (
    <div className="flex flex-col gap-1 p-6 border-r border-[rgba(255,255,255,0.06)] last:border-r-0">
      <div className="text-[11px] uppercase tracking-wider text-[#71717A] font-medium">{label}</div>
      <div className="text-[32px] font-mono tabular-nums text-white font-medium">{value}</div>
      {subLabel && <div className="text-[13px] text-[#A1A1AA] font-mono">{subLabel}</div>}
    </div>
  );
}

export default function CreativePerformance() {
  const [, setLocation] = useLocation();

  // Hydrate filters from the URL query string on first render so deep-links
  // and back-nav from AdDetail preserve state.
  const initial = typeof window !== "undefined" ? parseFilters(window.location.search) : parseFilters("");
  const [lookbackDays, setLookbackDays] = useState(initial.days);
  const [creativeType, setCreativeType] = useState<CreativeType>(initial.type);
  const [sortBy, setSortBy] = useState<SortBy>(initial.sort);
  const [sortDir, setSortDir] = useState<SortDir>(initial.dir);
  const [campaignFilter, setCampaignFilter] = useState(initial.campaign);
  const [accountFilter, setAccountFilter] = useState(initial.account);
  const [minSpend, setMinSpend] = useState(initial.minSpend);
  // Wave 1e — AI tag filters
  const [messagingAngleFilter, setMessagingAngleFilter] = useState("");
  const [hookTacticFilter, setHookTacticFilter] = useState("");

  // Preview dialog state: which creative (if any) is being previewed.
  const [previewTarget, setPreviewTarget] = useState<{
    id: number;
    name: string;
    thumbnailUrl: string | null;
  } | null>(null);

  // "Generate from Winner" dialog state
  const [generateTarget, setGenerateTarget] = useState<{
    id: number;
    name: string;
    creativeType: string;
  } | null>(null);

  // Fetch filter options (campaigns + accounts) for the dropdowns.
  const filterOptions = trpc.analytics.getFilterOptions.useQuery();
  // Wave 1e — AI tag filter options
  const tagFilterOptions = trpc.analytics.getTagFilterOptions.useQuery();

  // Sync filter state to URL via replaceState so back button doesn't pile up.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const qs = serializeFilters({
      days: lookbackDays, type: creativeType, sort: sortBy, dir: sortDir,
      campaign: campaignFilter, account: accountFilter, minSpend,
    });
    const next = `${window.location.pathname}?${qs}`;
    if (window.location.pathname + window.location.search !== next) {
      window.history.replaceState(null, "", next);
    }
  }, [lookbackDays, creativeType, sortBy, sortDir, campaignFilter, accountFilter, minSpend]);

  const { dateFrom, dateTo } = useMemo(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - lookbackDays);
    return { dateFrom: from, dateTo: to };
  }, [lookbackDays]);

  const queryInput = {
    dateFrom,
    dateTo,
    creativeType: creativeType === "all" ? undefined : creativeType,
    campaignId: campaignFilter || undefined,
    adAccountId: accountFilter || undefined,
    minSpendCents: minSpend > 0 ? minSpend * 100 : undefined,
    messagingAngle: messagingAngleFilter || undefined,
    hookTactic: hookTacticFilter || undefined,
    sortBy,
    sortDirection: sortDir,
    limit: 100,
    offset: 0,
  };

  const summary = trpc.analytics.getCreativePerformanceSummary.useQuery({
    dateFrom,
    dateTo,
    creativeType: creativeType === "all" ? undefined : creativeType,
    campaignId: campaignFilter || undefined,
    adAccountId: accountFilter || undefined,
  });

  const perfQuery = trpc.analytics.getCreativePerformance.useQuery(queryInput);

  const handleSort = (field: SortBy) => {
    if (sortBy === field) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(field);
      setSortDir("desc");
    }
  };

  const SortHeader = ({ field, label, align = "right" }: { field: SortBy; label: string; align?: "left" | "right" }) => {
    const isActive = sortBy === field;
    return (
      <button
        onClick={() => handleSort(field)}
        className={`flex items-center gap-1 ${align === "right" ? "justify-end w-full" : ""} ${isActive ? "text-[#FF3838]" : "text-[#71717A]"} hover:text-white transition-colors`}
      >
        <span className="uppercase text-[11px] tracking-wider font-medium">{label}</span>
        {isActive && (sortDir === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />)}
      </button>
    );
  };

  const rows = perfQuery.data?.rows ?? [];
  const isLoading = perfQuery.isLoading || summary.isLoading;
  const isEmpty = !isLoading && rows.length === 0;

  // Wave 2 — Fatigue detection for visible rows
  const visibleIds = useMemo(() => rows.map((r: any) => r.creativeAssetId), [rows]);
  const fatigueQuery = trpc.analytics.getFatigueMap.useQuery(
    { creativeAssetIds: visibleIds },
    { enabled: visibleIds.length > 0, staleTime: 10 * 60 * 1000 }
  );
  const fatigueMap: Record<number, any> = fatigueQuery.data || {};

  return (
    <div className="min-h-screen bg-[#0A0B0D] text-white">
      {/* Header */}
      <div className="px-6 py-5 border-b border-[rgba(255,255,255,0.06)]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Creative Performance</h1>
            <p className="text-sm text-[#A1A1AA] mt-0.5">Hyros attribution + Meta delivery, {DATE_PRESETS.find((p) => p.days === lookbackDays)?.label.toLowerCase()}</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void perfQuery.refetch();
                void summary.refetch();
              }}
              disabled={perfQuery.isFetching || summary.isFetching}
              aria-busy={perfQuery.isFetching || summary.isFetching}
              className="text-[#A1A1AA] border-[rgba(255,255,255,0.10)] bg-[#15171B] hover:bg-[#1E2126] hover:text-white disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${perfQuery.isFetching || summary.isFetching ? "animate-spin" : ""}`} />
              {perfQuery.isFetching || summary.isFetching ? "Refreshing…" : "Refresh"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation("/analytics/admin")}
              className="text-[#A1A1AA] border-[rgba(255,255,255,0.10)] bg-[#15171B] hover:bg-[#1E2126] hover:text-white"
            >
              <Settings className="w-3.5 h-3.5 mr-1.5" />
              Sync Admin
            </Button>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="sticky top-0 z-10 px-6 py-3 border-b border-[rgba(255,255,255,0.06)] bg-[#0A0B0D] flex gap-3 items-center">
        <Select value={String(lookbackDays)} onValueChange={(v) => setLookbackDays(Number(v))}>
          <SelectTrigger className="w-[160px] h-8 text-sm bg-[#0A0B0D] border-[rgba(255,255,255,0.10)]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#15171B] border-[rgba(255,255,255,0.10)]">
            {DATE_PRESETS.map((p) => (
              <SelectItem key={p.days} value={String(p.days)}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={creativeType} onValueChange={(v) => setCreativeType(v as typeof creativeType)}>
          <SelectTrigger className="w-[140px] h-8 text-sm bg-[#0A0B0D] border-[rgba(255,255,255,0.10)]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#15171B] border-[rgba(255,255,255,0.10)]">
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="video">Video</SelectItem>
            <SelectItem value="image">Image</SelectItem>
          </SelectContent>
        </Select>

        {/* Campaign filter */}
        {filterOptions.data && filterOptions.data.campaigns.length > 0 && (
          <Select value={campaignFilter || "_all"} onValueChange={(v) => setCampaignFilter(v === "_all" ? "" : v)}>
            <SelectTrigger className="w-[200px] h-8 text-sm bg-[#0A0B0D] border-[rgba(255,255,255,0.10)] truncate">
              <SelectValue placeholder="All campaigns" />
            </SelectTrigger>
            <SelectContent className="bg-[#15171B] border-[rgba(255,255,255,0.10)] max-h-[300px]">
              <SelectItem value="_all">All campaigns</SelectItem>
              {filterOptions.data.campaigns.map((c: { id: string; name: string }) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="truncate max-w-[220px] inline-block">{c.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Ad account filter */}
        {filterOptions.data && filterOptions.data.adAccounts.length > 1 && (
          <Select value={accountFilter || "_all"} onValueChange={(v) => setAccountFilter(v === "_all" ? "" : v)}>
            <SelectTrigger className="w-[160px] h-8 text-sm bg-[#0A0B0D] border-[rgba(255,255,255,0.10)]">
              <SelectValue placeholder="All accounts" />
            </SelectTrigger>
            <SelectContent className="bg-[#15171B] border-[rgba(255,255,255,0.10)]">
              <SelectItem value="_all">All accounts</SelectItem>
              {filterOptions.data.adAccounts.map((acc: string) => (
                <SelectItem key={acc} value={acc}>
                  {acc.replace("act_", "")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Min spend filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] uppercase tracking-wider text-[#71717A] font-medium whitespace-nowrap">Min spend</span>
          <input
            type="number"
            min={0}
            step={50}
            value={minSpend || ""}
            onChange={(e) => setMinSpend(Number(e.target.value) || 0)}
            placeholder="$0"
            className="w-[80px] h-8 text-sm bg-[#0A0B0D] border border-[rgba(255,255,255,0.10)] rounded-md px-2 text-white font-mono tabular-nums placeholder:text-[#71717A] focus:outline-none focus:ring-1 focus:ring-[#FF3838]"
          />
        </div>

        {/* Wave 1e — Messaging angle filter */}
        {tagFilterOptions.data && tagFilterOptions.data.messagingAngles.length > 0 && (
          <Select value={messagingAngleFilter || "_all"} onValueChange={(v) => setMessagingAngleFilter(v === "_all" ? "" : v)}>
            <SelectTrigger className="w-[170px] h-8 text-sm bg-[#0A0B0D] border-[rgba(255,255,255,0.10)] truncate">
              <SelectValue placeholder="All angles" />
            </SelectTrigger>
            <SelectContent className="bg-[#15171B] border-[rgba(255,255,255,0.10)] max-h-[300px]">
              <SelectItem value="_all">All angles</SelectItem>
              {tagFilterOptions.data.messagingAngles.map((a: { value: string; count: number }) => (
                <SelectItem key={a.value} value={a.value}>
                  <span className="capitalize">{a.value.replace(/_/g, " ")}</span>
                  <span className="text-[#71717A] ml-1">({a.count})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Wave 1e — Hook tactic filter */}
        {tagFilterOptions.data && tagFilterOptions.data.hookTactics.length > 0 && (
          <Select value={hookTacticFilter || "_all"} onValueChange={(v) => setHookTacticFilter(v === "_all" ? "" : v)}>
            <SelectTrigger className="w-[170px] h-8 text-sm bg-[#0A0B0D] border-[rgba(255,255,255,0.10)] truncate">
              <SelectValue placeholder="All tactics" />
            </SelectTrigger>
            <SelectContent className="bg-[#15171B] border-[rgba(255,255,255,0.10)] max-h-[300px]">
              <SelectItem value="_all">All tactics</SelectItem>
              {tagFilterOptions.data.hookTactics.map((t: { value: string; count: number }) => (
                <SelectItem key={t.value} value={t.value}>
                  <span className="capitalize">{t.value.replace(/_/g, " ")}</span>
                  <span className="text-[#71717A] ml-1">({t.count})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-4 border-b border-[rgba(255,255,255,0.06)] bg-[#15171B]">
        {isLoading ? (
          <>
            <div className="p-6"><Skeleton className="h-[32px] w-[120px] bg-[rgba(255,255,255,0.06)]" /></div>
            <div className="p-6"><Skeleton className="h-[32px] w-[120px] bg-[rgba(255,255,255,0.06)]" /></div>
            <div className="p-6"><Skeleton className="h-[32px] w-[120px] bg-[rgba(255,255,255,0.06)]" /></div>
            <div className="p-6"><Skeleton className="h-[32px] w-[120px] bg-[rgba(255,255,255,0.06)]" /></div>
          </>
        ) : summary.data ? (
          <>
            <KpiCard label="Total Spend" value={formatCents(summary.data.totalSpendCents)} subLabel="Meta" />
            <KpiCard label="Total Revenue" value={formatCents(summary.data.totalRevenueCents)} subLabel="Hyros" />
            <KpiCard label="Blended ROAS" value={formatBpAsRoas(summary.data.blendedRoasBp)} />
            <KpiCard label="Active Creatives" value={formatInt(summary.data.activeCreativesCount)} subLabel={`${formatInt(summary.data.totalConversions)} conversions`} />
          </>
        ) : null}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-[rgba(255,255,255,0.06)]">
              <TableHead className="w-[84px] bg-[#1E2126] sticky left-0 z-10">
                <span className="uppercase text-[11px] tracking-wider font-medium text-[#71717A]">Creative</span>
              </TableHead>
              <TableHead className="min-w-[280px] bg-[#1E2126] sticky left-[84px] z-10">
                <span className="uppercase text-[11px] tracking-wider font-medium text-[#71717A]">Name</span>
              </TableHead>
              <TableHead className="text-right">
                <span className="uppercase text-[11px] tracking-wider font-medium text-[#71717A]">Ads</span>
              </TableHead>
              <TableHead className="text-right"><SortHeader field="spendCents" label="Spend" /></TableHead>
              <TableHead className="text-right"><SortHeader field="revenueCents" label="Revenue" /></TableHead>
              <TableHead className="text-right"><SortHeader field="roasBp" label="ROAS" /></TableHead>
              <TableHead className="text-right">
                <span className="uppercase text-[11px] tracking-wider font-medium text-[#71717A]">AOV</span>
              </TableHead>
              <TableHead className="text-right">
                <span className="uppercase text-[11px] tracking-wider font-medium text-[#71717A]">CPA</span>
              </TableHead>
              <TableHead className="text-right">
                <span className="uppercase text-[11px] tracking-wider font-medium text-[#71717A]">Thumbstop</span>
              </TableHead>
              <TableHead className="text-right">
                <span className="uppercase text-[11px] tracking-wider font-medium text-[#71717A]">Hold</span>
              </TableHead>
              <TableHead className="text-right">
                <span className="uppercase text-[11px] tracking-wider font-medium text-[#71717A]">CTR</span>
              </TableHead>
              <TableHead className="text-right"><SortHeader field="hookScore" label="Hook" /></TableHead>
              <TableHead className="text-right"><SortHeader field="watchScore" label="Watch" /></TableHead>
              <TableHead className="text-right"><SortHeader field="clickScore" label="Click" /></TableHead>
              <TableHead className="text-right"><SortHeader field="convertScore" label="Convert" /></TableHead>
              <TableHead className="text-right w-[100px]">Generate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <>
                {Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i} className="border-b border-[rgba(255,255,255,0.06)]">
                    <TableCell colSpan={15}>
                      <Skeleton className="h-16 w-full bg-[rgba(255,255,255,0.04)]" />
                    </TableCell>
                  </TableRow>
                ))}
              </>
            )}
            {isEmpty && (
              <TableRow>
                <TableCell colSpan={15} className="py-16">
                  <div className="flex flex-col items-start gap-3 max-w-md">
                    <BarChart3 className="w-12 h-12 text-[#71717A]" />
                    <div>
                      <h3 className="text-xl font-medium text-white">No synced ads yet</h3>
                      <p className="text-sm text-[#A1A1AA] mt-1">Run your first sync from Sync Admin to see your creative performance here.</p>
                    </div>
                    <Button
                      onClick={() => setLocation("/analytics/admin")}
                      className="bg-[#FF3838] hover:bg-[#FF5555] text-white rounded-sm mt-2"
                    >
                      Go to Sync Admin
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {!isLoading && rows.map((row) => (
              <TableRow
                key={row.creativeAssetId}
                onClick={() =>
                  setLocation(
                    `/analytics/ads/${row.creativeAssetId}?days=${lookbackDays}`,
                  )
                }
                className="border-b border-[rgba(255,255,255,0.06)] hover:bg-[#1E2126] cursor-pointer"
              >
                <TableCell className="sticky left-0 bg-[#0A0B0D] hover:bg-[#1E2126] z-[1] py-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewTarget({
                        id: row.creativeAssetId,
                        name: row.creativeName,
                        thumbnailUrl: row.thumbnailUrl,
                      });
                    }}
                    aria-label={`Preview ${row.creativeName || "creative"}`}
                    className="relative w-16 h-16 rounded-md bg-[#15171B] overflow-hidden focus:outline-none focus:ring-2 focus:ring-[#FF3838] group"
                  >
                    {row.thumbnailUrl ? (
                      <img
                        src={row.thumbnailUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <BarChart3 className="w-5 h-5 text-[#71717A]" />
                      </div>
                    )}
                    {row.creativeType === "video" && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-80 group-hover:opacity-100 transition-opacity">
                        <PlayCircle className="w-6 h-6 text-white drop-shadow-md" />
                      </div>
                    )}
                  </button>
                </TableCell>
                <TableCell className="sticky left-[84px] bg-[#0A0B0D] hover:bg-[#1E2126] z-[1]">
                  <div className="flex flex-col max-w-[260px]">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-white truncate">{row.creativeName || "(unnamed)"}</span>
                      {fatigueMap[row.creativeAssetId]?.status === "fatigued" && (
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <TrendingDown className="w-3.5 h-3.5 text-red-400 shrink-0" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">Fatigued — hook score dropped {Math.abs(fatigueMap[row.creativeAssetId].hookScoreDeltaPct)}% this week</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {fatigueMap[row.creativeAssetId]?.status === "declining" && (
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <TrendingDown className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">Declining — hook score dropped {Math.abs(fatigueMap[row.creativeAssetId].hookScoreDeltaPct)}% this week</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                    <span className="text-[11px] text-[#71717A] uppercase tracking-wide">{row.creativeType}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums text-sm text-[#A1A1AA]">{row.adCount}</TableCell>
                <TableCell className="text-right font-mono tabular-nums text-sm text-white">{formatCents(row.spendCents)}</TableCell>
                <TableCell className="text-right font-mono tabular-nums text-sm text-white">{formatCents(row.revenueCents)}</TableCell>
                <TableCell className="text-right font-mono tabular-nums text-sm text-white">{formatBpAsRoas(row.roasBp)}</TableCell>
                <TableCell className="text-right font-mono tabular-nums text-sm text-[#A1A1AA]">{formatCents(row.aovCents)}</TableCell>
                <TableCell className="text-right font-mono tabular-nums text-sm text-[#A1A1AA]">{formatCents(row.cpaCents)}</TableCell>
                <TableCell className="text-right font-mono tabular-nums text-sm text-[#A1A1AA]">{formatBpAsPct(row.thumbstopBp)}</TableCell>
                <TableCell className="text-right font-mono tabular-nums text-sm text-[#A1A1AA]">{formatBpAsPct(row.holdRateBp)}</TableCell>
                <TableCell className="text-right font-mono tabular-nums text-sm text-[#A1A1AA]">{formatBpAsPct(row.ctrBp)}</TableCell>
                <TableCell className="text-right"><ScoreCell score={row.hookScore} label="Hook" metricBp={row.thumbstopBp} /></TableCell>
                <TableCell className="text-right"><ScoreCell score={row.watchScore} label="Watch" metricBp={row.holdRateBp} /></TableCell>
                <TableCell className="text-right"><ScoreCell score={row.clickScore} label="Click" metricBp={row.ctrBp} /></TableCell>
                <TableCell className="text-right"><ScoreCell score={row.convertScore} label="Convert" metricBp={row.roasBp} /></TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setGenerateTarget({
                        id: row.creativeAssetId,
                        name: row.creativeName || "(unnamed)",
                        creativeType: row.creativeType,
                      });
                    }}
                    className="h-8 px-2 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                    aria-label="Generate from this winner"
                  >
                    <Sparkles className="w-3.5 h-3.5 mr-1" />
                    <span className="text-xs">Generate</span>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <CreativePreviewDialog
        open={previewTarget != null}
        onOpenChange={(open) => {
          if (!open) setPreviewTarget(null);
        }}
        creativeAssetId={previewTarget?.id ?? null}
        creativeName={previewTarget?.name ?? ""}
        thumbnailUrl={previewTarget?.thumbnailUrl ?? null}
      />

      <GenerateFromWinnerDialog
        target={generateTarget}
        onClose={() => setGenerateTarget(null)}
      />
    </div>
  );
}

/**
 * Dialog that shows a winning creative's metadata + tags and provides
 * a CTA to navigate to /scripts pre-filled with the winner's context.
 */
function GenerateFromWinnerDialog({
  target,
  onClose,
}: {
  target: { id: number; name: string; creativeType: string } | null;
  onClose: () => void;
}) {
  const [, setLocation] = useLocation();
  const detailQuery = trpc.analytics.getCreativeDetail.useQuery(
    { creativeAssetId: target?.id ?? 0 },
    { enabled: !!target?.id }
  );

  if (!target) return null;

  const detail = detailQuery.data;
  const asset = detail?.asset;
  const score = detail?.latestScore;
  const aiTag = detail?.aiTag;

  // Best-effort product inference from creative name.
  // (Future: source from pipeline_runs.product if linked.)
  const PRODUCTS = ["Hyperburn", "Thermosleep", "Hyperload", "Thermoburn", "Carb Control", "Protein + Collagen", "Creatine", "HyperPump", "AminoLoad", "Marine Collagen", "SuperGreens", "Whey ISO Pro"];
  const inferredProduct = PRODUCTS.find(p => target.name.toLowerCase().includes(p.toLowerCase())) || "";

  const hookText = (aiTag?.hookText || asset?.adCopyTitle || "") as string;
  const messagingAngle = (aiTag?.messagingAngle || "") as string;
  const hookTactic = (aiTag?.hookTactic || "") as string;

  const handleGenerateScripts = () => {
    const params = new URLSearchParams();
    if (inferredProduct) params.set("product", inferredProduct);
    if (hookText) params.set("winnerHook", hookText);
    if (messagingAngle) params.set("winnerAngle", messagingAngle);
    if (hookTactic) params.set("winnerTactic", hookTactic);
    params.set("winnerName", target.name);
    params.set("sourceCreativeAssetId", String(target.id));
    setLocation(`/scripts?${params.toString()}`);
    onClose();
  };

  // Navigate to /iterate prefilled with this winner. Only the creative ID is
  // passed in the URL — IterateWinners fetches the current thumbnailUrl
  // server-side, so bookmarks/refreshes survive Meta CDN token expiry.
  const handleIterateImage = () => {
    const params = new URLSearchParams();
    if (inferredProduct) params.set("product", inferredProduct);
    params.set("winnerName", target.name);
    params.set("sourceCreativeAssetId", String(target.id));
    setLocation(`/iterate?${params.toString()}`);
    onClose();
  };

  return (
    <Dialog open={!!target} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="bg-[#0D0F12] border-white/10 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            Generate from Winner
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Generate new scripts inspired by this winning creative's angle and hook.
          </DialogDescription>
        </DialogHeader>

        {detailQuery.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Creative</p>
              <p className="text-sm text-white truncate">{target.name}</p>
            </div>

            {score && (
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { label: "Hook", value: score.hookScore },
                  { label: "Watch", value: score.watchScore },
                  { label: "Click", value: score.clickScore },
                  { label: "Convert", value: score.convertScore },
                ].map(s => (
                  <div key={s.label} className="rounded-lg bg-[#15171B] p-2">
                    <p className="text-[10px] text-gray-500 uppercase">{s.label}</p>
                    <p className={`text-lg font-bold ${s.value >= 70 ? "text-emerald-400" : s.value >= 40 ? "text-yellow-400" : "text-red-400"}`}>{s.value}</p>
                  </div>
                ))}
              </div>
            )}

            {hookText && (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Hook</p>
                <p className="text-sm text-gray-300 italic line-clamp-3">"{hookText}"</p>
              </div>
            )}

            <div className="flex gap-4 text-xs">
              {messagingAngle && (
                <div>
                  <span className="text-gray-500 uppercase tracking-wider">Angle: </span>
                  <span className="text-emerald-400">{messagingAngle.replace(/_/g, " ")}</span>
                </div>
              )}
              {hookTactic && (
                <div>
                  <span className="text-gray-500 uppercase tracking-wider">Tactic: </span>
                  <span className="text-emerald-400">{hookTactic.replace(/_/g, " ")}</span>
                </div>
              )}
            </div>

            {inferredProduct ? (
              <p className="text-xs text-gray-500">
                Product: <span className="text-white">{inferredProduct}</span> (inferred from creative name)
              </p>
            ) : (
              <p className="text-xs text-yellow-400">
                Could not infer product from creative name — you'll pick it in the next step.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleGenerateScripts}
            disabled={detailQuery.isLoading}
            className="bg-[#FF3838] hover:bg-[#FF5555] text-white"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            Generate Scripts
          </Button>
          {target.creativeType === "image" && (
            <Button
              onClick={handleIterateImage}
              disabled={detailQuery.isLoading}
              className="bg-[#FF3838] hover:bg-[#FF5555] text-white"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              Iterate image
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
