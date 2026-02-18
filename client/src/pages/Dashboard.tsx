import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Play, Image, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data: runs, isLoading } = trpc.pipeline.list.useQuery();

  const videoRuns = runs?.filter(r => r.pipelineType === "video") || [];
  const staticRuns = runs?.filter(r => r.pipelineType === "static") || [];
  const completedRuns = runs?.filter(r => r.status === "completed") || [];
  const runningRuns = runs?.filter(r => r.status === "running") || [];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Runs" value={runs?.length || 0} icon={<Play className="w-5 h-5" />} color="text-emerald-400" />
        <StatCard label="Video Pipelines" value={videoRuns.length} icon={<Play className="w-5 h-5" />} color="text-blue-400" />
        <StatCard label="Static Pipelines" value={staticRuns.length} icon={<Image className="w-5 h-5" />} color="text-purple-400" />
        <StatCard label="Running" value={runningRuns.length} icon={<Loader2 className="w-5 h-5 animate-spin" />} color="text-orange-400" />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <button
          onClick={() => setLocation("/trigger")}
          className="bg-[#191B1F] border border-white/5 rounded-xl p-6 text-left hover:border-emerald-500/30 transition-colors group"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-emerald-600/20 flex items-center justify-center">
              <Play className="w-5 h-5 text-emerald-400" />
            </div>
            <h3 className="text-white font-semibold">Video Pipeline</h3>
          </div>
          <p className="text-sm text-gray-400">Pull from Foreplay #inspo board, analyze, generate scripts</p>
        </button>
        <button
          onClick={() => setLocation("/static")}
          className="bg-[#191B1F] border border-white/5 rounded-xl p-6 text-left hover:border-blue-500/30 transition-colors group"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center">
              <Image className="w-5 h-5 text-blue-400" />
            </div>
            <h3 className="text-white font-semibold">Static Ads Pipeline</h3>
          </div>
          <p className="text-sm text-gray-400">Browse Foreplay static_inspo board, select and analyze ads</p>
        </button>
      </div>

      {/* Recent Runs */}
      <h2 className="text-lg font-semibold text-white mb-4">Recent Pipeline Runs</h2>
      {isLoading ? (
        <div className="text-gray-400 text-center py-8">Loading...</div>
      ) : !runs || runs.length === 0 ? (
        <div className="bg-[#191B1F] border border-white/5 rounded-xl p-8 text-center">
          <p className="text-gray-400">No pipeline runs yet. Trigger your first pipeline above.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {runs.slice(0, 20).map((run) => (
            <button
              key={run.id}
              onClick={() => setLocation(`/results/${run.id}`)}
              className="w-full bg-[#191B1F] border border-white/5 rounded-lg p-4 flex items-center justify-between hover:border-white/10 transition-colors text-left"
            >
              <div className="flex items-center gap-4">
                <StatusIcon status={run.status} />
                <div>
                  <div className="text-white text-sm font-medium">
                    {run.foreplayAdTitle || `${run.pipelineType} Pipeline`}
                  </div>
                  <div className="text-gray-500 text-xs mt-0.5">
                    {run.pipelineType.toUpperCase()} · {run.product} · {run.priority} · {new Date(run.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${
                run.status === "completed" ? "bg-emerald-500/20 text-emerald-400" :
                run.status === "running" ? "bg-orange-500/20 text-orange-400" :
                run.status === "failed" ? "bg-red-500/20 text-red-400" :
                "bg-gray-500/20 text-gray-400"
              }`}>
                {run.status}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-[#191B1F] border border-white/5 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-gray-400 text-sm">{label}</span>
        <span className={color}>{icon}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "completed") return <CheckCircle className="w-5 h-5 text-emerald-400" />;
  if (status === "running") return <Loader2 className="w-5 h-5 text-orange-400 animate-spin" />;
  if (status === "failed") return <XCircle className="w-5 h-5 text-red-400" />;
  return <Clock className="w-5 h-5 text-gray-400" />;
}
