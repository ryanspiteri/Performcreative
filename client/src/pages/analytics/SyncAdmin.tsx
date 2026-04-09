/**
 * Sync Admin page (admin only).
 *
 * Sections:
 *   1. Error alert banner (if any sync has lastSyncError)
 *   2. Meta sync status card + trigger
 *   3. Hyros sync status card + trigger
 *   4. Benchmarks refresh + recompute scores
 *   5. Backfill controls (with confirmation)
 *   6. Unlinked ads list
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Clock, RefreshCw, AlertTriangle, ArrowLeft, Database } from "lucide-react";

function formatRelative(date: Date | null | undefined): string {
  if (!date) return "never";
  const d = typeof date === "string" ? new Date(date) : date;
  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d ago`;
}

function statusColor(status: string | null | undefined): string {
  switch (status) {
    case "success": return "#10B981";
    case "running": return "#F59E0B";
    case "failed": return "#EF4444";
    case "partial": return "#F59E0B";
    default: return "#71717A";
  }
}

function StatusDot({ status, pulse }: { status: string | null | undefined; pulse?: boolean }) {
  return (
    <div
      className={`w-2 h-2 rounded-full ${pulse && status === "running" ? "animate-pulse" : ""}`}
      style={{ backgroundColor: statusColor(status) }}
    />
  );
}

export default function SyncAdmin() {
  const [, setLocation] = useLocation();
  const [backfillOpen, setBackfillOpen] = useState<null | "meta" | "hyros">(null);

  const syncStatus = trpc.adminSync.getSyncStatus.useQuery(undefined, { refetchInterval: 10000 });
  const metaToken = trpc.adminSync.validateMetaToken.useQuery();
  const hyrosKey = trpc.adminSync.validateHyrosKey.useQuery();

  const triggerMetaSync = trpc.adminSync.triggerMetaSync.useMutation({
    onSuccess: () => {
      toast.success("Meta sync triggered");
      syncStatus.refetch();
    },
    onError: (err) => toast.error(`Meta sync failed: ${err.message}`),
  });
  const triggerHyrosSync = trpc.adminSync.triggerHyrosSync.useMutation({
    onSuccess: () => {
      toast.success("Hyros sync triggered");
      syncStatus.refetch();
    },
    onError: (err) => toast.error(`Hyros sync failed: ${err.message}`),
  });
  const triggerMetaBackfill = trpc.adminSync.triggerMetaBackfill.useMutation({
    onSuccess: () => {
      toast.success("Meta backfill started (this will take a while)");
      syncStatus.refetch();
    },
    onError: (err) => toast.error(`Backfill failed: ${err.message}`),
  });
  const triggerHyrosBackfill = trpc.adminSync.triggerHyrosBackfill.useMutation({
    onSuccess: () => {
      toast.success("Hyros backfill started");
      syncStatus.refetch();
    },
    onError: (err) => toast.error(`Backfill failed: ${err.message}`),
  });
  const triggerRecompute = trpc.adminSync.triggerScoreRecompute.useMutation({
    onSuccess: (data) => toast.success(`Recomputed ${data.rowsUpserted} creative scores`),
    onError: (err) => toast.error(`Recompute failed: ${err.message}`),
  });

  const states = syncStatus.data?.states ?? [];
  const metaStates = states.filter((s) => s.sourceName === "meta");
  const hyrosStates = states.filter((s) => s.sourceName === "hyros");
  const errorsFromSyncs = states.filter((s) => s.lastSyncError).map((s) => ({
    source: s.sourceName,
    account: s.adAccountId,
    error: s.lastSyncError,
  }));

  return (
    <div className="min-h-screen bg-[#0A0B0D] text-white">
      <div className="px-6 py-5">
        <Button
          variant="ghost"
          onClick={() => setLocation("/analytics")}
          className="text-[#A1A1AA] hover:text-white hover:bg-[#15171B] mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Creative Performance
        </Button>
        <h1 className="text-2xl font-semibold text-white">Sync Admin</h1>
        <p className="text-sm text-[#A1A1AA] mt-0.5">Meta Ads + Hyros sync controls and diagnostics</p>
      </div>

      {/* Error alerts */}
      {errorsFromSyncs.length > 0 && (
        <div className="px-6 mb-6">
          {errorsFromSyncs.map((e, i) => (
            <div
              key={i}
              className="p-4 rounded-md border-l-4 border-[#EF4444] bg-[rgba(239,68,68,0.08)] flex gap-3 mb-3"
              role="alert"
            >
              <AlertCircle className="w-5 h-5 text-[#EF4444] flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[#EF4444]">
                  {e.source} sync failed {e.account ? `(${e.account})` : ""}
                </div>
                <div className="text-sm text-[#A1A1AA] mt-1 whitespace-pre-wrap break-words">{e.error}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Two status columns */}
      <div className="px-6 grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Meta sync card */}
        <div className="p-6 rounded-lg bg-[#15171B] border border-[rgba(255,255,255,0.06)]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-[#A1A1AA]" />
              <h2 className="text-base font-medium text-white">Meta Ads Sync</h2>
            </div>
            <div className="flex items-center gap-2">
              {metaToken.data?.valid ? (
                <span className="text-xs text-[#10B981] flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Token valid
                </span>
              ) : (
                <span className="text-xs text-[#EF4444] flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Token invalid
                </span>
              )}
            </div>
          </div>

          {metaStates.length === 0 ? (
            <p className="text-sm text-[#A1A1AA] mb-4">No sync runs yet.</p>
          ) : (
            <div className="space-y-3 mb-4">
              {metaStates.map((s) => (
                <div key={s.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <StatusDot status={s.lastSyncStatus} pulse />
                    <span className="text-[#A1A1AA] font-mono text-xs">{s.adAccountId}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-[#A1A1AA]">
                      {s.lastSyncStatus} · {formatRelative(s.lastSyncCompletedAt)}
                    </div>
                    <div className="text-[11px] text-[#71717A] font-mono tabular-nums">
                      {s.rowsUpserted ?? 0} rows
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              onClick={() => triggerMetaSync.mutate({})}
              disabled={triggerMetaSync.isPending}
              className="bg-[#FF3838] hover:bg-[#FF5555] text-white rounded-sm"
            >
              {triggerMetaSync.isPending ? <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
              Trigger sync
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setBackfillOpen("meta")}
              className="border-[rgba(255,255,255,0.10)] bg-[#1E2126] text-white hover:bg-[rgba(255,255,255,0.10)]"
            >
              90-day backfill
            </Button>
          </div>

          {backfillOpen === "meta" && (
            <div className="mt-4 p-3 rounded-md border border-[#F59E0B] bg-[rgba(245,158,11,0.08)]">
              <div className="flex gap-2 items-start">
                <AlertTriangle className="w-4 h-4 text-[#F59E0B] flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-white font-medium">Confirm 90-day Meta backfill</p>
                  <p className="text-xs text-[#A1A1AA] mt-1">This will take 15-45 minutes and hit the Meta API heavily. You can navigate away.</p>
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      onClick={() => {
                        triggerMetaBackfill.mutate({ days: 90 });
                        setBackfillOpen(null);
                      }}
                      disabled={triggerMetaBackfill.isPending}
                      className="bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-black rounded-sm"
                    >
                      Start backfill
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setBackfillOpen(null)}>Cancel</Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Hyros sync card */}
        <div className="p-6 rounded-lg bg-[#15171B] border border-[rgba(255,255,255,0.06)]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-[#A1A1AA]" />
              <h2 className="text-base font-medium text-white">Hyros Attribution Sync</h2>
            </div>
            <div className="flex items-center gap-2">
              {hyrosKey.data?.valid ? (
                <span className="text-xs text-[#10B981] flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Key valid
                </span>
              ) : (
                <span className="text-xs text-[#EF4444] flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Key invalid
                </span>
              )}
            </div>
          </div>

          {hyrosStates.length === 0 ? (
            <p className="text-sm text-[#A1A1AA] mb-4">No sync runs yet.</p>
          ) : (
            <div className="space-y-3 mb-4">
              {hyrosStates.map((s) => (
                <div key={s.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <StatusDot status={s.lastSyncStatus} pulse />
                    <span className="text-[#A1A1AA]">Last run</span>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-[#A1A1AA]">
                      {s.lastSyncStatus} · {formatRelative(s.lastSyncCompletedAt)}
                    </div>
                    <div className="text-[11px] text-[#71717A] font-mono tabular-nums">
                      {s.rowsUpserted ?? 0} rows
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              onClick={() => triggerHyrosSync.mutate({})}
              disabled={triggerHyrosSync.isPending}
              className="bg-[#FF3838] hover:bg-[#FF5555] text-white rounded-sm"
            >
              {triggerHyrosSync.isPending ? <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
              Trigger sync
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setBackfillOpen("hyros")}
              className="border-[rgba(255,255,255,0.10)] bg-[#1E2126] text-white hover:bg-[rgba(255,255,255,0.10)]"
            >
              90-day backfill
            </Button>
          </div>

          {backfillOpen === "hyros" && (
            <div className="mt-4 p-3 rounded-md border border-[#F59E0B] bg-[rgba(245,158,11,0.08)]">
              <div className="flex gap-2 items-start">
                <AlertTriangle className="w-4 h-4 text-[#F59E0B] flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-white font-medium">Confirm 90-day Hyros backfill</p>
                  <p className="text-xs text-[#A1A1AA] mt-1">Fetches 90 days of sales and aggregates into attribution stats.</p>
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      onClick={() => {
                        triggerHyrosBackfill.mutate({ days: 90 });
                        setBackfillOpen(null);
                      }}
                      disabled={triggerHyrosBackfill.isPending}
                      className="bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-black rounded-sm"
                    >
                      Start backfill
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setBackfillOpen(null)}>Cancel</Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Score recompute */}
      <div className="px-6 mb-6">
        <div className="p-6 rounded-lg bg-[#15171B] border border-[rgba(255,255,255,0.06)]">
          <h2 className="text-base font-medium text-white mb-2">Score Recompute</h2>
          <p className="text-sm text-[#A1A1AA] mb-4">Recompute Hook/Watch/Click/Convert scores from the last 14 days of synced data. Runs automatically after each sync — this button is for manual reruns.</p>
          <Button
            size="sm"
            onClick={() => triggerRecompute.mutate({ days: 14 })}
            disabled={triggerRecompute.isPending}
            className="bg-[#FF3838] hover:bg-[#FF5555] text-white rounded-sm"
          >
            {triggerRecompute.isPending ? <Clock className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
            Recompute scores (last 14 days)
          </Button>
        </div>
      </div>

      {/* Token configuration info */}
      <div className="px-6 pb-12">
        <div className="p-6 rounded-lg bg-[#15171B] border border-[rgba(255,255,255,0.06)]">
          <h2 className="text-base font-medium text-white mb-4">Configuration</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[#A1A1AA]">Meta ad accounts configured:</span>
              <span className="font-mono tabular-nums text-white">{metaToken.data?.configuredAccountIds?.length ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#A1A1AA]">Meta token valid:</span>
              <span className="font-mono text-white">{metaToken.data?.valid ? "yes" : "no"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#A1A1AA]">Hyros key valid:</span>
              <span className="font-mono text-white">{hyrosKey.data?.valid ? "yes" : "no"}</span>
            </div>
          </div>
          <p className="text-xs text-[#71717A] mt-4">
            Env vars: META_ACCESS_TOKEN, META_AD_ACCOUNT_IDS, HYROS_API_KEY — edit on DigitalOcean App Platform.
          </p>
        </div>
      </div>
    </div>
  );
}
