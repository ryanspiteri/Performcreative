import { ArrowLeft, Eye, FileText, ImageIcon, Loader2, CheckCircle, ChevronRight, Copy, ExternalLink, ThumbsUp, ThumbsDown, Sparkles, ListChecks, RefreshCw, Send, X, XCircle, Upload, Download, Pencil, Save, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { ChildGenerationControls } from "./ChildGenerationControls";
import { VISUAL_DESCRIPTION_MAX, iterationBriefV1Schema, type IterationBriefV1, type IterationBriefVariationV1, type StyleMode, type AdAngle } from "../../../shared/iterationBriefSchema";

type EditableFields = Pick<IterationBriefVariationV1, "headline" | "subheadline" | "visualDescription" | "backgroundNote" | "angle" | "benefitCallouts">;

export function IterationResults({ run }: { run: any }) {
  const isRunning = run.status === "running" || run.status === "pending";
  const iterationStage = run.iterationStage || "stage_1_analysis";
  const [, setLocation] = useLocation();
  const [approvalNotes, setApprovalNotes] = useState("");
  const [variationApprovalNotes, setVariationApprovalNotes] = useState("");
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);
  const [regenOverrides, setRegenOverrides] = useState<{
    headline?: string;
    subheadline?: string;
    customDescription?: string;
    referenceImageUrl?: string;
    styleMode?: StyleMode;
    adAngle?: AdAngle;
  }>({});
  const [regenUploading, setRegenUploading] = useState(false);
  const [showRegenForm, setShowRegenForm] = useState<number | null>(null);
  const [uploadingToCanva, setUploadingToCanva] = useState<number | null>(null);
  const [canvaDesignUrls, setCanvaDesignUrls] = useState<Record<number, string>>({});
  const [pushingToClickUp, setPushingToClickUp] = useState(false);

  // Clear regen overrides when switching between variation forms
  useEffect(() => {
    setRegenOverrides({});
  }, [showRegenForm]);

  const utils = trpc.useUtils();
  const { data: canvaStatus } = trpc.canva.isConnected.useQuery();
  const uploadToCanva = trpc.canva.uploadAndCreateDesign.useMutation();

  const pushToClickUp = trpc.pipeline.pushIterationToClickUp.useMutation({
    onSuccess: (result) => {
      toast.success(`Pushed ${result.pushedCount} variations to ClickUp!`);
      utils.pipeline.get.invalidate();
      utils.pipeline.list.invalidate();
      setPushingToClickUp(false);
    },
    onError: (err) => {
      toast.error(`ClickUp push failed: ${err.message}`);
      setPushingToClickUp(false);
    },
  });

  const handleUploadToCanva = async (index: number, imageUrl: string, title: string, width: number, height: number) => {
    setUploadingToCanva(index);
    try {
      const result = await uploadToCanva.mutateAsync({ imageUrl, title, width, height });
      setCanvaDesignUrls(prev => ({ ...prev, [index]: result.editUrl }));
      toast.success("Uploaded to Canva! Click 'Edit in Canva' to open.");
    } catch (err: any) {
      toast.error(`Canva upload failed: ${err.message}`);
    } finally {
      setUploadingToCanva(null);
    }
  };

  const approveBrief = trpc.pipeline.approveIterationBrief.useMutation({
    onSuccess: () => { toast.success("Brief approved! Generating variations..."); utils.pipeline.get.invalidate(); utils.pipeline.list.invalidate(); },
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

  // Parse brief JSON for structured display. v1 briefs are Zod-validated;
  // older runs without version field are rendered read-only as "legacy".
  let briefData: any = null;
  let briefV1: IterationBriefV1 | null = null;
  let briefIsLegacy = false;
  if (run.iterationBrief) {
    try {
      briefData = JSON.parse(run.iterationBrief);
    } catch {
      briefData = null;
    }
    if (briefData && briefData.version === 1) {
      const result = iterationBriefV1Schema.safeParse(briefData);
      if (result.success) briefV1 = result.data;
    } else if (briefData && briefData.variations) {
      briefIsLegacy = true;
    }
  }

  // Per-variation edit state — buffers hold unsaved edits, null means "not in edit mode".
  const [editBuffers, setEditBuffers] = useState<Record<number, EditableFields>>({});
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [savedFlash, setSavedFlash] = useState<Record<number, number>>({});
  const editingIndices = Object.keys(editBuffers).map((k) => Number(k));
  const hasUnsavedEdits = editingIndices.length > 0;

  const updateBriefMutation = trpc.pipeline.updateIterationBrief.useMutation({
    onSuccess: (_data, variables) => {
      utils.pipeline.get.invalidate();
    },
    onError: (err) => {
      toast.error(`Save failed: ${err.message}`);
      setSavingIndex(null);
    },
  });

  const openEdit = (i: number) => {
    if (!briefV1) return;
    const v = briefV1.variations[i];
    if (!v) return;
    setEditBuffers((prev) => ({
      ...prev,
      [i]: {
        headline: v.headline,
        subheadline: v.subheadline ?? "",
        visualDescription: v.visualDescription ?? "",
        backgroundNote: v.backgroundNote ?? "",
        angle: v.angle,
        benefitCallouts: [...(v.benefitCallouts ?? [])],
      },
    }));
  };

  const cancelEdit = (i: number) => {
    setEditBuffers((prev) => {
      const next = { ...prev };
      delete next[i];
      return next;
    });
  };

  const editAll = () => {
    if (!briefV1) return;
    const buffers: Record<number, EditableFields> = {};
    briefV1.variations.forEach((v, i) => {
      buffers[i] = {
        headline: v.headline,
        subheadline: v.subheadline ?? "",
        visualDescription: v.visualDescription ?? "",
        backgroundNote: v.backgroundNote ?? "",
        angle: v.angle,
        benefitCallouts: [...(v.benefitCallouts ?? [])],
      };
    });
    setEditBuffers(buffers);
  };

  const saveEdit = async (i: number) => {
    if (!briefV1) return;
    const buf = editBuffers[i];
    if (!buf) return;
    if ((buf.visualDescription || "").length > VISUAL_DESCRIPTION_MAX) {
      toast.error(`Visual description must be ${VISUAL_DESCRIPTION_MAX} characters or fewer`);
      return;
    }
    setSavingIndex(i);
    const nextBrief: IterationBriefV1 = {
      ...briefV1,
      variations: briefV1.variations.map((v, idx) =>
        idx === i
          ? {
              ...v,
              headline: buf.headline,
              subheadline: buf.subheadline,
              visualDescription: buf.visualDescription,
              backgroundNote: buf.backgroundNote,
              angle: buf.angle,
              benefitCallouts: buf.benefitCallouts,
            }
          : v,
      ),
    };
    try {
      await updateBriefMutation.mutateAsync({ runId: run.id, brief: nextBrief });
      cancelEdit(i);
      setSavedFlash((prev) => ({ ...prev, [i]: Date.now() }));
      setTimeout(() => {
        setSavedFlash((prev) => {
          const next = { ...prev };
          if (next[i] && Date.now() - next[i] >= 2000) delete next[i];
          return next;
        });
      }, 2500);
    } finally {
      setSavingIndex(null);
    }
  };

  // Parse variations
  const variations: Array<{ url: string; variation: string }> = Array.isArray(run.iterationVariations) ? run.iterationVariations : [];

  // Parse variation types safely
  let parsedVariationTypes: string[] = [];
  try {
    parsedVariationTypes = typeof run.variationTypes === 'string' ? JSON.parse(run.variationTypes) : (run.variationTypes || []);
  } catch { /* malformed JSON — fallback to empty */ }

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
      customDescription: regenOverrides.customDescription || undefined,
      referenceImageUrl: regenOverrides.referenceImageUrl || undefined,
      styleMode: regenOverrides.styleMode || undefined,
      adAngle: regenOverrides.adAngle || undefined,
    });
  };

  const regenUploadMutation = trpc.renders.upload.useMutation();

  const handleRegenFileUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Only image files"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Max 10MB"); return; }
    setRegenUploading(true);
    try {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.readAsDataURL(file);
      });
      const result = await regenUploadMutation.mutateAsync({
        product: "regen-reference",
        fileName: file.name.replace(/\.[^.]+$/, ""),
        mimeType: file.type,
        base64Data: base64,
      });
      setRegenOverrides(prev => ({ ...prev, referenceImageUrl: result.url }));
      toast.success("Image uploaded");
    } catch (err: any) {
      toast.error(`Upload failed: ${err.message}`);
    } finally {
      setRegenUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Error Banner */}
      {run.status === "failed" && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
              <XCircle className="w-5 h-5 text-red-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-red-400 font-semibold text-lg mb-2">Pipeline Failed</h3>
              <p className="text-gray-300 text-sm leading-relaxed mb-3">
                The iteration pipeline encountered an error and could not complete. This may be due to:
              </p>
              <ul className="text-gray-400 text-sm space-y-1 list-disc list-inside mb-4">
                <li>Image generation service timeout or rate limits</li>
                <li>Invalid input image format or size</li>
                <li>API connectivity issues</li>
                <li>Insufficient credits or quota</li>
              </ul>
              {run.errorMessage && (
                <div className="bg-black/30 rounded-lg p-3 border border-red-500/20 mb-4">
                  <span className="text-xs text-gray-500 block mb-1">Error Details:</span>
                  <p className="text-red-300 text-sm font-mono">{run.errorMessage}</p>
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => setLocation("/iterate")}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-all text-sm font-medium"
                >
                  <RefreshCw className="w-4 h-4" />
                  Retry Pipeline
                </button>
                <button
                  onClick={() => window.history.back()}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 transition-all text-sm font-medium"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Go Back
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Stage Progress Bar */}
      <div className="bg-[#191B1F] border border-white/5 rounded-xl p-5">
        <h2 className="text-white font-semibold mb-4">Static Iteration Progress</h2>
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
              {briefIsLegacy && (
                <span className="text-[10px] font-medium bg-white/10 text-gray-300 px-2 py-0.5 rounded-full">Legacy format — read-only</span>
              )}
            </h2>
            <div className="flex items-center gap-2">
              {briefV1 && iterationStage === "stage_2b_approval" && editingIndices.length === 0 && (
                <button
                  onClick={editAll}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-white/5"
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit all
                </button>
              )}
              <button
                onClick={() => { navigator.clipboard.writeText(run.iterationBrief || ""); toast.success("Brief copied!"); }}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-white/5"
              >
                <Copy className="w-3.5 h-3.5" /> Copy
              </button>
            </div>
          </div>

          {run.briefQualityWarning === 1 && iterationStage === "stage_2b_approval" && (
            <div className="mb-4 flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-200 leading-relaxed">
                <strong className="font-semibold text-amber-300">Brief quality warning.</strong> Claude returned invalid JSON twice, so the system wrote a minimal skeleton. Please edit each variation before approving, or reject and regenerate.
              </div>
            </div>
          )}

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

              {/* Variation Matrix Configuration */}
              <div className="bg-[#01040A] rounded-lg p-3 border border-white/5">
                <span className="text-xs text-gray-500 block mb-2">Variation Matrix Configuration</span>
                <div className="grid grid-cols-3 gap-4">
                  {run.variationTypes && (
                    <div>
                      <span className="text-xs text-gray-400">Variation Types</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {parsedVariationTypes.map((type: string, i: number) => (
                          <span key={i} className="text-xs bg-[#0347ED]/10 text-[#0347ED] px-2 py-1 rounded border border-[#0347ED]/20">
                            {type.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {run.variationCount && (
                    <div>
                      <span className="text-xs text-gray-400">Variation Count</span>
                      <div className="text-white font-semibold mt-1">{run.variationCount} variations</div>
                    </div>
                  )}
                  {run.aspectRatio && (
                    <div>
                      <span className="text-xs text-gray-400">Aspect Ratio</span>
                      <div className="text-white font-semibold mt-1">{run.aspectRatio}</div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {briefData.variations.map((v: any, i: number) => {
                  const buf = editBuffers[i];
                  const isEditing = !!buf;
                  const canEdit = !!briefV1 && iterationStage === "stage_2b_approval";
                  const visualLen = (buf?.visualDescription ?? "").length;
                  const visualColor =
                    visualLen > VISUAL_DESCRIPTION_MAX
                      ? "text-red-400"
                      : visualLen >= 380
                      ? "text-amber-400"
                      : "text-gray-500";
                  const justSaved = savedFlash[i] && Date.now() - savedFlash[i] < 2000;
                  return (
                    <div
                      key={i}
                      className={`${isEditing ? "bg-[#15171B] border-[#FF3838]/40" : "bg-[#01040A] border-white/10"} rounded-lg p-4 border relative`}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs font-bold text-[#FF3838] bg-[#FF3838]/10 px-2 py-1 rounded">
                          V{v.number || i + 1}
                        </span>
                        {v.variationType && (
                          <span className="text-[10px] bg-[#0347ED]/10 text-[#0347ED] px-2 py-1 rounded border border-[#0347ED]/20 whitespace-nowrap" title="Variation type">
                            {String(v.variationType).replace(/_/g, ' ')}
                          </span>
                        )}
                        <span className="text-xs text-gray-400 flex-1 truncate">{isEditing ? buf.angle : v.angle}</span>
                        {isEditing ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" title="Unsaved edits" />
                        ) : justSaved ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Saved" />
                        ) : null}
                        {canEdit && !isEditing && (
                          <button
                            onClick={() => openEdit(i)}
                            className="p-2 -m-2 text-gray-400 hover:text-white rounded hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[#FF3838]/50"
                            aria-label={`Edit variation ${v.number || i + 1}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {!isEditing && (
                        <>
                          <p className="text-white font-bold text-sm mb-1">{v.headline}</p>
                          {v.subheadline && <p className="text-gray-400 text-xs mb-2">{v.subheadline}</p>}
                          {v.visualDescription && (
                            <p className="text-gray-500 text-xs leading-relaxed mb-2">{v.visualDescription}</p>
                          )}
                          {v.angleDescription && <p className="text-gray-500 text-xs italic">{v.angleDescription}</p>}
                          {v.benefitCallouts && v.benefitCallouts.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {v.benefitCallouts.map((b: string, j: number) => (
                                <span key={j} className="text-[10px] bg-white/5 text-gray-300 px-1.5 py-0.5 rounded">
                                  {b}
                                </span>
                              ))}
                            </div>
                          )}
                        </>
                      )}

                      {isEditing && buf && (
                        <div className="space-y-2 text-xs" onKeyDown={(e) => { if (e.key === "Escape") cancelEdit(i); }}>
                          <label className="block">
                            <span className="text-gray-400">Headline</span>
                            <input
                              autoFocus
                              value={buf.headline}
                              onChange={(e) => setEditBuffers((p) => ({ ...p, [i]: { ...buf, headline: e.target.value } }))}
                              className="mt-1 w-full bg-[#01040A] border border-white/10 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-[#FF3838]"
                            />
                          </label>
                          <label className="block">
                            <span className="text-gray-400">Subheadline</span>
                            <input
                              value={buf.subheadline}
                              onChange={(e) => setEditBuffers((p) => ({ ...p, [i]: { ...buf, subheadline: e.target.value } }))}
                              className="mt-1 w-full bg-[#01040A] border border-white/10 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-[#FF3838]"
                            />
                          </label>
                          <label className="block">
                            <span className="text-gray-400">Angle</span>
                            <input
                              value={buf.angle}
                              onChange={(e) => setEditBuffers((p) => ({ ...p, [i]: { ...buf, angle: e.target.value } }))}
                              className="mt-1 w-full bg-[#01040A] border border-white/10 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-[#FF3838]"
                            />
                          </label>
                          <label className="block">
                            <span className="text-gray-400">Visual description</span>
                            <textarea
                              rows={4}
                              value={buf.visualDescription}
                              onChange={(e) => setEditBuffers((p) => ({ ...p, [i]: { ...buf, visualDescription: e.target.value } }))}
                              className="mt-1 w-full bg-[#01040A] border border-white/10 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-[#FF3838] resize-none"
                            />
                            <span className={`block mt-1 font-mono tabular-nums ${visualColor}`} aria-live="polite">
                              {visualLen} / {VISUAL_DESCRIPTION_MAX}
                            </span>
                          </label>
                          <label className="block">
                            <span className="text-gray-400">Background note</span>
                            <textarea
                              rows={2}
                              value={buf.backgroundNote}
                              onChange={(e) => setEditBuffers((p) => ({ ...p, [i]: { ...buf, backgroundNote: e.target.value } }))}
                              className="mt-1 w-full bg-[#01040A] border border-white/10 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-[#FF3838] resize-none"
                            />
                          </label>
                          <label className="block">
                            <span className="text-gray-400">Benefits (comma-separated)</span>
                            <input
                              value={buf.benefitCallouts.join(", ")}
                              onChange={(e) =>
                                setEditBuffers((p) => ({
                                  ...p,
                                  [i]: { ...buf, benefitCallouts: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) },
                                }))
                              }
                              className="mt-1 w-full bg-[#01040A] border border-white/10 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-[#FF3838]"
                            />
                          </label>
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() => saveEdit(i)}
                              disabled={savingIndex === i || visualLen > VISUAL_DESCRIPTION_MAX}
                              className="flex items-center gap-1.5 bg-[#FF3838] hover:bg-[#FF3838]/90 text-white px-3 py-1.5 rounded text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {savingIndex === i ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                              Save
                            </button>
                            <button
                              onClick={() => cancelEdit(i)}
                              disabled={savingIndex === i}
                              className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-gray-300 px-3 py-1.5 rounded text-xs font-medium"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
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
              {hasUnsavedEdits && (
                <div className="mb-3 flex items-center gap-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Save or cancel {editingIndices.length} unsaved edit{editingIndices.length === 1 ? "" : "s"} before approving.
                </div>
              )}
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
                  disabled={approveBrief.isPending || hasUnsavedEdits}
                  title={hasUnsavedEdits ? "Save or discard unsaved edits first" : undefined}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {approveBrief.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsUp className="w-4 h-4" />}
                  Approve & Generate
                </button>
                <button
                  onClick={() => approveBrief.mutate({ runId: run.id, approved: false, notes: approvalNotes || "Changes requested" })}
                  disabled={approveBrief.isPending}
                  className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-gray-300 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {approveBrief.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsDown className="w-4 h-4" />}
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
            Generated with {run.imageModel === 'nano_banana_2' ? 'Nano Banana 2' : 'Nano Banana Pro'} image generation
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
                      <span className="text-gray-400 text-xs">Regenerating variation...</span>
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
                          <>
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
                            
                            {/* Download Buttons */}
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  try {
                                    const a = document.createElement('a');
                                    a.href = `/api/download-image?url=${encodeURIComponent(v.url)}&filename=variation-${i + 1}.png`;
                                    a.download = `variation-${i + 1}.png`;
                                    document.body.appendChild(a);
                                    a.click();
                                    document.body.removeChild(a);
                                    toast.success("PNG downloading...");
                                  } catch (err: any) {
                                    toast.error(`Download failed: ${err.message}`);
                                  }
                                }}
                                className="flex-1 flex items-center justify-center gap-1.5 bg-white/5 hover:bg-white/10 text-white px-3 py-2 rounded-lg text-xs font-medium"
                              >
                                <Download className="w-3.5 h-3.5" />
                                PNG
                              </button>

                            </div>
                            
                            {/* Canva Upload Button */}
                            {canvaStatus?.connected && (
                              <div className="border-t border-white/5 pt-2">
                                {canvaDesignUrls[i] ? (
                                  <a
                                    href={canvaDesignUrls[i]}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-2 w-full bg-[#7D2AE7] hover:bg-[#6B23C7] text-white px-3 py-2 rounded-lg text-xs font-medium"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    Edit in Canva
                                  </a>
                                ) : uploadingToCanva === i ? (
                                  <button
                                    disabled
                                    className="flex items-center justify-center gap-2 w-full bg-[#7D2AE7]/50 text-white px-3 py-2 rounded-lg text-xs font-medium"
                                  >
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    Uploading...
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => {
                                      const aspectRatio = run.aspectRatio || "1:1";
                                      const [w, h] = aspectRatio.split(":").map(Number);
                                      const width = w === 1 && h === 1 ? 2048 : w === 4 && h === 5 ? 2048 : w === 9 && h === 16 ? 2304 : 4096;
                                      const height = w === 1 && h === 1 ? 2048 : w === 4 && h === 5 ? 2560 : w === 9 && h === 16 ? 4096 : 2304;
                                      handleUploadToCanva(i, v.url, briefVariation?.headline || `Variation ${i + 1}`, width, height);
                                    }}
                                    className="flex items-center justify-center gap-2 w-full bg-[#7D2AE7]/10 hover:bg-[#7D2AE7]/20 border border-[#7D2AE7]/30 text-[#7D2AE7] px-3 py-2 rounded-lg text-xs font-medium"
                                  >
                                    <Upload className="w-3.5 h-3.5" />
                                    Upload to Canva
                                  </button>
                                )}
                              </div>
                            )}
                          </>
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
                              placeholder="Headline (leave blank to keep current)"
                              value={regenOverrides.headline || ""}
                              onChange={(e) => setRegenOverrides(prev => ({ ...prev, headline: e.target.value }))}
                              className="w-full bg-[#191B1F] border border-white/10 rounded px-2 py-1.5 text-xs text-gray-300 placeholder-gray-600"
                            />
                            <input
                              type="text"
                              placeholder="Subheadline (leave blank to keep current)"
                              value={regenOverrides.subheadline || ""}
                              onChange={(e) => setRegenOverrides(prev => ({ ...prev, subheadline: e.target.value }))}
                              className="w-full bg-[#191B1F] border border-white/10 rounded px-2 py-1.5 text-xs text-gray-300 placeholder-gray-600"
                            />
                            <textarea
                              placeholder="Describe the scene — anything you want to change (background, mood, props, characters, composition, lighting...)"
                              value={regenOverrides.customDescription || ""}
                              onChange={(e) => setRegenOverrides(prev => ({ ...prev, customDescription: e.target.value }))}
                              className="w-full bg-[#191B1F] border border-white/10 rounded px-2 py-1.5 text-xs text-gray-300 placeholder-gray-600 resize-none"
                              rows={3}
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Style Fidelity</label>
                                <select
                                  value={regenOverrides.styleMode || ""}
                                  onChange={(e) => setRegenOverrides(prev => ({ ...prev, styleMode: (e.target.value || undefined) as StyleMode | undefined }))}
                                  className="w-full bg-[#191B1F] border border-white/10 rounded px-2 py-1.5 text-xs text-gray-300"
                                >
                                  <option value="">Run default ({run.styleMode || "EVOLVE_REFERENCE"})</option>
                                  <option value="MATCH_REFERENCE">Match reference</option>
                                  <option value="EVOLVE_REFERENCE">Evolve reference</option>
                                  <option value="DEPART_FROM_REFERENCE">Depart from reference</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Ad Angle</label>
                                <select
                                  value={regenOverrides.adAngle || ""}
                                  onChange={(e) => setRegenOverrides(prev => ({ ...prev, adAngle: (e.target.value || undefined) as AdAngle | undefined }))}
                                  className="w-full bg-[#191B1F] border border-white/10 rounded px-2 py-1.5 text-xs text-gray-300"
                                >
                                  <option value="">Keep current</option>
                                  <option value="auto">Auto</option>
                                  <option value="claim_led">Claim-led</option>
                                  <option value="before_after">Before / after</option>
                                  <option value="testimonial">Testimonial</option>
                                  <option value="ugc_organic">UGC organic</option>
                                  <option value="product_hero">Product hero</option>
                                  <option value="lifestyle">Lifestyle</option>
                                </select>
                              </div>
                            </div>
                            {/* Reference image upload */}
                            {regenOverrides.referenceImageUrl ? (
                              <div className="flex items-center gap-2 bg-[#191B1F] border border-white/10 rounded px-2 py-1.5">
                                <img src={regenOverrides.referenceImageUrl} alt="ref" className="w-8 h-8 rounded object-cover" />
                                <span className="text-gray-400 text-xs flex-1">Reference image uploaded</span>
                                <button onClick={() => setRegenOverrides(prev => ({ ...prev, referenceImageUrl: undefined }))} className="text-gray-500 hover:text-white">
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <label className="flex items-center gap-2 bg-[#191B1F] border border-dashed border-white/10 rounded px-2 py-2 cursor-pointer hover:border-white/20 transition-colors">
                                {regenUploading ? (
                                  <Loader2 className="w-3.5 h-3.5 text-gray-500 animate-spin" />
                                ) : (
                                  <Upload className="w-3.5 h-3.5 text-gray-500" />
                                )}
                                <span className="text-gray-500 text-xs">{regenUploading ? "Uploading..." : "Upload reference image (optional)"}</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleRegenFileUpload(file);
                                  }}
                                />
                              </label>
                            )}
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

          {/* Child Generation Section - Show after variations are complete */}
          {(iterationStage === "completed" || iterationStage === "stage_4_clickup_complete") && run.variationLayer === "parent" && (
            <div className="mt-6 border-t border-white/10 pt-4">
              <h3 className="text-white font-medium mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#FF3838]" />
                Generate Child Variations
              </h3>
              <p className="text-gray-400 text-xs mb-4">
                Create 5-10 tactical variations of this parent (color shifts, lighting changes, typography tweaks, etc.) to expand your creative library.
              </p>
              <ChildGenerationControls parentRunId={run.id} />
            </div>
          )}

          {/* Variation Approval Gate */}
          {iterationStage === "stage_3b_variation_approval" && (
            <div className="mt-6 border-t border-white/10 pt-4">
              <h3 className="text-white font-medium mb-2">What would you like to do with these variations?</h3>
              <p className="text-gray-400 text-xs mb-4">
                You can regenerate individual variations above if any need changes.
              </p>
              <textarea
                value={variationApprovalNotes}
                onChange={(e) => setVariationApprovalNotes(e.target.value)}
                placeholder="Optional notes..."
                className="w-full bg-[#01040A] border border-white/10 rounded-lg p-3 text-sm text-gray-300 placeholder-gray-600 mb-4 resize-none"
                rows={2}
              />
              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={() => skipClickUp.mutate({ runId: run.id, approved: false, notes: variationApprovalNotes || "Completed without ClickUp" })}
                  disabled={skipClickUp.isPending || regenerateVariation.isPending}
                  className="flex items-center gap-2 bg-[#FF3838] hover:bg-[#FF3838]/80 text-white px-5 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {skipClickUp.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Complete
                </button>
                <button
                  onClick={() => approveVariations.mutate({ runId: run.id, approved: true, notes: variationApprovalNotes || undefined })}
                  disabled={approveVariations.isPending || regenerateVariation.isPending}
                  className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-gray-300 px-4 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 border border-white/10"
                >
                  {approveVariations.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Push to ClickUp
                </button>
              </div>
              <p className="text-gray-600 text-[10px] mt-2">
                Complete saves your variations. Push to ClickUp also creates tasks for your design team.
              </p>
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
              Generating variations with Nano Banana Pro. This may take 2–4 minutes per image...
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
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                <CheckCircle className="w-4 h-4" />
                Iteration pipeline completed
              </div>
              <p className="text-emerald-300/60 text-xs mt-1">
                {variations.length} variations generated with {run.imageModel === 'nano_banana_2' ? 'Nano Banana 2' : 'Nano Banana Pro'}
                {clickupTasks.filter(t => t.taskId).length > 0 && ` · ${clickupTasks.filter(t => t.taskId).length} ClickUp tasks created`}
                {clickupTasks.length === 0 && " · Completed without ClickUp push"}
              </p>
            </div>
            {clickupTasks.length === 0 && (
              <button
                onClick={() => {
                  setPushingToClickUp(true);
                  pushToClickUp.mutate({ runId: run.id });
                }}
                disabled={pushingToClickUp}
                className="flex items-center gap-2 bg-[#FF3838] hover:bg-[#FF3838]/90 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {pushingToClickUp ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Pushing...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Push to ClickUp
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
