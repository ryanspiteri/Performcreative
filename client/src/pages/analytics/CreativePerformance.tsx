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
import { useMemo, useState } from "react";
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
import { BarChart3, ArrowDown, ArrowUp, RefreshCw, Settings } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type SortBy = "spendCents" | "roasBp" | "hookScore" | "watchScore" | "clickScore" | "convertScore" | "launchDate";

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

function ScoreCell({ score, label }: { score: number; label: string }) {
  return (
    <TooltipProvider delayDuration={400}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex flex-col gap-1 items-end min-w-[48px]">
            <span className={`font-mono tabular-nums text-sm font-medium ${scoreColorClass(score)}`}>{score}</span>
            <div className="w-12 h-[2px] bg-[rgba(255,255,255,0.06)] rounded-none">
              <div className={`h-full ${scoreFillClass(score)}`} style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[280px]">
          <div className="text-sm">
            <div className="font-medium">{label} score: {score}/100</div>
            <div className="text-xs text-[#A1A1AA] mt-1">
              Percentile of this creative vs your account's 90-day distribution.
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
  const [lookbackDays, setLookbackDays] = useState(30);
  const [creativeType, setCreativeType] = useState<"all" | "video" | "image">("all");
  const [sortBy, setSortBy] = useState<SortBy>("spendCents");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

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
    sortBy,
    sortDirection: sortDir,
    limit: 100,
    offset: 0,
  };

  const summary = trpc.analytics.getCreativePerformanceSummary.useQuery({
    dateFrom,
    dateTo,
    creativeType: creativeType === "all" ? undefined : creativeType,
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
              onClick={() => perfQuery.refetch()}
              className="text-[#A1A1AA] border-[rgba(255,255,255,0.10)] bg-[#15171B] hover:bg-[#1E2126] hover:text-white"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Refresh
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <>
                {Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i} className="border-b border-[rgba(255,255,255,0.06)]">
                    <TableCell colSpan={14}>
                      <Skeleton className="h-16 w-full bg-[rgba(255,255,255,0.04)]" />
                    </TableCell>
                  </TableRow>
                ))}
              </>
            )}
            {isEmpty && (
              <TableRow>
                <TableCell colSpan={14} className="py-16">
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
                onClick={() => setLocation(`/analytics/ads/${row.creativeAssetId}`)}
                className="border-b border-[rgba(255,255,255,0.06)] hover:bg-[#1E2126] cursor-pointer"
              >
                <TableCell className="sticky left-0 bg-[#0A0B0D] hover:bg-[#1E2126] z-[1] py-2">
                  {row.thumbnailUrl ? (
                    <img
                      src={row.thumbnailUrl}
                      alt=""
                      className="w-16 h-16 rounded-md object-cover bg-[#15171B]"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-md bg-[#15171B] flex items-center justify-center">
                      <BarChart3 className="w-5 h-5 text-[#71717A]" />
                    </div>
                  )}
                </TableCell>
                <TableCell className="sticky left-[84px] bg-[#0A0B0D] hover:bg-[#1E2126] z-[1]">
                  <div className="flex flex-col max-w-[260px]">
                    <span className="text-sm font-medium text-white truncate">{row.creativeName || "(unnamed)"}</span>
                    <span className="text-[11px] text-[#71717A] uppercase tracking-wide">{row.creativeType}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums text-sm text-[#A1A1AA]">{row.adCount}</TableCell>
                <TableCell className="text-right font-mono tabular-nums text-sm text-white">{formatCents(row.spendCents)}</TableCell>
                <TableCell className="text-right font-mono tabular-nums text-sm text-white">{formatBpAsRoas(row.roasBp)}</TableCell>
                <TableCell className="text-right font-mono tabular-nums text-sm text-[#A1A1AA]">{formatCents(row.aovCents)}</TableCell>
                <TableCell className="text-right font-mono tabular-nums text-sm text-[#A1A1AA]">{formatCents(row.cpaCents)}</TableCell>
                <TableCell className="text-right font-mono tabular-nums text-sm text-[#A1A1AA]">{formatBpAsPct(row.thumbstopBp)}</TableCell>
                <TableCell className="text-right font-mono tabular-nums text-sm text-[#A1A1AA]">{formatBpAsPct(row.holdRateBp)}</TableCell>
                <TableCell className="text-right font-mono tabular-nums text-sm text-[#A1A1AA]">{formatBpAsPct(row.ctrBp)}</TableCell>
                <TableCell className="text-right"><ScoreCell score={row.hookScore} label="Hook" /></TableCell>
                <TableCell className="text-right"><ScoreCell score={row.watchScore} label="Watch" /></TableCell>
                <TableCell className="text-right"><ScoreCell score={row.clickScore} label="Click" /></TableCell>
                <TableCell className="text-right"><ScoreCell score={row.convertScore} label="Convert" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
