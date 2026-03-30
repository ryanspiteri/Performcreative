import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  PenTool, Loader2, CheckCircle, Circle, AlertCircle,
  Copy, ChevronDown, ChevronUp, Sparkles, Play,
} from "lucide-react";

const PRODUCTS = [
  "Hyperburn", "Thermosleep", "Hyperload", "Thermoburn", "Carb Control",
  "Protein + Collagen", "Creatine", "HyperPump", "AminoLoad",
  "Marine Collagen", "SuperGreens", "Whey ISO Pro",
];

const PIPELINE_STAGES = [
  { key: "stage_1_context", label: "Building Context" },
  { key: "stage_2_generation", label: "Generating Scripts" },
  { key: "stage_3_review", label: "Expert Review" },
  { key: "stage_4_complete", label: "Complete" },
];

const STYLE_TO_CATEGORY: Record<string, string> = {
  DR: "DR",
  UGC: "UGC",
  FOUNDER: "Founder-Led",
  BRAND: "Brand / Equity",
  EDUCATION: "DR",
  LIFESTYLE: "UGC",
  DEMO: "DR",
};

export default function ScriptGenerator() {
  const [product, setProduct] = useState("");
  const [scriptStyle, setScriptStyle] = useState("");
  const [subStructureId, setSubStructureId] = useState("");
  const [funnelStage, setFunnelStage] = useState("");
  const [archetype, setArchetype] = useState("");
  const [concept, setConcept] = useState("");
  const [scriptCount, setScriptCount] = useState("3");
  const [runId, setRunId] = useState<number | null>(null);
  const [expandedScripts, setExpandedScripts] = useState<Set<number>>(new Set());

  const optionsQuery = trpc.scriptGenerator.options.useQuery();

  const runQuery = trpc.scriptGenerator.get.useQuery(
    { id: runId! },
    {
      enabled: !!runId,
      refetchInterval: (query: any) => {
        const status = query.state.data?.status;
        return status === "completed" || status === "failed" ? false : 2000;
      },
    }
  );

  const createMutation = trpc.scriptGenerator.create.useMutation({
    onSuccess: (data: { runId: number }) => {
      setRunId(data.runId);
      toast.success("Script pipeline started");
    },
    onError: (err: any) => {
      toast.error(`Failed: ${err.message}`);
    },
  });

  const pushToClickUp = trpc.scriptGenerator.pushToClickUp.useMutation({
    onSuccess: () => toast.success("Scripts pushed to ClickUp"),
    onError: (err: any) => toast.error(`ClickUp push failed: ${err.message}`),
  });

  const run = runQuery.data;
  const isRunning = run?.status === "running" || run?.status === "pending";
  const isCompleted = run?.status === "completed";
  const isFailed = run?.status === "failed";
  const currentStage = run?.scriptStage || "";
  const scripts = (run?.scriptsJson as any[]) || [];

  // Filter sub-structures by selected style
  const filteredSubStructures = useMemo(() => {
    if (!optionsQuery.data?.subStructures || !scriptStyle) return [];
    const category = STYLE_TO_CATEGORY[scriptStyle];
    if (!category) return optionsQuery.data.subStructures;
    return optionsQuery.data.subStructures.filter(s => s.category === category);
  }, [optionsQuery.data?.subStructures, scriptStyle]);

  // Reset sub-structure when style changes
  const handleStyleChange = (value: string) => {
    setScriptStyle(value);
    setSubStructureId("");
  };

  const canGenerate =
    product && scriptStyle && subStructureId && funnelStage && archetype && concept.length >= 10;

  const handleGenerate = () => {
    if (!canGenerate) return;
    createMutation.mutate({
      product,
      scriptStyle,
      subStructureId,
      funnelStage: funnelStage as "cold" | "warm" | "retargeting" | "retention",
      archetype,
      concept,
      scriptCount: parseInt(scriptCount, 10),
    });
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const toggleScript = (index: number) => {
    setExpandedScripts(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const getStageStatus = (stageKey: string) => {
    if (!run || run.status === "pending") return "pending";
    if (run.status === "failed") {
      const stageIndex = PIPELINE_STAGES.findIndex(s => s.key === stageKey);
      const currentIndex = PIPELINE_STAGES.findIndex(s => s.key === currentStage);
      return stageIndex <= currentIndex ? "failed" : "pending";
    }
    if (run.status === "completed") return "done";
    const stageIndex = PIPELINE_STAGES.findIndex(s => s.key === stageKey);
    const currentIndex = PIPELINE_STAGES.findIndex(s => s.key === currentStage);
    if (stageIndex < currentIndex) return "done";
    if (stageIndex === currentIndex) return "running";
    return "pending";
  };

  const formatScriptForCopy = (script: any) => {
    let text = `TITLE: ${script.title}\n\nHOOK: ${script.hook}\n\n`;
    if (script.script) {
      text += "SCRIPT:\n";
      for (const seg of script.script) {
        text += `[${seg.timestamp}]\n`;
        text += `Visual: ${seg.visual}\n`;
        text += `Dialogue: ${seg.dialogue}\n`;
        if (seg.transitionLine) text += `Transition: ${seg.transitionLine}\n`;
        text += "\n";
      }
    }
    if (script.visualDirection) text += `VISUAL DIRECTION: ${script.visualDirection}\n\n`;
    if (script.strategicThesis) text += `STRATEGIC THESIS: ${script.strategicThesis}\n`;
    return text;
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Script Generator</h1>
        <p className="text-gray-500 text-sm mt-1">
          Create ad scripts from scratch — no reference video needed
        </p>
      </div>

      <div className="flex gap-6">
        {/* ── Left Panel: Form ── */}
        <div className="w-[400px] shrink-0 space-y-5">
          <div className="bg-[#0D0F12] rounded-xl border border-white/5 p-5 space-y-5">
            {/* 1. Product */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-5 h-5 rounded-full bg-[#FF3838]/20 border border-[#FF3838]/30 flex items-center justify-center text-[10px] font-bold text-[#FF3838]">1</span>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Product</label>
              </div>
              <Select value={product} onValueChange={setProduct} disabled={isRunning}>
                <SelectTrigger className="bg-[#01040A] border-white/10 text-white rounded-xl h-11">
                  <SelectValue placeholder="Select a product..." />
                </SelectTrigger>
                <SelectContent className="bg-[#0D0F14] border-white/10">
                  {PRODUCTS.map(p => (
                    <SelectItem key={p} value={p} className="text-white hover:bg-white/5">{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 2. Script Style */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-5 h-5 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-[10px] font-bold text-blue-400">2</span>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Script Style</label>
              </div>
              <Select value={scriptStyle} onValueChange={handleStyleChange} disabled={isRunning}>
                <SelectTrigger className="bg-[#01040A] border-white/10 text-white rounded-xl h-11">
                  <SelectValue placeholder="Select script style..." />
                </SelectTrigger>
                <SelectContent className="bg-[#0D0F14] border-white/10">
                  {optionsQuery.data?.styles.map(s => (
                    <SelectItem key={s.id} value={s.id} className="text-white hover:bg-white/5">
                      <span>{s.label}</span>
                      <span className="text-gray-500 text-xs ml-2">— {s.description}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 3. Sub-Structure */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-5 h-5 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-[10px] font-bold text-purple-400">3</span>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Structure</label>
              </div>
              <Select value={subStructureId} onValueChange={setSubStructureId} disabled={isRunning || !scriptStyle}>
                <SelectTrigger className="bg-[#01040A] border-white/10 text-white rounded-xl h-11">
                  <SelectValue placeholder={scriptStyle ? "Select structure..." : "Select a style first"} />
                </SelectTrigger>
                <SelectContent className="bg-[#0D0F14] border-white/10">
                  {filteredSubStructures.map(s => (
                    <SelectItem key={s.id} value={s.id} className="text-white hover:bg-white/5">
                      <span className="font-mono text-xs text-gray-500 mr-2">{s.id}</span>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {subStructureId && filteredSubStructures.find(s => s.id === subStructureId)?.whyItConverts && (
                <p className="text-[11px] text-gray-600 mt-1.5 pl-1">
                  {filteredSubStructures.find(s => s.id === subStructureId)?.whyItConverts}
                </p>
              )}
            </div>

            {/* 4. Funnel Stage */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-5 h-5 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center text-[10px] font-bold text-green-400">4</span>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Funnel Stage</label>
              </div>
              <Select value={funnelStage} onValueChange={setFunnelStage} disabled={isRunning}>
                <SelectTrigger className="bg-[#01040A] border-white/10 text-white rounded-xl h-11">
                  <SelectValue placeholder="Select funnel stage..." />
                </SelectTrigger>
                <SelectContent className="bg-[#0D0F14] border-white/10">
                  <SelectItem value="cold" className="text-white hover:bg-white/5">Cold — Problem-led, no product in hook</SelectItem>
                  <SelectItem value="warm" className="text-white hover:bg-white/5">Warm — Differentiation-led</SelectItem>
                  <SelectItem value="retargeting" className="text-white hover:bg-white/5">Retargeting — Social proof + urgency</SelectItem>
                  <SelectItem value="retention" className="text-white hover:bg-white/5">Retention — Loyalty + stack-sell</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 5. Audience */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-5 h-5 rounded-full bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center text-[10px] font-bold text-yellow-400">5</span>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Audience</label>
              </div>
              <Select value={archetype} onValueChange={setArchetype} disabled={isRunning}>
                <SelectTrigger className="bg-[#01040A] border-white/10 text-white rounded-xl h-11">
                  <SelectValue placeholder="Select audience archetype..." />
                </SelectTrigger>
                <SelectContent className="bg-[#0D0F14] border-white/10">
                  {optionsQuery.data?.archetypes.map(a => (
                    <SelectItem key={a.id} value={a.id} className="text-white hover:bg-white/5">
                      <span>{a.label}</span>
                      <span className="text-gray-500 text-xs ml-2">— {a.lifeContext.slice(0, 50)}...</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 6. Concept */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-5 h-5 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-[10px] font-bold text-orange-400">6</span>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Concept</label>
              </div>
              <Textarea
                value={concept}
                onChange={e => setConcept(e.target.value)}
                placeholder="Describe your angle, creative direction, or concept... e.g. 'A busy mum who was skeptical about fat burners discovers Hyperburn actually works because of the transparent ingredient list'"
                className="bg-[#01040A] border-white/10 text-white placeholder:text-gray-600 rounded-xl min-h-[100px] resize-none"
                disabled={isRunning}
              />
              <p className="text-[11px] text-gray-600 mt-1 pl-1">
                {concept.length < 10 ? `${10 - concept.length} more characters needed` : `${concept.length} characters`}
              </p>
            </div>

            {/* 7. Script Count */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-5 h-5 rounded-full bg-gray-500/20 border border-gray-500/30 flex items-center justify-center text-[10px] font-bold text-gray-400">7</span>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Number of Scripts</label>
              </div>
              <Select value={scriptCount} onValueChange={setScriptCount} disabled={isRunning}>
                <SelectTrigger className="bg-[#01040A] border-white/10 text-white rounded-xl h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0D0F14] border-white/10">
                  {[1, 2, 3, 4, 5].map(n => (
                    <SelectItem key={n} value={String(n)} className="text-white hover:bg-white/5">
                      {n} script{n > 1 ? "s" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Generate Button */}
            <Button
              onClick={handleGenerate}
              disabled={!canGenerate || createMutation.isPending || isRunning}
              className="w-full h-12 bg-[#FF3838] hover:bg-[#FF3838]/90 text-white font-semibold rounded-xl"
            >
              {createMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" />Starting...</>
              ) : isRunning ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" />Pipeline Running...</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" />Generate Scripts</>
              )}
            </Button>
          </div>
        </div>

        {/* ── Right Panel: Pipeline Progress + Results ── */}
        <div className="flex-1 min-w-0">
          {!runId ? (
            // Empty state
            <div className="bg-[#0D0F12] rounded-xl border border-white/5 h-full min-h-[500px] flex items-center justify-center">
              <div className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                  <PenTool className="w-6 h-6 text-gray-600" />
                </div>
                <p className="text-gray-500 text-sm">Configure your script and hit generate</p>
                <p className="text-gray-600 text-xs mt-1">Scripts will appear here</p>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Pipeline Stepper */}
              <div className="bg-[#0D0F12] rounded-xl border border-white/5 p-5">
                <div className="space-y-2">
                  {PIPELINE_STAGES.map((stage) => {
                    const status = getStageStatus(stage.key);
                    return (
                      <div
                        key={stage.key}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
                          status === "running" ? "bg-white/5" : ""
                        }`}
                      >
                        {status === "done" ? (
                          <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                        ) : status === "running" ? (
                          <Loader2 className="w-4 h-4 text-[#FF3838] animate-spin shrink-0" />
                        ) : status === "failed" ? (
                          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                        ) : (
                          <Circle className="w-4 h-4 text-gray-600 shrink-0" />
                        )}
                        <span className={`text-sm ${
                          status === "done" ? "text-green-400"
                          : status === "running" ? "text-white"
                          : status === "failed" ? "text-red-400"
                          : "text-gray-600"
                        }`}>
                          {stage.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Error state */}
              {isFailed && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-5">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-red-300 font-medium text-sm">Pipeline Failed</p>
                      <p className="text-red-400/70 text-xs mt-1">{run?.errorMessage || "Unknown error"}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Script Results */}
              {scripts.length > 0 && (
                <div className="space-y-4">
                  {scripts.map((script: any, i: number) => {
                    const expanded = expandedScripts.has(i);
                    const score = script.review?.finalScore;
                    const approved = script.review?.approved;
                    return (
                      <div key={i} className="bg-[#0D0F12] rounded-xl border border-white/5 overflow-hidden">
                        {/* Script Header */}
                        <button
                          onClick={() => toggleScript(i)}
                          className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-xs font-mono text-gray-500">#{i + 1}</span>
                            <span className="text-sm text-white font-medium truncate">{script.title}</span>
                            {score != null && (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                approved ? "bg-green-500/20 text-green-400 border border-green-500/30"
                                : score >= 80 ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                                : "bg-red-500/20 text-red-400 border border-red-500/30"
                              }`}>
                                {score}/100
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => { e.stopPropagation(); handleCopy(formatScriptForCopy(script), "Script"); }}
                              className="text-gray-400 hover:text-white h-8 w-8 p-0"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </Button>
                            {expanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                          </div>
                        </button>

                        {/* Expanded Content */}
                        {expanded && (
                          <div className="px-5 pb-5 space-y-4 border-t border-white/5 pt-4">
                            {/* Hook */}
                            <div className="bg-[#FF3838]/5 border border-[#FF3838]/20 rounded-lg p-3">
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#FF3838]/60 mb-1">Hook</p>
                              <p className="text-white text-sm font-medium">{script.hook}</p>
                            </div>

                            {/* Script Table */}
                            {script.script && (
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b border-white/10">
                                      <th className="text-left py-2 px-2 text-gray-500 font-medium w-20">Time</th>
                                      <th className="text-left py-2 px-2 text-gray-500 font-medium w-1/3">Visual</th>
                                      <th className="text-left py-2 px-2 text-gray-500 font-medium">Dialogue</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {script.script.map((seg: any, j: number) => (
                                      <tr key={j} className="border-b border-white/5">
                                        <td className="py-2 px-2 text-gray-500 font-mono align-top">{seg.timestamp}</td>
                                        <td className="py-2 px-2 text-gray-400 align-top">{seg.visual}</td>
                                        <td className="py-2 px-2 text-white align-top">
                                          {seg.dialogue}{seg.transitionLine ? ` ${seg.transitionLine}` : ""}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}

                            {/* Visual Direction */}
                            {script.visualDirection && (
                              <div className="bg-white/5 rounded-lg p-3">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Visual Direction</p>
                                <p className="text-gray-300 text-xs">{script.visualDirection}</p>
                              </div>
                            )}

                            {/* Strategic Thesis */}
                            {script.strategicThesis && (
                              <div className="bg-white/5 rounded-lg p-3">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Strategic Thesis</p>
                                <p className="text-gray-300 text-xs">{script.strategicThesis}</p>
                              </div>
                            )}

                            {/* Review Summary */}
                            {script.review?.summary && (
                              <div className={`rounded-lg p-3 ${
                                script.review.approved
                                  ? "bg-green-500/10 border border-green-500/20"
                                  : "bg-yellow-500/10 border border-yellow-500/20"
                              }`}>
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Review</p>
                                <p className={`text-xs ${script.review.approved ? "text-green-300" : "text-yellow-300"}`}>
                                  {script.review.summary}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* ClickUp Push */}
                  {isCompleted && (
                    <div className="flex justify-end">
                      <Button
                        onClick={() => pushToClickUp.mutate({ runId: runId! })}
                        disabled={pushToClickUp.isPending}
                        variant="outline"
                        className="border-white/10 text-gray-300 hover:text-white hover:bg-white/5"
                      >
                        {pushToClickUp.isPending ? (
                          <><Loader2 className="w-4 h-4 animate-spin mr-2" />Pushing...</>
                        ) : (
                          <><Play className="w-4 h-4 mr-2" />Push to ClickUp</>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
