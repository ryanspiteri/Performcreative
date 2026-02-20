import { Eye, FileText, ImageIcon, Loader2, CheckCircle, ChevronRight, Copy, ExternalLink, ThumbsUp, ThumbsDown, Sparkles, ListChecks, RefreshCw, Send, X } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { trpc } from "@/lib/trpc";

export function IterationResults({ run }: { run: any }) {
  const isRunning = run.status === "running" || run.status === "pending";
  const iterationStage = run.iterationStage || "stage_1_analysis";
  const [approvalNotes, setApprovalNotes] = useState("");
  const [variationApprovalNotes, setVariationApprovalNotes] = useState("");
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);
  const [regenOverrides, setRegenOverrides] = useState<{ headline?: string; subheadline?: string; backgroundPrompt?: string }>({});
  const [showRegenForm, setShowRegenForm] = useState<number | null>(null);

  const utils = trpc.useUtils();

  const approveBrief = trpc.pipeline.approveIterationBrief.useMutation({
    onSuccess: () => { toast.success("Brief approved! Generating variations..."); utils.pipeline.get.invalidate(); utils.pipeline.list.invalidate(); },
    onError: (err) => toast.error(err.message),
  });

  const rejectBrief = trpc.pipeline.approveIterationBrief.useMutation({
    onSuccess: () => { toast.success("Brief rejected."); utils.pipeline.get.invalidate(); utils.pipeline.list.invalidate(); },
    onError: (err) => toast.error(err.message),
  });

  const approveVariations = trpc.pipeline.approveIterationVariations.useMutation({
    onSuccess: () => { toast.success("Variations approved! Creating ClickUp tasks..."); utils.pipeline.get.invalidate(); utils.pipeline.list.invalidate(); },
    onError: (err) => toast.error(err.message),
  });

  const skipClickUp = trpc.pipeline.approveIterationVariations.useMutation({
    onSuccess: () => { toast.success("Completed without ClickUp push."); utils.pipeline.get.invalidate(); utils.pipeline.list.invalidate(); },
    onError: (err) => toast.error(err.message),
  });

  const regenerateVariation = trpc.pipeline.regenerateVariation.useMutation({
    onSuccess: () => {
      toast.success("Variation regenerated!");
      setRegeneratingIndex(null);
      setShowRegenForm(null);
      setRegenOverrides({});
      utils.pipeline.get.invalidate();
      utils.pipeline.list.invalidate();
    },
    onError: (err) => {
      toast.error(`Regeneration failed: ${err.message}`);
      setRegeneratingIndex(null);
    },
  });

  // Parse brief JSON for structured display
  let briefData: any = null;
  if (run.iterationBrief) {
    try {
      briefData = JSON.parse(run.iterationBrief);
    } catch {
      briefData = null;
    }
  }

  // Parse variations
  const variations: Array<{ url: string; variation: string }> = Array.isArray(run.iterationVariations) ? run.iterationVariations : [];

  // Parse ClickUp tasks
  const clickupTasks: Array<{ name: string; taskId?: string; url?: string; error?: string }> = Array.isArray(run.clickupTasksJson) ? run.clickupTasksJson : [];

  const stages = [
    { key: "stage_1_analysis", label: "Analysis", icon: Eye },
    { key: "stage_2_brief", label: "Creative Brief", icon: FileText },
    { key: "stage_2b_approval", label: "Brief Approval", icon: ThumbsUp },
    { key: "stage_3_generation", label: "Generate", icon: Sparkles },
    { key: "stage_3b_variation_approval", label: "Review Variations", icon: ThumbsUp },
    { key: "stage_4_clickup", label: "ClickUp", icon: ListChecks },
    { key: "completed", label: "Done", icon: CheckCircle },
  ];

  const stageIndex = stages.findIndex(s => s.key === iterationStage);

  const handleRegenerate = (index: number) => {
    setRegeneratingIndex(index);
    regenerateVariation.mutate({
      runId: run.id,
      variationIndex: index,
      headline: regenOverrides.headline || undefined,
      subheadline: regenOverrides.subheadline || undefined,
      backgroundPrompt: regenOverrides.backgroundPrompt || undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* Stage Progress Bar */}
      <div className="bg-[#191B1F] border border-white/5 rounded-xl p-5">
        <h2 className="text-white font-semibold mb-4">Iteration Pipeline Progress</h2>
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {stages.map((stage, i, arr) => {
            const Icon = stage.icon;
            const isCurrent = iterationStage === stage.key;
            const isComplete = run.status === "completed" || i < stageIndex;

            return (
              <div key={stage.key} className="flex items-center">
                <div className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap ${
                  isComplete
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : isCurrent
                    ? "bg-[#FF3838]/20 text-[#FF3838] border border-[#FF3838]/30"
                    : "bg-white/5 text-gray-500 border border-white/10"
                }`}>
                  {isComplete ? (
                    <CheckCircle className="w-3.5 h-3.5" />
                  ) : isCurrent && isRunning ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Icon className="w-3.5 h-3.5" />
                  )}
                  {stage.label}
                </div>
                {i < arr.length - 1 && (
                  <ChevronRight className="w-4 h-4 text-gray-600 mx-1 flex-shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Original Winning Ad */}
      {run.iterationSourceUrl && (
        <div className="bg-[#191B1F] border border-white/5 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Eye className="w-4 h-4 text-[#FF3838]" /> Original Winning Ad
          </h2>
          <div className="rounded-lg overflow-hidden bg-[#01040A] border border-white/5 inline-block">
            <img src={run.iterationSourceUrl} alt="Original Ad" className="max-w-md" />
          </div>
        </div>
      )}

      {/* Analysis */}
      {run.iterationAnalysis && (
        <div className="bg-[#191B1F] border border-white/5 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold flex items-center gap-2">
              <Eye className="w-4 h-4 text-[#FF3838]" /> Stage 1: Ad Analysis
            </h2>
            <button
              onClick={() => { navigator.clipboard.writeText(run.iterationAnalysis || ""); toast.success("Analysis copied!"); }}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-white/5"
            >
              <Copy className="w-3.5 h-3.5" /> Copy
            </button>
          </div>
          <div className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">
            {run.iterationAnalysis}
          </div>
        </div>
      )}

      {/* Creative Brief */}
      {run.iterationBrief && (
        <div className="bg-[#191B1F] border border-white/5 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#FF3838]" /> Stage 2: Iteration Brief
            </h2>
            <button
              onClick={() => { navigator.clipboard.writeText(run.iterationBrief || ""); toast.success("Brief copied!"); }}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-white/5"
            >
              <Copy className="w-3.5 h-3.5" /> Copy
            </button>
          </div>

          {/* Structured brief display */}
          {briefData && briefData.variations ? (
            <div className="space-y-4">
              {briefData.originalHeadline && (
                <div className="bg-[#01040A] rounded-lg p-3 border border-white/5">
                  <span className="text-xs text-gray-500 block mb-1">Original Headline</span>
                  <p className="text-white font-bold text-lg">{briefData.originalHeadline}</p>
                  {briefData.originalAngle && (
                    <p className="text-gray-400 text-sm mt-1">{briefData.originalAngle}</p>
                  )}
                </div>
              )}

              {briefData.preserveElements && (
                <div className="bg-[#01040A] rounded-lg p-3 border border-white/5">
                  <span className="text-xs text-gray-500 block mb-2">Preserve These Elements</span>
                  <div className="flex flex-wrap gap-2">
                    {briefData.preserveElements.map((el: string, i: number) => (
                      <span key={i} className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-full border border-emerald-500/20">
                        {el}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {briefData.variations.map((v: any, i: number) => (
                  <div key={i} className="bg-[#01040A] rounded-lg p-4 border border-white/10">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs font-bold text-[#FF3838] bg-[#FF3838]/10 px-2 py-1 rounded">
                        V{v.number || i + 1}
                      </span>
                      <span className="text-xs text-gray-400">{v.angle}</span>
                    </div>
                    <p className="text-white font-bold text-sm mb-1">{v.headline}</p>
                    {v.subheadline && <p className="text-gray-400 text-xs mb-2">{v.subheadline}</p>}
                    {v.angleDescription && <p className="text-gray-500 text-xs italic">{v.angleDescription}</p>}
                    {v.benefitCallouts && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {v.benefitCallouts.map((b: string, j: number) => (
                          <span key={j} className="text-[10px] bg-white/5 text-gray-300 px-1.5 py-0.5 rounded">
                            {b}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
              {run.iterationBrief}
            </div>
          )}

          {/* Brief Approval Gate */}
          {iterationStage === "stage_2b_approval" && run.status !== "failed" && (
            <div className="mt-6 border-t border-white/10 pt-4">
              <h3 className="text-white font-medium mb-3">Approve this brief to generate variations</h3>
              <textarea
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder="Optional notes or feedback..."
                className="w-full bg-[#01040A] border border-white/10 rounded-lg p-3 text-sm text-gray-300 placeholder-gray-600 mb-3 resize-none"
                rows={2}
              />
              <div className="flex gap-3">
                <button
                  onClick={() => approveBrief.mutate({ runId: run.id, approved: true, notes: approvalNotes || undefined })}
                  disabled={approveBrief.isPending}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {approveBrief.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsUp className="w-4 h-4" />}
                  Approve & Generate
                </button>
                <button
                  onClick={() => rejectBrief.mutate({ runId: run.id, approved: false, notes: approvalNotes || "Changes requested" })}
                  disabled={rejectBrief.isPending}
                  className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-gray-300 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {rejectBrief.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsDown className="w-4 h-4" />}
                  Reject
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Generated Variations */}
      {variations.length > 0 && (
        <div className="bg-[#191B1F] border border-white/5 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#FF3838]" /> Stage 3: Generated Variations ({variations.length})
          </h2>
          <p className="text-gray-400 text-xs mb-4">
            Generated with Flux Pro backgrounds + Bannerbear compositing
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {variations.map((v: any, i: number) => {
              const briefVariation = briefData?.variations?.[i];
              const isRegenerating = regeneratingIndex === i;
              const isShowingForm = showRegenForm === i;

              return (
                <div key={i} className="rounded-lg overflow-hidden bg-[#01040A] border border-white/10">
                  <div className="p-3 border-b border-white/5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2 py-1 rounded ${
                          v.url && !v.url.includes("placeholder")
                            ? "text-[#FF3838] bg-[#FF3838]/10"
                            : "text-red-400 bg-red-500/10"
                        }`}>
                          {v.url && !v.url.includes("placeholder")
                            ? (v.variation || `Variation ${i + 1}`)
                            : `${v.variation || `Variation ${i + 1}`} (failed)`
                          }
                        </span>
                        {briefVariation?.angle && (
                          <span className="text-xs text-gray-500">{briefVariation.angle}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Image or failed state */}
                  {isRegenerating ? (
                    <div className="w-full aspect-square bg-[#191B1F] flex flex-col items-center justify-center gap-3">
                      <Loader2 className="w-8 h-8 text-[#FF3838] animate-spin" />
                      <span className="text-gray-400 text-xs">Regenerating with Flux Pro...</span>
                      <span className="text-gray-600 text-[10px]">This may take 1-2 minutes</span>
                    </div>
                  ) : v.url && !v.url.includes("placeholder") ? (
                    <a href={v.url} target="_blank" rel="noopener noreferrer" className="block">
                      <img src={v.url} alt={v.variation || `Variation ${i + 1}`} className="w-full aspect-square object-cover" />
                    </a>
                  ) : (
                    <div className="w-full aspect-square bg-[#191B1F] flex items-center justify-center">
                      <span className="text-gray-600 text-xs">Generation failed</span>
                    </div>
                  )}

                  <div className="p-3 space-y-2">
                    {briefVariation?.headline && (
                      <p className="text-white font-bold text-sm">{briefVariation.headline}</p>
                    )}
                    {briefVariation?.subheadline && (
                      <p className="text-gray-400 text-xs">{briefVariation.subheadline}</p>
                    )}

                    {/* Action buttons - only show during variation approval stage */}
                    {iterationStage === "stage_3b_variation_approval" && !isRegenerating && (
                      <div className="space-y-2 pt-2">
                        {v.url && !v.url.includes("placeholder") && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => { navigator.clipboard.writeText(v.url); toast.success("URL copied!"); }}
                              className="flex-1 bg-[#FF3838]/10 hover:bg-[#FF3838]/20 text-[#FF3838] px-3 py-2 rounded-lg text-xs font-medium"
                            >
                              Copy URL
                            </button>
                            <a
                              href={v.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 bg-white/5 hover:bg-white/10 text-white px-3 py-2 rounded-lg text-xs font-medium text-center"
                            >
                              Open
                            </a>
                          </div>
                        )}

                        {/* Regenerate button */}
                        {isShowingForm ? (
                          <div className="space-y-2 border-t border-white/5 pt-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-400 font-medium">Regenerate Options</span>
                              <button onClick={() => { setShowRegenForm(null); setRegenOverrides({}); }} className="text-gray-500 hover:text-white">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <input
                              type="text"
                              placeholder="New headline (optional)"
                              value={regenOverrides.headline || ""}
                              onChange={(e) => setRegenOverrides(prev => ({ ...prev, headline: e.target.value }))}
                              className="w-full bg-[#191B1F] border border-white/10 rounded px-2 py-1.5 text-xs text-gray-300 placeholder-gray-600"
                            />
                            <input
                              type="text"
                              placeholder="New subheadline (optional)"
                              value={regenOverrides.subheadline || ""}
                              onChange={(e) => setRegenOverrides(prev => ({ ...prev, subheadline: e.target.value }))}
                              className="w-full bg-[#191B1F] border border-white/10 rounded px-2 py-1.5 text-xs text-gray-300 placeholder-gray-600"
                            />
                            <textarea
                              placeholder="Background prompt (optional, e.g. 'dark moody gym background with smoke')"
                              value={regenOverrides.backgroundPrompt || ""}
                              onChange={(e) => setRegenOverrides(prev => ({ ...prev, backgroundPrompt: e.target.value }))}
                              className="w-full bg-[#191B1F] border border-white/10 rounded px-2 py-1.5 text-xs text-gray-300 placeholder-gray-600 resize-none"
                              rows={2}
                            />
                            <button
                              onClick={() => handleRegenerate(i)}
                              disabled={regenerateVariation.isPending}
                              className="w-full flex items-center justify-center gap-1.5 bg-[#FF3838] hover:bg-[#FF3838]/80 text-white px-3 py-2 rounded-lg text-xs font-medium disabled:opacity-50"
                            >
                              <RefreshCw className="w-3.5 h-3.5" /> Regenerate Now
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowRegenForm(i)}
                            className="w-full flex items-center justify-center gap-1.5 bg-white/5 hover:bg-white/10 text-gray-300 px-3 py-2 rounded-lg text-xs font-medium"
                          >
                            <RefreshCw className="w-3.5 h-3.5" /> Regenerate
                          </button>
                        )}
                      </div>
                    )}

                    {/* Show URLs for completed runs */}
                    {(iterationStage === "completed" || iterationStage === "stage_4_clickup") && v.url && !v.url.includes("placeholder") && (
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => { navigator.clipboard.writeText(v.url); toast.success("URL copied!"); }}
                          className="flex-1 bg-[#FF3838]/10 hover:bg-[#FF3838]/20 text-[#FF3838] px-3 py-2 rounded-lg text-xs font-medium"
                        >
                          Copy URL
                        </button>
                        <a
                          href={v.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 bg-white/5 hover:bg-white/10 text-white px-3 py-2 rounded-lg text-xs font-medium text-center"
                        >
                          Open
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Variation Approval Gate */}
          {iterationStage === "stage_3b_variation_approval" && (
            <div className="mt-6 border-t border-white/10 pt-4">
              <h3 className="text-white font-medium mb-2">Happy with these variations?</h3>
              <p className="text-gray-400 text-xs mb-3">
                Approve to create ClickUp tasks, or regenerate individual variations above. You can also complete without pushing to ClickUp.
              </p>
              <textarea
                value={variationApprovalNotes}
                onChange={(e) => setVariationApprovalNotes(e.target.value)}
                placeholder="Optional notes..."
                className="w-full bg-[#01040A] border border-white/10 rounded-lg p-3 text-sm text-gray-300 placeholder-gray-600 mb-3 resize-none"
                rows={2}
              />
              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={() => approveVariations.mutate({ runId: run.id, approved: true, notes: variationApprovalNotes || undefined })}
                  disabled={approveVariations.isPending || regenerateVariation.isPending}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {approveVariations.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Approve & Push to ClickUp
                </button>
                <button
                  onClick={() => skipClickUp.mutate({ runId: run.id, approved: false, notes: variationApprovalNotes || "Completed without ClickUp" })}
                  disabled={skipClickUp.isPending || regenerateVariation.isPending}
                  className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-gray-300 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {skipClickUp.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Complete Without ClickUp
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ClickUp Tasks */}
      {clickupTasks.length > 0 && (
        <div className="bg-[#191B1F] border border-white/5 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-[#FF3838]" /> Stage 4: ClickUp Tasks
          </h2>
          <div className="space-y-2">
            {clickupTasks.map((task, i) => (
              <div key={i} className="flex items-center justify-between bg-[#01040A] rounded-lg p-3 border border-white/5">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm text-gray-300">{task.name}</span>
                </div>
                {task.url && (
                  <a
                    href={task.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-[#0347ED] hover:text-[#0347ED]/80"
                  >
                    Open <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {task.error && (
                  <span className="text-xs text-red-400">{task.error}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Running indicator */}
      {isRunning && iterationStage && iterationStage !== "completed" && iterationStage !== "stage_2b_approval" && iterationStage !== "stage_3b_variation_approval" && (
        <div className="bg-[#01040A] border border-[#FF3838]/30 rounded-lg p-4">
          <div className="flex items-center gap-2 text-[#FF3838] text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Processing: {iterationStage.replace(/_/g, " ").replace("stage ", "Stage ")}...
          </div>
          {iterationStage === "stage_3_generation" && (
            <p className="text-gray-500 text-xs mt-2">
              Generating backgrounds with Flux Pro and compositing with Bannerbear. This may take 1-2 minutes per image...
            </p>
          )}
          {iterationStage === "stage_4_clickup" && (
            <p className="text-gray-500 text-xs mt-2">
              Creating ClickUp tasks for approved variations...
            </p>
          )}
        </div>
      )}

      {/* Error state */}
      {run.status === "failed" && run.errorMessage && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <p className="text-red-400 text-sm font-medium">Pipeline Failed</p>
          <p className="text-red-300/70 text-xs mt-1">{run.errorMessage}</p>
        </div>
      )}

      {/* Completed state */}
      {run.status === "completed" && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
            <CheckCircle className="w-4 h-4" />
            Iteration pipeline completed
          </div>
          <p className="text-emerald-300/60 text-xs mt-1">
            {variations.length} variations generated with Flux Pro + Bannerbear
            {clickupTasks.filter(t => t.taskId).length > 0 && ` · ${clickupTasks.filter(t => t.taskId).length} ClickUp tasks created`}
            {clickupTasks.length === 0 && " · Completed without ClickUp push"}
          </p>
        </div>
      )}
    </div>
  );
}
