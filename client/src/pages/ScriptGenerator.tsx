import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  PenTool, Loader2, CheckCircle, Circle, AlertCircle,
  Copy, ChevronDown, ChevronUp, Sparkles, Play, X, Save, TrendingUp,
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
  FOUNDER: "FOUNDER",
  BRAND: "BRAND",
  EDUCATION: "DR",
  LIFESTYLE: "UGC",
  DEMO: "DR",
};

// Wave 1 preset mappings — translate tag engine vocab → form presets.
// Used when "Apply winning patterns" is clicked (or auto-applied in winner mode).
const HOOK_TACTIC_TO_STRUCTURE: Record<string, { scriptStyle: string; subStructureId: string }> = {
  before_after:     { scriptStyle: "DR",      subStructureId: "DR-2" }, // Before→After→Bridge
  question:         { scriptStyle: "DR",      subStructureId: "DR-5" }, // Contrarian
  bold_claim:       { scriptStyle: "UGC",     subStructureId: "UGC-4" }, // Myth Bust / Hot Take
  ugc_testimonial:  { scriptStyle: "UGC",     subStructureId: "UGC-1" }, // Talking Head Review
  product_demo:     { scriptStyle: "DEMO",    subStructureId: "UGC-6" }, // Product Demo / Ingredient Ed
  storytelling:     { scriptStyle: "DR",      subStructureId: "DR-7" }, // Story → Lesson → Product
  controversy:      { scriptStyle: "DR",      subStructureId: "DR-4" }, // Enemy Framing
  listicle:         { scriptStyle: "EDUCATION", subStructureId: "UGC-6" }, // Education / Ingredient
};

const MESSAGING_ANGLE_TO_STYLE: Record<string, string> = {
  transformation:      "DR",
  social_proof:        "UGC",
  ingredient_science:  "DEMO",
  urgency:             "DR",
  lifestyle:           "LIFESTYLE",
  problem_agitate:     "DR",
  authority:           "FOUNDER",
  emotional_appeal:    "UGC",
};

// ─── Inline editable text component ─────────────────────────────────────────

function EditableText({
  value,
  onChange,
  label,
  multiline = false,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  multiline?: boolean;
  className?: string;
}) {
  const base =
    "w-full bg-transparent border border-transparent hover:border-white/10 focus:border-white/10 focus:bg-[#01040A] rounded-md px-2 py-1.5 text-inherit outline-none transition-colors min-h-[44px]";
  if (multiline) {
    return (
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        aria-label={label}
        rows={3}
        className={`${base} resize-none ${className}`}
      />
    );
  }
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      aria-label={label}
      className={`${base} ${className}`}
    />
  );
}

// ─── Page component ──────────────────────────────────────────────────────────

