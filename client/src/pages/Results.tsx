import { trpc } from "@/lib/trpc";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft, Copy, CheckCircle, ExternalLink, ChevronDown, ChevronRight, Loader2, Play, FileText, Eye, PenTool, ListChecks, Image as ImageIcon, Star, ThumbsUp, ThumbsDown, Send, Sparkles } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import SelectionGate from "@/components/SelectionGate";

// ============================================================
// STATIC PIPELINE STAGES
// ============================================================
const STATIC_STAGES = [
  { key: "stage_1_analysis", label: "Competitor Analysis", icon: Eye },
  { key: "stage_2_brief", label: "Creative Brief", icon: FileText },
  { key: "stage_3_brief_review", label: "Brief Expert Review", icon: Star },
  { key: "stage_3b_selection", label: "Select Creative Direction", icon: Sparkles },
  { key: "stage_4_generation", label: "Image Generation", icon: ImageIcon },
  { key: "stage_5_creative_review", label: "Creative Expert Review", icon: Star },
  { key: "stage_6_team_approval", label: "Team Approval", icon: ThumbsUp },
  { key: "stage_6_revising", label: "Revising Creatives", icon: Loader2 },
  { key: "stage_7_clickup", label: "ClickUp Task", icon: ListChecks },
  { key: "completed", label: "Completed", icon: CheckCircle },
];

function getStageIndex(stage: string | null): number {
  if (!stage) return -1;
  const idx = STATIC_STAGES.findIndex(s => s.key === stage);
  return idx >= 0 ? idx : -1;
}

