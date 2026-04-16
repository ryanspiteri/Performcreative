/**
 * Creative Strategy Dashboard (Wave 3)
 *
 * The intelligence layer surfaced as a dashboard. Shows:
 *   - Winning patterns (top hook tactic, messaging angle, top hooks)
 *   - Pattern breakers (creatives that outperformed their category)
 *   - Coverage gaps (products with no recent generation)
 *   - AI vs Human performance comparison
 *   - "Auto-generate from winning patterns" CTA
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown, Sparkles, Loader2, AlertCircle, Users, Bot, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

const PRODUCTS = [
  "Hyperburn", "Thermosleep", "Hyperload", "Thermoburn", "Carb Control",
  "Protein + Collagen", "Creatine", "HyperPump", "AminoLoad",
  "Marine Collagen", "SuperGreens", "Whey ISO Pro",
];

export default function CreativeStrategy() {
  const auth = useAuth();
  const isAdmin = auth.user?.role === "admin";

  const [product, setProduct] = useState("Hyperburn");
  const [funnelStage, setFunnelStage] = useState<"cold" | "warm" | "retargeting" | "retention">("cold");
  const [generating, setGenerating] = useState(false);

  const briefQuery = trpc.scriptGenerator.getIntelligenceBrief.useQuery({ product }, { enabled: !!product });
  const strategyQuery = trpc.analytics.getStrategyDashboard.useQuery({ product });

  const brief = briefQuery.data;
  const strategy = strategyQuery.data;

  const autoGenMutation = trpc.analytics.autoGenerateFromPatterns.useMutation({
    onSuccess: (data) => {
      toast.success(`Created ${data.runsCreated} runs for ${data.product}. Runs: ${data.runIds.join(", ")}`);
      setGenerating(false);
    },
    onError: (err: any) => {
      toast.error(`Auto-generate failed: ${err.message}`);
      setGenerating(false);
    },
  });

  const handleAutoGenerate = () => {
    if (!isAdmin) {
      toast.error("Admin access required");
      return;
    }
    setGenerating(true);
    autoGenMutation.mutate({
      product,
      funnelStage,
      scriptsPerPattern: 2,
      maxPatterns: 3,
    });
  };

  const missingProducts = PRODUCTS.filter(p =>
    !strategy?.productsByActivity?.some((a: any) => a.product === p)
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Creative Strategy</h1>
          <p className="text-sm text-gray-400 mt-1">Winning patterns, coverage gaps, and AI-driven generation</p>
        </div>

        <div className="flex items-center gap-2">
          <Select value={product} onValueChange={setProduct}>
            <SelectTrigger className="w-[200px] bg-[#0A0B0D] border-white/10 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#0D0F14] border-white/10">
              {PRODUCTS.map(p => (
                <SelectItem key={p} value={p} className="text-white hover:bg-white/5">{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={funnelStage} onValueChange={(v: any) => setFunnelStage(v)}>
            <SelectTrigger className="w-[140px] bg-[#0A0B0D] border-white/10 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#0D0F14] border-white/10">
              <SelectItem value="cold">Cold</SelectItem>
              <SelectItem value="warm">Warm</SelectItem>
              <SelectItem value="retargeting">Retargeting</SelectItem>
              <SelectItem value="retention">Retention</SelectItem>
            </SelectContent>
          </Select>

          {isAdmin && (
            <Button
              onClick={handleAutoGenerate}
              disabled={generating || !brief || brief.creativeCount < 3}
              className="bg-emerald-500 hover:bg-emerald-400 text-black"
            >
              {generating ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
              Auto-Generate
            </Button>
          )}
        </div>
      </div>

      {/* Winning Patterns */}
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider">Winning Patterns for {product}</h2>
        </div>

        {briefQuery.isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
        ) : !brief || brief.creativeCount < 3 ? (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <AlertCircle className="w-4 h-4" />
            Not enough data yet. Need at least 3 tagged creatives with performance.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Top Hook Tactic</p>
              {brief.topHookTactic ? (
                <>
                  <p className="text-lg font-semibold text-white">{brief.topHookTactic.tactic.replace(/_/g, " ")}</p>
                  <p className="text-xs text-emerald-400 mt-0.5">Avg hookScore: {brief.topHookTactic.avgScore}</p>
                </>
              ) : (
                <p className="text-sm text-gray-500">No data</p>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Top Messaging Angle</p>
              {brief.topMessagingAngle ? (
                <>
                  <p className="text-lg font-semibold text-white">{brief.topMessagingAngle.angle.replace(/_/g, " ")}</p>
                  <p className="text-xs text-emerald-400 mt-0.5">Avg hookScore: {brief.topMessagingAngle.avgScore}</p>
                </>
              ) : (
                <p className="text-sm text-gray-500">No data</p>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Data Window</p>
              <p className="text-lg font-semibold text-white">{brief.creativeCount} creatives</p>
              {brief.totalSpendCents > 0 && (
                <p className="text-xs text-gray-400 mt-0.5">${(brief.totalSpendCents / 100).toLocaleString()} spend / 90d</p>
              )}
            </div>
          </div>
        )}

        {brief && brief.topHooks.length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/5">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Top Performing Hooks</p>
            <div className="space-y-1.5">
              {brief.topHooks.slice(0, 5).map((h, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className={`inline-block min-w-[2.5rem] text-xs font-mono tabular-nums font-semibold ${h.hookScore >= 70 ? "text-emerald-400" : h.hookScore >= 40 ? "text-yellow-400" : "text-gray-500"}`}>{h.hookScore}</span>
                  <p className="text-sm text-gray-300 italic">"{h.hookText}"</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* AI vs Human Performance */}
      <div className="rounded-xl border border-white/5 bg-[#0D0F12] p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Performance by Source</h2>
        </div>

        {strategyQuery.isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
        ) : !strategy?.aiVsHumanPerformance || strategy.aiVsHumanPerformance.length === 0 ? (
          <p className="text-sm text-gray-500">No attributed creative runs yet for {product}.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {strategy.aiVsHumanPerformance.map((row: any) => {
              const Icon = row.source === "human" ? Users : Bot;
              const label = row.source === "ai-winner" ? "Generate from Winner" : row.source === "ai-playbook" ? "Auto-playbook" : "Human";
              return (
                <div key={row.source} className="rounded-lg bg-[#15171B] p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-xs text-gray-400 uppercase tracking-wider">{label}</span>
                  </div>
                  <p className="text-xl font-semibold text-white">{row.creativeCount} <span className="text-xs text-gray-500 font-normal">creatives</span></p>
                  <div className="mt-2 flex gap-4 text-xs">
                    <div>
                      <span className="text-gray-500">Hook: </span>
                      <span className={`font-mono tabular-nums ${row.avgHookScore >= 70 ? "text-emerald-400" : row.avgHookScore >= 40 ? "text-yellow-400" : "text-red-400"}`}>{row.avgHookScore}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Convert: </span>
                      <span className={`font-mono tabular-nums ${row.avgConvertScore >= 70 ? "text-emerald-400" : row.avgConvertScore >= 40 ? "text-yellow-400" : "text-red-400"}`}>{row.avgConvertScore}</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-2">${(row.totalSpendCents / 100).toLocaleString()} spend</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pattern Breakers */}
      {strategy && strategy.patternBreakers.length > 0 && (
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-yellow-400" />
            <h2 className="text-sm font-semibold text-yellow-400 uppercase tracking-wider">Pattern Breakers</h2>
            <span className="text-xs text-gray-500">(creatives that outperformed their expected category)</span>
          </div>

          <div className="space-y-3">
            {strategy.patternBreakers.slice(0, 5).map((pb: any, i: number) => (
              <div key={i} className="flex items-start gap-3 pb-3 border-b border-white/5 last:border-0">
                {pb.thumbnailUrl ? (
                  <img src={pb.thumbnailUrl} alt="" className="w-12 h-12 rounded-md object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-md bg-[#15171B] flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-gray-600" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{pb.creativeName || "(unnamed)"}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{pb.combination.replace(/\+/g, " + ").replace(/_/g, " ")}</p>
                  <p className="text-xs text-gray-500 mt-1 italic">{pb.insight}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-gray-500">Expected {pb.expectedScore}</p>
                  <p className="text-lg font-bold text-emerald-400">{pb.actualScore}</p>
                  <p className="text-[10px] text-yellow-400">+{pb.deviation}σ</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Coverage Gaps */}
      {missingProducts.length > 0 && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown className="w-4 h-4 text-red-400" />
            <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wider">Coverage Gaps</h2>
            <span className="text-xs text-gray-500">(no creative runs in 30 days)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {missingProducts.map(p => (
              <span key={p} className="px-2 py-1 text-xs text-red-300 bg-red-500/10 rounded-md">{p}</span>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {strategy && strategy.productsByActivity.length > 0 && (
        <div className="rounded-xl border border-white/5 bg-[#0D0F12] p-5">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">Recent Activity (30d)</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {strategy.productsByActivity.map((p: any) => (
              <div key={p.product} className="flex items-center justify-between px-3 py-2 rounded-md bg-[#15171B]">
                <span className="text-sm text-white truncate">{p.product}</span>
                <span className="text-xs text-gray-500 font-mono tabular-nums">{p.runCount}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