export default function ScriptGenerator() {
  const [product, setProduct] = useState("");
  const [scriptStyle, setScriptStyle] = useState("");
  const [customScriptStyle, setCustomScriptStyle] = useState("");
  const [subStructureId, setSubStructureId] = useState("");
  const [funnelStage, setFunnelStage] = useState("");
  const [archetype, setArchetype] = useState("");
  const [angle, setAngle] = useState("");
  const [customAngle, setCustomAngle] = useState("");
  const [concept, setConcept] = useState("");
  const [scriptCount, setScriptCount] = useState("3");
  const [runId, setRunId] = useState<number | null>(() => {
    // Hydrate from ?runId= query param so deep links from the dashboard/results page work
    if (typeof window === "undefined") return null;
    const raw = new URLSearchParams(window.location.search).get("runId");
    const parsed = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(parsed) ? parsed : null;
  });
  const [expandedScripts, setExpandedScripts] = useState<Set<number>>(new Set());
  const [showVisuals, setShowVisuals] = useState(true);
  const [editedScripts, setEditedScripts] = useState<Record<number, any>>({});
  const [savedScripts, setSavedScripts] = useState<Record<number, any>>({});
  const [editHintDismissed, setEditHintDismissed] = useState(false);

  const optionsQuery = trpc.scriptGenerator.options.useQuery();
  const briefQuery = trpc.scriptGenerator.getIntelligenceBrief.useQuery(
    { product },
    { enabled: !!product, staleTime: 5 * 60 * 1000 }
  );
  const brief = briefQuery.data;

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
      setEditedScripts({});
      setSavedScripts({});
      setEditHintDismissed(false);
      window.history.replaceState({}, "", `/scripts?runId=${data.runId}`);
      toast.success("Script pipeline started");
    },
    onError: (err: any) => toast.error(`Failed: ${err.message}`),
  });

  const saveEditsMutation = trpc.scriptGenerator.saveEdits.useMutation({
    onSuccess: () => {
      setSavedScripts({ ...editedScripts });
      toast.success("Edits saved");
    },
    onError: (err: any) => toast.error(`Save failed: ${err.message}`),
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

  // Initialize edits from run data (reinitializes when switching between runs)
  useEffect(() => {
    if (run && scripts.length > 0) {
      const source = ((run as any).editedScriptsJson ?? run.scriptsJson) as any[];
      if (source) {
        const initial: Record<number, any> = {};
        source.forEach((s: any, i: number) => { initial[i] = { ...s }; });
        setEditedScripts(initial);
        setSavedScripts(initial);
      }
    }
  }, [run?.id]);

  // Hydrate form fields from loaded run (for ?runId= deep links from dashboard)
  useEffect(() => {
    if (!run) return;
    if (run.product) setProduct(run.product);
    if (run.scriptFunnelStage) setFunnelStage(run.scriptFunnelStage);
    if (run.scriptSubStructure) setSubStructureId(run.scriptSubStructure);
    if (run.scriptArchetype) setArchetype(run.scriptArchetype);
    if (run.scriptConcept) setConcept(run.scriptConcept);
    if (run.scriptCount) setScriptCount(String(run.scriptCount));

    const knownStyleIds = ["DR", "UGC", "FOUNDER", "BRAND", "EDUCATION", "LIFESTYLE", "DEMO"];
    if (run.scriptStyle && knownStyleIds.includes(run.scriptStyle)) {
      setScriptStyle(run.scriptStyle);
    } else if (run.scriptStyle) {
      setScriptStyle("__custom__");
      setCustomScriptStyle(run.scriptStyle);
    }

    if (run.scriptAngle) {
      setAngle("__custom__");
      setCustomAngle(run.scriptAngle);
    }
  }, [run?.id]);

  // Hydrate form from winner-mode URL params (Generate from Winner button)
  // Only applies on first mount when there is NO runId — winner mode starts a fresh config.
  const [winnerSource, setWinnerSource] = useState<{ name: string; hook: string; creativeAssetId?: number } | null>(null);
  useEffect(() => {
    if (runId) return; // Don't override runId-hydrated state
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const winnerProduct = params.get("product");
    const winnerHook = params.get("winnerHook");
    const winnerAngle = params.get("winnerAngle");
    const winnerFunnel = params.get("funnelStage");
    const winnerName = params.get("winnerName");
    const winnerCreativeId = params.get("sourceCreativeAssetId");

    if (winnerProduct) setProduct(winnerProduct);
    if (winnerFunnel && ["cold", "warm", "retargeting", "retention"].includes(winnerFunnel)) {
      setFunnelStage(winnerFunnel);
    }
    if (winnerAngle) {
      setAngle("__custom__");
      setCustomAngle(winnerAngle.replace(/_/g, " "));
    }
    if (winnerHook) {
      setConcept(`Inspired by winning ad hook: "${winnerHook}". Build a fresh script that captures the same engagement mechanism but stays distinct from the original.`);
    }
    if (winnerName || winnerHook) {
      const parsedId = winnerCreativeId ? parseInt(winnerCreativeId, 10) : undefined;
      setWinnerSource({
        name: winnerName || "Unknown winner",
        hook: winnerHook || "",
        creativeAssetId: Number.isFinite(parsedId) ? parsedId : undefined,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isCustomStyle = scriptStyle === "__custom__";
  const effectiveAngle = angle === "__custom__" ? customAngle : angle;

  const filteredSubStructures = useMemo(() => {
    if (!optionsQuery.data?.structures || !scriptStyle || isCustomStyle) return [];
    const category = STYLE_TO_CATEGORY[scriptStyle];
    if (!category) return [];
    return optionsQuery.data.structures.filter((s: any) => s.category === category);
  }, [optionsQuery.data?.structures, scriptStyle, isCustomStyle]);

  const productAngles = useMemo(() => {
    return optionsQuery.data?.angles?.[product] || [];
  }, [optionsQuery.data?.angles, product]);

  // Wave 1 presets — apply top winning patterns from the intelligence brief to the form
  const applyWinningPatterns = (opts?: { silent?: boolean }) => {
    if (!brief) return;
    const tactic = brief.topHookTactic?.tactic;
    const angleStr = brief.topMessagingAngle?.angle;

    // Map hook tactic → script style + sub-structure
    if (tactic && HOOK_TACTIC_TO_STRUCTURE[tactic]) {
      const mapped = HOOK_TACTIC_TO_STRUCTURE[tactic];
      setScriptStyle(mapped.scriptStyle);
      setSubStructureId(mapped.subStructureId);
    } else if (angleStr && MESSAGING_ANGLE_TO_STYLE[angleStr]) {
      setScriptStyle(MESSAGING_ANGLE_TO_STYLE[angleStr]);
    }

    // Auto-pick the first sub-structure in the matched category if we don't have one
    // Fall back: leave subStructure empty and user picks

    // Angle: if not already set, use the top messaging angle as a custom angle
    if (!angle && angleStr) {
      setAngle("__custom__");
      setCustomAngle(angleStr.replace(/_/g, " "));
    }

    // Audience: leave user to choose; we don't have a reliable mapping from tags

    if (!opts?.silent) {
      toast.success("Winning patterns applied");
    }
  };

  // Auto-apply patterns once in winner mode (when brief loads)
  const [patternsAutoApplied, setPatternsAutoApplied] = useState(false);
  useEffect(() => {
    if (patternsAutoApplied) return;
    if (!winnerSource || !brief) return;
    // Only auto-apply if the form is still in default state (avoids clobbering manual edits)
    if (scriptStyle || subStructureId) return;
    applyWinningPatterns({ silent: true });
    setPatternsAutoApplied(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brief, winnerSource]);

  const conceptSuggestions = useMemo(() => {
    if (!product || !effectiveAngle || !archetype) return [];
    const audienceLabel = (optionsQuery.data?.audiences as any[])?.find(a => a.id === archetype)?.label || archetype;
    const shortAngle = effectiveAngle.length > 55 ? effectiveAngle.slice(0, 55) + "…" : effectiveAngle;
    return [
      `A sceptical ${audienceLabel.toLowerCase()} discovers ${product} — the moment they realise ${shortAngle.toLowerCase()} changes everything`,
      `Why everything you've been told about ${product.toLowerCase().includes("burn") ? "fat burners" : product.toLowerCase().includes("sleep") ? "sleep supplements" : "supplements"} is wrong — and how ${shortAngle.toLowerCase()} proves it`,
      `A ${audienceLabel.toLowerCase()} documents their first month on ${product}, specifically tracking ${shortAngle.toLowerCase()}`,
    ];
  }, [product, effectiveAngle, archetype, optionsQuery.data?.audiences]);

  const [aiConcepts, setAiConcepts] = useState<Array<{ title: string; narrative: string; whyItConverts: string; suggestedHook: string }>>([]);
  const generateConceptsMutation = trpc.scriptGenerator.generateConcepts.useMutation({
    onSuccess: (data) => setAiConcepts(data.concepts || []),
    onError: (err: any) => toast.error(`Concept generation failed: ${err.message}`),
  });
  const canGenerateConcepts = !!product && !!scriptStyle && !!funnelStage && !!archetype && !!effectiveAngle;

  // Clear AI concepts when upstream inputs change
  useEffect(() => { setAiConcepts([]); }, [product, scriptStyle, subStructureId, funnelStage, archetype, effectiveAngle]);

  const hasUnsavedEdits = useMemo(
    () => JSON.stringify(editedScripts) !== JSON.stringify(savedScripts),
    [editedScripts, savedScripts]
  );

  const handleProductChange = (val: string) => {
    setProduct(val);
    setAngle("");
    setCustomAngle("");
  };

  const handleStyleChange = (val: string) => {
    setScriptStyle(val);
    setSubStructureId("");
  };

  const canGenerate =
    !!product &&
    (isCustomStyle ? customScriptStyle.trim().length > 0 : !!scriptStyle) &&
    (isCustomStyle || !!subStructureId) &&
    !!funnelStage &&
    !!archetype &&
    (angle === "__custom__" ? customAngle.trim().length > 0 : !!angle) &&
    concept.length >= 10;

  const handleGenerate = () => {
    if (!canGenerate) return;
    createMutation.mutate({
      product,
      scriptStyle: isCustomStyle ? customScriptStyle.trim() : scriptStyle,
      subStructureId: isCustomStyle ? undefined : subStructureId,
      funnelStage: funnelStage as "cold" | "warm" | "retargeting" | "retention",
      archetype,
      angle: effectiveAngle,
      concept,
      scriptCount: parseInt(scriptCount, 10),
      ...(winnerSource ? {
        creativeSource: "ai-winner" as const,
        sourceCreativeAssetId: winnerSource.creativeAssetId,
      } : {}),
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
        if (showVisuals) text += `Visual: ${seg.visual}\n`;
        text += `Dialogue: ${seg.dialogue}\n`;
        if (seg.transitionLine) text += `Transition: ${seg.transitionLine}\n`;
        text += "\n";
      }
    }
    if (showVisuals && script.visualDirection) text += `VISUAL DIRECTION: ${script.visualDirection}\n\n`;
    if (script.strategicThesis) text += `STRATEGIC THESIS: ${script.strategicThesis}\n`;
    return text;
  };

  const updateEditedScript = (scriptIndex: number, path: string[], value: string) => {
    setEditedScripts(prev => {
      const script = { ...(prev[scriptIndex] || scripts[scriptIndex] || {}) };
      if (path.length === 1) {
        script[path[0]] = value;
      } else if (path.length === 3 && path[0] === "script") {
        const segIndex = parseInt(path[1], 10);
        const segs = [...(script.script || [])];
        segs[segIndex] = { ...segs[segIndex], [path[2]]: value };
        script.script = segs;
      }
      return { ...prev, [scriptIndex]: script };
    });
  };

  const getEditedScript = (index: number) => editedScripts[index] || scripts[index] || {};

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Script Generator</h1>
        <p className="text-gray-500 text-sm mt-1">
          Create ad scripts from scratch — no reference video needed
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">

        {/* ── Left Panel: Form ── */}
        <div className="w-full md:w-[400px] shrink-0">
          <div className="bg-[#0D0F12] rounded-xl border border-white/5 p-5 space-y-5 overflow-y-auto max-h-[calc(100vh-140px)]">

            {/* Winner source banner */}
            {winnerSource && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-emerald-400 uppercase tracking-wider">Generating from Winner</p>
                  <p className="text-xs text-gray-300 mt-1 truncate" title={winnerSource.name}>{winnerSource.name}</p>
                  {winnerSource.hook && (
                    <p className="text-[11px] text-gray-400 mt-1 italic line-clamp-2">"{winnerSource.hook}"</p>
                  )}
                </div>
                <button
                  onClick={() => {
                    setWinnerSource(null);
                    window.history.replaceState({}, "", "/scripts");
                  }}
                  className="text-gray-500 hover:text-white"
                  aria-label="Dismiss"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* 1. Product */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-5 h-5 rounded-full bg-[#FF3838]/20 border border-[#FF3838]/30 flex items-center justify-center text-[10px] font-bold text-[#FF3838]">1</span>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Product</label>
              </div>
              <Select value={product} onValueChange={handleProductChange} disabled={isRunning}>
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

            {/* Intelligence Brief */}
            {brief && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-xs font-medium text-emerald-400 uppercase tracking-wider">Performance Intelligence</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => applyWinningPatterns()}
                    className="text-[10px] uppercase tracking-wider font-medium text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 px-2 py-1 rounded-md transition-colors"
                    disabled={isRunning}
                  >
                    Apply patterns
                  </button>
                </div>
                <p className="text-xs text-gray-400">
                  Based on {brief.creativeCount} creatives{brief.totalSpendCents > 0 ? ` and $${(brief.totalSpendCents / 100).toLocaleString()} spend` : ""} over 90 days:
                </p>
                <div className="space-y-1">
                  {brief.topHookTactic && (
                    <p className="text-xs text-gray-300">
                      <span className="text-emerald-400">Top hook tactic:</span> {brief.topHookTactic.tactic.replace(/_/g, " ")} (avg score {brief.topHookTactic.avgScore})
                    </p>
                  )}
                  {brief.topMessagingAngle && (
                    <p className="text-xs text-gray-300">
                      <span className="text-emerald-400">Top angle:</span> {brief.topMessagingAngle.angle.replace(/_/g, " ")} (avg score {brief.topMessagingAngle.avgScore})
                    </p>
                  )}
                  {brief.topHooks.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-white/5">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Top performing hooks</p>
                      {brief.topHooks.slice(0, 3).map((h, i) => (
                        <p key={i} className="text-xs text-gray-400 truncate" title={h.hookText}>
                          <span className="text-emerald-400/70">{h.hookScore}</span> — "{h.hookText.slice(0, 80)}{h.hookText.length > 80 ? "..." : ""}"
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

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
                  <SelectItem value="__custom__" className="text-white hover:bg-white/5">
                    <span className="text-gray-400">Custom…</span>
                  </SelectItem>
                </SelectContent>
              </Select>
              {isCustomStyle && (
                <Input
                  value={customScriptStyle}
                  onChange={e => setCustomScriptStyle(e.target.value)}
                  placeholder="Describe your custom style..."
                  className="mt-2 bg-[#01040A] border-white/10 text-white placeholder:text-gray-600 rounded-xl h-10"
                  disabled={isRunning}
                />
              )}
            </div>

            {/* 3. Structure */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-5 h-5 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-[10px] font-bold text-purple-400">3</span>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Structure</label>
              </div>
              <Select
                value={subStructureId}
                onValueChange={setSubStructureId}
                disabled={isRunning || !scriptStyle || isCustomStyle}
              >
                <SelectTrigger className="bg-[#01040A] border-white/10 text-white rounded-xl h-11">
                  <SelectValue placeholder={
                    isCustomStyle ? "Not available for custom style"
                    : scriptStyle ? "Select structure..."
                    : "Select a style first"
                  } />
                </SelectTrigger>
                <SelectContent className="bg-[#0D0F14] border-white/10">
                  {filteredSubStructures.map((s: any) => (
                    <SelectItem key={s.id} value={s.id} className="text-white hover:bg-white/5">
                      <span className="font-mono text-xs text-gray-500 mr-2">{s.id}</span>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {subStructureId && filteredSubStructures.find((s: any) => s.id === subStructureId)?.data?.whyItConverts && (
                <p className="text-[11px] text-gray-600 mt-1.5 pl-1">
                  {filteredSubStructures.find((s: any) => s.id === subStructureId)?.data?.whyItConverts}
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
                  {(optionsQuery.data?.audiences as any[] | undefined)?.map(a => (
                    <SelectItem key={a.id} value={a.id} className="text-white hover:bg-white/5">
                      <span>{a.label}</span>
                      <span className="text-gray-500 text-xs ml-2">— {String(a.data?.lifeContext || "").slice(0, 50)}...</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 6. Angle */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-5 h-5 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-[10px] font-bold text-cyan-400">6</span>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Selling Angle</label>
              </div>
              {productAngles.length > 0 ? (
                <Select value={angle} onValueChange={setAngle} disabled={isRunning || !product}>
                  <SelectTrigger className="bg-[#01040A] border-white/10 text-white rounded-xl h-11">
                    <SelectValue placeholder="Select an angle..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0D0F14] border-white/10">
                    {productAngles.map((a: string, i: number) => (
                      <SelectItem key={i} value={a} className="text-white hover:bg-white/5">
                        <span className="text-xs">{a}</span>
                      </SelectItem>
                    ))}
                    <SelectItem value="__custom__" className="text-white hover:bg-white/5">
                      <span className="text-gray-400">Custom angle…</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-[11px] text-gray-600 mb-2 pl-1">
                  {product ? "No predefined angles for this product" : "Select a product first"}
                </p>
              )}
              {(angle === "__custom__" || productAngles.length === 0) && (
                <Input
                  value={customAngle}
                  onChange={e => setCustomAngle(e.target.value)}
                  placeholder="Describe your selling angle..."
                  className="mt-2 bg-[#01040A] border-white/10 text-white placeholder:text-gray-600 rounded-xl h-10"
                  disabled={isRunning}
                />
              )}
            </div>

            {/* 7. Concept */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-[10px] font-bold text-orange-400">7</span>
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Concept</label>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => generateConceptsMutation.mutate({
                    product, scriptStyle, subStructureId: subStructureId || undefined,
                    funnelStage: funnelStage as any, archetype, angle: effectiveAngle,
                  })}
                  disabled={!canGenerateConcepts || generateConceptsMutation.isPending || isRunning}
                  className="text-xs border-white/10 text-gray-400 h-7"
                >
                  {generateConceptsMutation.isPending ? (
                    <><Loader2 className="w-3 h-3 animate-spin mr-1" /> Generating...</>
                  ) : (
                    <><Sparkles className="w-3 h-3 mr-1" /> Generate Concepts</>
                  )}
                </Button>
              </div>
              {aiConcepts.length > 0 && (
                <div className="flex flex-col gap-2 mb-3">
                  {aiConcepts.map((c, i) => (
                    <button
                      key={i}
                      onClick={() => setConcept(c.narrative)}
                      className={`text-left border rounded-lg px-3 py-2.5 transition-colors ${
                        concept === c.narrative
                          ? "border-[#FF3838]/50 bg-[#FF3838]/5"
                          : "bg-white/5 border-white/10 hover:border-white/20"
                      }`}
                    >
                      <div className="text-xs font-medium text-white mb-1">{c.title}</div>
                      <div className="text-[11px] text-gray-400 leading-relaxed">{c.narrative}</div>
                      {c.suggestedHook && (
                        <div className="text-[10px] text-orange-400/70 mt-1 italic">Hook: "{c.suggestedHook}"</div>
                      )}
                      {c.whyItConverts && (
                        <div className="text-[10px] text-gray-600 mt-0.5">{c.whyItConverts}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {aiConcepts.length === 0 && conceptSuggestions.length > 0 && (
                <div className="flex flex-col gap-1.5 mb-2">
                  {conceptSuggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => setConcept(s)}
                      className="text-left text-[11px] text-gray-500 cursor-pointer hover:text-gray-300 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
              <Textarea
                value={concept}
                onChange={e => setConcept(e.target.value)}
                placeholder="Describe your creative concept... e.g. 'A busy mum who was sceptical about fat burners discovers Hyperburn actually works because of the transparent ingredient list'"
                className="bg-[#01040A] border-white/10 text-white placeholder:text-gray-600 rounded-xl min-h-[100px] resize-none"
                disabled={isRunning}
              />
              <p className="text-[11px] text-gray-600 mt-1 pl-1">
                {concept.length < 10 ? `${10 - concept.length} more characters needed` : `${concept.length} characters`}
              </p>
            </div>

            {/* 8. Script Count */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-5 h-5 rounded-full bg-gray-500/20 border border-gray-500/30 flex items-center justify-center text-[10px] font-bold text-gray-400">8</span>
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
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg ${status === "running" ? "bg-white/5" : ""}`}
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
                  {/* Visual toggle */}
                  <div className="flex items-center gap-3">
                    <Switch
                      id="show-visuals"
                      checked={showVisuals}
                      onCheckedChange={setShowVisuals}
                    />
                    <label htmlFor="show-visuals" className="text-xs text-gray-400 cursor-pointer select-none">
                      Show visuals
                    </label>
                  </div>

                  {/* Edit hint banner */}
                  {isCompleted && !editHintDismissed && (
                    <div className="flex items-center justify-between bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2">
                      <p className="text-blue-300 text-xs">Scripts are editable — click any text to modify before pushing to ClickUp</p>
                      <button onClick={() => setEditHintDismissed(true)} className="text-blue-400 hover:text-blue-200 ml-3 shrink-0">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {scripts.map((script: any, i: number) => {
                    const expanded = expandedScripts.has(i);
                    const edited = getEditedScript(i);
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
                            <span className="text-sm text-white font-medium truncate">{edited.title || script.title}</span>
                            {score != null && (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
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
                              onClick={(e) => { e.stopPropagation(); handleCopy(formatScriptForCopy(edited), "Script"); }}
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
                              <EditableText
                                value={edited.hook || ""}
                                onChange={v => updateEditedScript(i, ["hook"], v)}
                                label="Edit hook text"
                                className="text-white text-sm font-medium"
                              />
                            </div>

                            {/* Script Table */}
                            {edited.script && (
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b border-white/10">
                                      <th className="text-left py-2 px-2 text-gray-500 font-medium w-20">Time</th>
                                      {showVisuals && <th className="text-left py-2 px-2 text-gray-500 font-medium w-1/3">Visual</th>}
                                      <th className="text-left py-2 px-2 text-gray-500 font-medium">Dialogue</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {edited.script.map((seg: any, j: number) => (
                                      <tr key={j} className="border-b border-white/5">
                                        <td className="py-2 px-2 text-gray-500 font-mono align-top">{seg.timestamp}</td>
                                        {showVisuals && (
                                          <td className="py-2 px-2 text-gray-400 align-top">
                                            <EditableText
                                              value={seg.visual || ""}
                                              onChange={v => updateEditedScript(i, ["script", String(j), "visual"], v)}
                                              label={`Edit visual for segment ${j + 1}`}
                                              multiline
                                              className="text-gray-400 text-xs"
                                            />
                                          </td>
                                        )}
                                        <td className="py-2 px-2 text-white align-top">
                                          <EditableText
                                            value={seg.dialogue || ""}
                                            onChange={v => updateEditedScript(i, ["script", String(j), "dialogue"], v)}
                                            label={`Edit dialogue for segment ${j + 1}`}
                                            multiline
                                            className="text-white text-xs"
                                          />
                                          {seg.transitionLine != null && seg.transitionLine !== "" && (
                                            <EditableText
                                              value={seg.transitionLine}
                                              onChange={v => updateEditedScript(i, ["script", String(j), "transitionLine"], v)}
                                              label={`Edit transition for segment ${j + 1}`}
                                              multiline
                                              className="text-gray-500 text-[11px] italic mt-1"
                                            />
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}

                            {/* Visual Direction */}
                            {showVisuals && edited.visualDirection && (
                              <div className="bg-white/5 rounded-lg p-3">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Visual Direction</p>
                                <EditableText
                                  value={edited.visualDirection || ""}
                                  onChange={v => updateEditedScript(i, ["visualDirection"], v)}
                                  label="Edit visual direction"
                                  multiline
                                  className="text-gray-300 text-xs"
                                />
                              </div>
                            )}

                            {/* Strategic Thesis */}
                            {edited.strategicThesis && (
                              <div className="bg-white/5 rounded-lg p-3">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Strategic Thesis</p>
                                <EditableText
                                  value={edited.strategicThesis || ""}
                                  onChange={v => updateEditedScript(i, ["strategicThesis"], v)}
                                  label="Edit strategic thesis"
                                  multiline
                                  className="text-gray-300 text-xs"
                                />
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

                  {/* Actions */}
                  {isCompleted && (
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      {hasUnsavedEdits && (
                        <Button
                          onClick={() => saveEditsMutation.mutate({ runId: runId!, scripts: Object.values(editedScripts) })}
                          disabled={saveEditsMutation.isPending}
                          variant="outline"
                          className="border-blue-500/30 text-blue-300 hover:text-white hover:bg-blue-500/10"
                        >
                          {saveEditsMutation.isPending ? (
                            <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving...</>
                          ) : (
                            <><Save className="w-4 h-4 mr-2" />Save Edits</>
                          )}
                        </Button>
                      )}
                      <div className="ml-auto">
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