export default function Results() {
  const [, params] = useRoute("/results/:id");
  const [, setLocation] = useLocation();
  const id = Number(params?.id);

  const { data: run, isLoading } = trpc.pipeline.get.useQuery(
    { id },
    { refetchInterval: (query) => {
      const d = query.state.data;
      if (!d) return false;
      if (d.status === "running" || d.status === "pending") return 3000;
      if (d.pipelineType === "static" && d.staticStage === "stage_3b_selection") return false;
      if (d.pipelineType === "static" && d.staticStage === "stage_6_team_approval") return false;
      if (d.pipelineType === "static" && d.staticStage === "stage_6_revising") return 3000;
      return false;
    }}
  );

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-[#FF3838] animate-spin" />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="p-6">
        <p className="text-gray-400">Pipeline run not found.</p>
      </div>
    );
  }

  const scripts = (run.scriptsJson as any[]) || [];
  const clickupTasks = (run.clickupTasksJson as any[]) || [];
  const isRunning = run.status === "running" || run.status === "pending";

  return (
    <div className="p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => setLocation("/")} className="text-gray-400 hover:text-white flex items-center gap-1 text-sm">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            {run.status === "completed" ? (
              <><CheckCircle className="w-5 h-5 text-emerald-400" /> {run.foreplayAdTitle || `Pipeline Run #${run.id}`}</>
            ) : (
              run.foreplayAdTitle || `Pipeline Run #${run.id}`
            )}
          </h1>
          <p className="text-gray-500 text-sm">
            {run.foreplayAdBrand || ""} · {run.product} · {run.pipelineType?.toUpperCase()} · {run.triggerSource === "manual" ? "Manual trigger" : run.triggerSource}
          </p>
        </div>
        {isRunning && (
          <div className="flex items-center gap-2 text-orange-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Pipeline running...
          </div>
        )}
      </div>

      {/* Error */}
      {run.status === "failed" && run.errorMessage && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6 text-red-400 text-sm">
          {run.errorMessage}
        </div>
      )}

      {/* Static pipeline results with 7-stage UI */}
      {run.pipelineType === "static" && <StaticResults run={run} />}

      {/* Video pipeline results */}
      {run.pipelineType === "video" && (
        <>
          {/* Running Status */}
          {isRunning && (
            <div className="bg-[#191B1F] border border-orange-500/20 rounded-xl p-6 mb-6">
              <div className="flex items-center gap-3 mb-3">
                <Loader2 className="w-5 h-5 text-orange-400 animate-spin" />
                <span className="text-white font-medium">Pipeline in progress...</span>
              </div>
              <div className="space-y-2 text-sm text-gray-400">
                <StepStatus label="Foreplay Pull" done={!!run.foreplayAdId} />
                <StepStatus label="Transcription" done={!!run.transcript} />
                <StepStatus label="Visual Analysis" done={!!run.visualAnalysis} />
                <StepStatus label="Script Generation & Expert Review" done={scripts.length > 0} />
                <StepStatus label="ClickUp Task Creation" done={clickupTasks.length > 0} />
              </div>
            </div>
          )}

          {/* Section 1 & 2: Original Creative + Transcript side by side */}
          {(run.videoUrl || run.transcript) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              {/* Original Creative */}
              <div className="bg-[#191B1F] border border-white/5 rounded-xl p-5">
                <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <Play className="w-4 h-4 text-[#FF3838]" /> Original Creative
                </h2>
                {run.videoUrl ? (
                  <div className="rounded-lg overflow-hidden bg-black mb-3">
                    <video src={run.videoUrl} controls className="w-full" poster={run.thumbnailUrl || undefined} />
                  </div>
                ) : run.thumbnailUrl ? (
                  <img src={run.thumbnailUrl} alt="Thumbnail" className="w-full rounded-lg mb-3" />
                ) : null}
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span className="bg-white/5 px-2 py-1 rounded">{run.product}</span>
                  <span className="bg-white/5 px-2 py-1 rounded">{run.priority}</span>
                  <span>{new Date(run.createdAt).toLocaleString()}</span>
                </div>
              </div>

              {/* Transcript */}
              {run.transcript && (
                <div className="bg-[#191B1F] border border-white/5 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-white font-semibold flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-400" /> Transcript
                    </h2>
                    <button
                      onClick={() => { navigator.clipboard.writeText(run.transcript || ""); toast.success("Copied!"); }}
                      className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-white/5"
                    >
                      <Copy className="w-3.5 h-3.5" /> Copy
                    </button>
                  </div>
                  <div className="text-gray-300 text-sm leading-relaxed max-h-80 overflow-y-auto pr-2">
                    {run.transcript}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Section 3: Visual Analysis */}
          {run.visualAnalysis && (
            <div className="bg-[#191B1F] border border-white/5 rounded-xl p-5 mb-6">
              <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                <Eye className="w-4 h-4 text-[#FF3838]" /> Visual Analysis
              </h2>
              <div className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                <MarkdownContent content={run.visualAnalysis} />
              </div>
            </div>
          )}

          {/* Section 4: Generated Scripts */}
          {scripts.length > 0 && <ScriptsSection scripts={scripts} />}

          {/* Section 5: ClickUp Tasks */}
          {clickupTasks.length > 0 && (
            <div className="bg-[#191B1F] border border-white/5 rounded-xl p-5 mt-6">
              <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-[#FF3838]" /> ClickUp Tasks Created ({clickupTasks.length})
              </h2>
              <div className="space-y-2">
                {clickupTasks.map((task: any, i: number) => (
                  <div key={i} className="flex items-center justify-between bg-[#01040A] rounded-lg px-4 py-3 border border-white/5">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                      <span className="text-white text-sm">{task.name}</span>
                      {scripts[i]?.review?.finalScore && (
                        <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded">
                          Score: {scripts[i].review.finalScore}
                        </span>
                      )}
                    </div>
                    {task.url && task.url !== "#" && (
                      <a href={task.url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================
// STATIC RESULTS — 7-Stage Pipeline UI
// ============================================================
function StaticResults({ run }: { run: any }) {
  const currentStageIdx = getStageIndex(run.staticStage);
  const referenceImages = (run.staticAdImages as any[])?.filter((img: any) => !img.variation) || [];
  const generatedImages = (run.staticAdImages as any[])?.filter((img: any) => img.variation) || [];
  const briefReview = run.staticBriefReview as any;
  const creativeReview = run.staticCreativeReview as any;
  const isRunning = run.status === "running" || run.status === "pending";

  return (
    <div className="space-y-6">
      {/* Stage Progress Bar */}
      <div className="bg-[#191B1F] border border-white/5 rounded-xl p-5">
        <h2 className="text-white font-semibold mb-4">Pipeline Progress</h2>
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {STATIC_STAGES.filter(s => s.key !== "stage_6_revising").map((stage, i) => {
            const stageIdx = getStageIndex(stage.key);
            const isComplete = currentStageIdx > stageIdx || run.status === "completed";
            const isCurrent = run.staticStage === stage.key;
            const isPending = currentStageIdx < stageIdx && run.status !== "completed";
            const Icon = stage.icon;

            return (
              <div key={stage.key} className="flex items-center">
                <div className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap ${
                  isComplete
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : isCurrent
                    ? "bg-[#FF3838]/20 text-[#FF3838] border border-[#FF3838]/30"
                    : isPending
                    ? "bg-white/5 text-gray-500 border border-white/10"
                    : "bg-white/5 text-gray-500 border border-white/10"
                }`}>
                  {isComplete ? (
                    <CheckCircle className="w-3.5 h-3.5" />
                  ) : isCurrent ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Icon className="w-3.5 h-3.5" />
                  )}
                  {stage.label}
                </div>
                {i < STATIC_STAGES.filter(s => s.key !== "stage_6_revising").length - 1 && (
                  <ChevronRight className="w-4 h-4 text-gray-600 mx-1 flex-shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Stage 1: Reference Ad */}
      {referenceImages.length > 0 && (
        <div className="bg-[#191B1F] border border-white/5 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Eye className="w-4 h-4 text-[#FF3838]" /> Stage 1: Competitor Reference
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {referenceImages.map((img: any, i: number) => (
              <div key={i} className="rounded-lg overflow-hidden bg-[#01040A] border border-white/5">
                {img.imageUrl && <img src={img.imageUrl} alt={img.title || "Ad"} className="w-full aspect-square object-cover" />}
                <div className="p-3">
                  <p className="text-white text-sm font-medium truncate">{img.title || "Untitled"}</p>
                  <p className="text-gray-500 text-xs">{img.brandName}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stage 1: Analysis */}
      {run.staticAnalysis && (
        <div className="bg-[#191B1F] border border-white/5 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Eye className="w-4 h-4 text-[#FF3838]" /> Stage 1: Competitor Ad Analysis
          </h2>
          <div className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
            <MarkdownContent content={run.staticAnalysis} />
          </div>
        </div>
      )}

      {/* Stage 2: Creative Brief */}
      {run.staticBrief && (
        <div className="bg-[#191B1F] border border-white/5 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#FF3838]" /> Stage 2: Creative Brief
            </h2>
            <button
              onClick={() => { navigator.clipboard.writeText(run.staticBrief || ""); toast.success("Brief copied!"); }}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-white/5"
            >
              <Copy className="w-3.5 h-3.5" /> Copy
            </button>
          </div>
          <div className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
            <MarkdownContent content={run.staticBrief} />
          </div>
        </div>
      )}

      {/* Stage 3: Brief Expert Review */}
      {briefReview && (
        <div className="bg-[#191B1F] border border-white/5 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Star className="w-4 h-4 text-yellow-400" /> Stage 3: Brief Expert Review
          </h2>
          <ExpertReviewPanel review={briefReview} label="Brief" />
        </div>
      )}

      {/* Stage 3b: Selection Gate */}
      {run.staticStage === "stage_3b_selection" && run.briefOptionsJson && (
        <SelectionGate
          runId={run.id}
          options={run.briefOptionsJson as any}
          product={run.product || ""}
          onSubmitted={() => {}}
        />
      )}

      {/* Stage 4: Generated Images */}
      {generatedImages.length > 0 && (
        <div className="bg-[#191B1F] border border-white/5 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-[#FF3838]" /> Stage 4: Generated ONEST Creatives ({generatedImages.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {generatedImages.map((img: any, i: number) => (
              <div key={i} className="rounded-lg overflow-hidden bg-[#01040A] border border-white/10 p-4">
                <div className="mb-3">
                  <span className="text-xs font-bold text-[#FF3838] bg-[#FF3838]/10 px-2 py-1 rounded">
                    {img.variation?.toUpperCase() || `VARIATION ${i + 1}`}
                  </span>
                </div>
                <img src={img.url} alt={img.variation || "Generated creative"} className="w-full rounded-lg mb-3 aspect-square object-cover" />
                <div className="flex gap-2">
                  <button
                    onClick={() => { navigator.clipboard.writeText(img.url); toast.success("URL copied!"); }}
                    className="flex-1 text-xs bg-[#FF3838] hover:bg-[#FF3838]/90 text-white px-3 py-2 rounded transition-colors"
                  >
                    Copy URL
                  </button>
                  <a
                    href={img.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-xs bg-white/5 hover:bg-white/10 text-white px-3 py-2 rounded text-center transition-colors"
                  >
                    Download
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stage 5: Creative Expert Review */}
      {creativeReview && (
        <div className="bg-[#191B1F] border border-white/5 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Star className="w-4 h-4 text-yellow-400" /> Stage 5: Creative Expert Review
          </h2>
          <ExpertReviewPanel review={creativeReview} label="Creative" />
          {creativeReview.overallFeedback && (
            <div className="mt-4 bg-[#01040A] rounded-lg p-4 border border-white/5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Panel Consensus</p>
              <p className="text-gray-300 text-sm italic">{creativeReview.overallFeedback}</p>
            </div>
          )}
          {creativeReview.suggestedAdjustments?.length > 0 && (
            <div className="mt-3 bg-[#01040A] rounded-lg p-4 border border-white/5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Suggested Adjustments</p>
              <ul className="text-gray-300 text-sm space-y-1">
                {creativeReview.suggestedAdjustments.map((adj: string, i: number) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-[#FF3838]">•</span> {adj}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Stage 6: Team Approval */}
      {(run.staticStage === "stage_6_team_approval" || run.staticStage === "stage_6_revising" || run.teamApprovalStatus) && (
        <TeamApprovalSection run={run} />
      )}

      {/* Stage 7: ClickUp Tasks */}
      {(run.clickupTasksJson as any[])?.length > 0 && (
        <div className="bg-[#191B1F] border border-white/5 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-emerald-400" /> Stage 7: ClickUp Tasks
          </h2>
          <div className="space-y-2">
            {(run.clickupTasksJson as any[]).map((task: any, i: number) => (
              <div key={i} className="flex items-center justify-between bg-[#01040A] rounded-lg px-4 py-3 border border-white/5">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span className="text-white text-sm">{task.name}</span>
                </div>
                {task.url && task.url !== "#" && (
                  <a href={task.url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Running indicator for static pipeline */}
      {isRunning && run.staticStage && !["stage_3b_selection", "stage_6_team_approval", "completed"].includes(run.staticStage) && (
        <div className="bg-[#191B1F] border border-orange-500/20 rounded-xl p-6">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-orange-400 animate-spin" />
            <span className="text-white font-medium">
              Processing: {STATIC_STAGES.find(s => s.key === run.staticStage)?.label || run.staticStage}...
            </span>
          </div>
          <p className="text-gray-400 text-sm mt-2">This page auto-refreshes every 3 seconds.</p>
        </div>
      )}
    </div>
  );
}

// ============================================================
// TEAM APPROVAL SECTION
// ============================================================
function TeamApprovalSection({ run }: { run: any }) {
  const [notes, setNotes] = useState("");
  const utils = trpc.useUtils();

  const teamApproveMutation = trpc.pipeline.teamApprove.useMutation({
    onSuccess: () => {
      toast.success("Decision submitted!");
      utils.pipeline.get.invalidate({ id: run.id });
    },
    onError: (err) => {
      toast.error("Failed: " + err.message);
    },
  });

  const isAwaitingApproval = run.staticStage === "stage_6_team_approval" && run.teamApprovalStatus === "pending";
  const isRevising = run.staticStage === "stage_6_revising";
  const wasApproved = run.teamApprovalStatus === "approved";
  const wasRejected = run.teamApprovalStatus === "rejected" && !isRevising;

  return (
    <div className="bg-[#191B1F] border border-white/5 rounded-xl p-5">
      <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
        <ThumbsUp className="w-4 h-4 text-[#FF3838]" /> Stage 6: Team Approval
      </h2>

      {isRevising && (
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 text-orange-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Revising creatives based on your feedback...
          </div>
          {run.teamApprovalNotes && (
            <p className="text-gray-400 text-xs mt-2">Your feedback: "{run.teamApprovalNotes}"</p>
          )}
        </div>
      )}

      {wasApproved && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 text-emerald-400 text-sm">
            <CheckCircle className="w-4 h-4" />
            Approved by team
          </div>
          {run.teamApprovalNotes && (
            <p className="text-gray-400 text-xs mt-2">Notes: {run.teamApprovalNotes}</p>
          )}
        </div>
      )}

      {isAwaitingApproval && (
        <div className="space-y-4">
          <div className="bg-[#01040A] rounded-lg p-4 border border-white/10">
            <p className="text-gray-300 text-sm mb-3">
              Review the generated creatives above. Approve to proceed to ClickUp task creation, or provide feedback for revisions.
            </p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional: Add notes or suggest prompt edits for revisions..."
              className="w-full bg-[#191B1F] border border-white/10 rounded-lg p-3 text-white text-sm placeholder-gray-500 resize-none focus:outline-none focus:border-[#FF3838]/50"
              rows={3}
            />
          </div>

          <div className="flex gap-3">
            <Button
              onClick={() => teamApproveMutation.mutate({ runId: run.id, approved: true, notes: notes || "Approved" })}
              disabled={teamApproveMutation.isPending}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {teamApproveMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ThumbsUp className="w-4 h-4 mr-2" />
              )}
              Approve & Create ClickUp Task
            </Button>

            <Button
              onClick={() => {
                if (!notes.trim()) {
                  toast.error("Please provide feedback for the revision");
                  return;
                }
                teamApproveMutation.mutate({ runId: run.id, approved: false, notes });
              }}
              disabled={teamApproveMutation.isPending}
              variant="outline"
              className="flex-1 border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
            >
              {teamApproveMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Request Changes
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// SHARED COMPONENTS
// ============================================================
function StepStatus({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {done ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <div className="w-4 h-4 rounded-full border border-gray-600" />}
      <span className={done ? "text-emerald-400" : "text-gray-500"}>{label}</span>
    </div>
  );
}

function ScriptsSection({ scripts }: { scripts: any[] }) {
  const [activeTab, setActiveTab] = useState(0);
  const script = scripts[activeTab];

  return (
    <div className="bg-[#191B1F] border border-white/5 rounded-xl overflow-hidden mt-6">
      <div className="px-5 pt-5 pb-0">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <PenTool className="w-4 h-4 text-[#FF3838]" /> Generated Scripts ({scripts.length})
          </h2>
          <span className="text-xs bg-emerald-600 text-white px-2 py-0.5 rounded font-medium">Expert Reviewed</span>
        </div>
        <div className="flex border-b border-white/5">
          {scripts.map((s: any, i: number) => (
            <button
              key={i}
              onClick={() => setActiveTab(i)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === i
                  ? "border-[#FF3838] text-white"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              {s.label}
              {s.review?.finalScore && (
                <span className={`ml-2 text-xs ${activeTab === i ? "text-orange-400" : "text-gray-600"}`}>
                  {s.review.finalScore}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {script && (
        <div className="p-5">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-white">
              {script.title}
              {script.review?.finalScore && (
                <span className="ml-2 text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">
                  Score: {script.review.finalScore}/100
                </span>
              )}
            </h3>
          </div>

          {script.review && <ExpertReviewPanel review={script.review} label="Script" />}

          {script.review?.summary && (
            <div className="text-gray-300 text-sm italic leading-relaxed mb-6 bg-[#01040A] rounded-lg p-4 border border-white/5">
              {script.review.summary}
            </div>
          )}

          <div className="mb-6">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 bg-[#01040A] inline-block px-2 py-1 rounded">HOOK</div>
            <p className="text-white text-base">{script.hook}</p>
          </div>

          {script.script && Array.isArray(script.script) && script.script.length > 0 && (
            <div className="mb-6">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">FULL SCRIPT</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left text-gray-400 font-medium py-2 pr-4 w-24">TIMESTAMP</th>
                      <th className="text-left text-gray-400 font-medium py-2 pr-4">VISUAL</th>
                      <th className="text-left text-gray-400 font-medium py-2">DIALOGUE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {script.script.map((row: any, i: number) => (
                      <tr key={i} className="border-b border-white/5">
                        <td className="py-3 pr-4 text-orange-400 font-medium align-top whitespace-nowrap">{row.timestamp}</td>
                        <td className="py-3 pr-4 text-gray-300 align-top">{row.visual}</td>
                        <td className="py-3 text-gray-300 align-top">{row.dialogue}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {script.visualDirection && (
            <div className="mb-6">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">VISUAL DIRECTION</div>
              <div className="text-gray-300 text-sm leading-relaxed bg-[#01040A] rounded-lg p-4 border border-white/5">
                {script.visualDirection}
              </div>
            </div>
          )}

          {script.strategicThesis && (
            <div className="mb-6">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">STRATEGIC THESIS</div>
              <div className="text-gray-300 text-sm leading-relaxed bg-[#01040A] rounded-lg p-4 border border-white/5">
                {script.strategicThesis}
              </div>
            </div>
          )}

          <button
            onClick={() => {
              const text = formatScriptText(script);
              navigator.clipboard.writeText(text);
              toast.success("Script copied!");
            }}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white px-3 py-2 rounded-lg hover:bg-white/5 border border-white/5"
          >
            <Copy className="w-4 h-4" /> Copy Full Script
          </button>
        </div>
      )}
    </div>
  );
}

function ExpertReviewPanel({ review, label }: { review: any; label: string }) {
  const [expandedRound, setExpandedRound] = useState<number | null>(
    review.rounds?.length ? review.rounds.length - 1 : null
  );
  const [expandedExperts, setExpandedExperts] = useState<Set<number>>(new Set());

  const toggleExpert = (i: number) => {
    setExpandedExperts(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  // Handle both round-based and flat review structures
  const hasRounds = review.rounds && Array.isArray(review.rounds) && review.rounds.length > 0;
  const flatReviews = !hasRounds && review.reviews ? review.reviews : null;

  return (
    <div className="bg-[#01040A] border border-white/5 rounded-xl p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#FF3838]/20 flex items-center justify-center">
            <Star className="w-5 h-5 text-yellow-400" />
          </div>
          <div>
            <div className="text-white font-semibold">{label} Expert Review Panel</div>
            <div className="text-gray-500 text-xs">
              {hasRounds ? `${review.rounds.length} round(s) of review` : `${flatReviews?.length || 0} expert reviews`}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-orange-400">
            <span className="text-yellow-400">★</span> {review.finalScore}<span className="text-sm text-gray-400">/100</span>
          </div>
          {review.approved && (
            <span className="text-xs bg-emerald-600 text-white px-2 py-0.5 rounded">Approved</span>
          )}
        </div>
      </div>

      {/* Round-based reviews (for script/brief reviews) */}
      {hasRounds && (
        <>
          {review.rounds.length > 1 && (
            <div className="flex items-center gap-2 mb-4 text-sm">
              <span className="text-gray-500">↗</span>
              {review.rounds.map((r: any, i: number) => (
                <span key={i} className="flex items-center gap-1">
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    i === review.rounds.length - 1 ? "bg-emerald-600 text-white" : "bg-white/5 text-gray-400"
                  }`}>
                    R{r.roundNumber}: {r.averageScore}
                  </span>
                  {i < review.rounds.length - 1 && <span className="text-gray-600">→</span>}
                </span>
              ))}
            </div>
          )}

          {review.rounds.map((round: any, ri: number) => (
            <div key={ri} className="mb-3">
              <button
                onClick={() => setExpandedRound(expandedRound === ri ? null : ri)}
                className="w-full flex items-center justify-between py-2 text-sm"
              >
                <span className="text-gray-400">Round {round.roundNumber}</span>
                <span className="flex items-center gap-2">
                  <span className="text-orange-400 font-semibold">{round.averageScore}</span>
                  <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${expandedRound === ri ? "rotate-180" : ""}`} />
                </span>
              </button>

              {expandedRound === ri && (
                <div className="ml-4 border-l border-white/10 pl-4 py-2 space-y-2">
                  {round.expertReviews?.map((er: any, ei: number) => (
                    <div key={ei} className="text-sm">
                      <button
                        onClick={() => toggleExpert(ri * 100 + ei)}
                        className="w-full flex items-center justify-between py-1 text-gray-300 hover:text-white"
                      >
                        <span>{er.expertName}</span>
                        <span className="flex items-center gap-2">
                          <span className="text-orange-400 font-semibold">{er.score}</span>
                          <ChevronRight className={`w-3 h-3 text-gray-600 transition-transform ${expandedExperts.has(ri * 100 + ei) ? "rotate-90" : ""}`} />
                        </span>
                      </button>
                      {expandedExperts.has(ri * 100 + ei) && (
                        <div className="ml-6 pb-3 text-sm text-gray-400">{er.feedback}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {/* Flat reviews (for creative reviews without rounds) */}
      {flatReviews && (
        <div className="space-y-2">
          {flatReviews.map((er: any, ei: number) => (
            <div key={ei} className="text-sm">
              <button
                onClick={() => toggleExpert(ei)}
                className="w-full flex items-center justify-between py-1 text-gray-300 hover:text-white"
              >
                <span>{er.expertName}</span>
                <span className="flex items-center gap-2">
                  <span className="text-orange-400 font-semibold">{er.score}</span>
                  <ChevronRight className={`w-3 h-3 text-gray-600 transition-transform ${expandedExperts.has(ei) ? "rotate-90" : ""}`} />
                </span>
              </button>
              {expandedExperts.has(ei) && (
                <div className="ml-6 pb-3 text-sm text-gray-400">{er.feedback}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MarkdownContent({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith("**") && line.endsWith("**")) {
          return <p key={i} className="font-semibold text-white mt-3">{line.replace(/\*\*/g, "")}</p>;
        }
        if (line.startsWith("---")) {
          return <hr key={i} className="border-white/10 my-3" />;
        }
        if (line.startsWith("* ") || line.startsWith("- ")) {
          const text = line.slice(2);
          return (
            <p key={i} className="pl-4 relative">
              <span className="absolute left-0">•</span>
              <InlineBold text={text} />
            </p>
          );
        }
        if (line.startsWith("  * ") || line.startsWith("  - ")) {
          const text = line.slice(4);
          return (
            <p key={i} className="pl-8 relative">
              <span className="absolute left-4">•</span>
              <InlineBold text={text} />
            </p>
          );
        }
        if (line.trim() === "") return <div key={i} className="h-2" />;
        return <p key={i}><InlineBold text={line} /></p>;
      })}
    </div>
  );
}

function InlineBold({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function formatScriptText(script: any): string {
  let text = `${script.title}\n\nHOOK: ${script.hook}\n\nFULL SCRIPT:\n`;
  if (script.script && Array.isArray(script.script)) {
    for (const row of script.script) {
      text += `\n[${row.timestamp}]\nVISUAL: ${row.visual}\nDIALOGUE: ${row.dialogue}\n`;
    }
  }
  text += `\nVISUAL DIRECTION:\n${script.visualDirection}\n\nSTRATEGIC THESIS:\n${script.strategicThesis}`;
  return text;
}
