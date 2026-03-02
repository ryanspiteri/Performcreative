import { useState, useRef, useCallback } from "react";
import { useRoute, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Loader2, CheckCircle2, XCircle, Clock, Play, Send, Video,
  Upload, Mic, DollarSign, Download, ExternalLink, ChevronLeft,
  Zap, Users, Volume2, FileText, Sparkles, ArrowRight, RefreshCw,
  AlertCircle, Film, User, Flame, Wind, BarChart3
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type ScriptSource = "variant" | "original" | "custom";

// ─── Pipeline Stepper ─────────────────────────────────────────────────────────
const PIPELINE_STEPS = [
  { key: "uploaded", label: "Uploaded", icon: Upload },
  { key: "transcribing", label: "Transcribing", icon: Mic },
  { key: "structure_extracted", label: "Blueprint", icon: FileText },
  { key: "blueprint_approved", label: "Approved", icon: CheckCircle2 },
  { key: "generating_variants", label: "Generating", icon: Sparkles },
  { key: "completed", label: "Ready", icon: Zap },
];

function getStepIndex(status: string): number {
  const idx = PIPELINE_STEPS.findIndex(s => s.key === status);
  return idx >= 0 ? idx : 0;
}

function PipelineStepper({ status }: { status: string }) {
  const currentIdx = getStepIndex(status);
  return (
    <div className="flex items-center gap-0">
      {PIPELINE_STEPS.map((step, idx) => {
        const Icon = step.icon;
        const done = idx < currentIdx;
        const active = idx === currentIdx;
        const pending = idx > currentIdx;
        return (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                done ? "bg-green-500/20 border border-green-500/50" :
                active ? "bg-[#FF3838]/20 border border-[#FF3838] shadow-[0_0_12px_rgba(255,56,56,0.3)]" :
                "bg-white/5 border border-white/10"
              }`}>
                {done ? (
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                ) : active ? (
                  status === "transcribing" || status === "generating_variants"
                    ? <Loader2 className="w-4 h-4 text-[#FF3838] animate-spin" />
                    : <Icon className="w-4 h-4 text-[#FF3838]" />
                ) : (
                  <Icon className={`w-4 h-4 ${pending ? "text-white/20" : "text-white/40"}`} />
                )}
              </div>
              <span className={`text-[10px] font-medium whitespace-nowrap ${
                done ? "text-green-400" : active ? "text-[#FF3838]" : "text-white/30"
              }`}>{step.label}</span>
            </div>
            {idx < PIPELINE_STEPS.length - 1 && (
              <div className={`w-8 h-px mb-4 mx-1 ${done ? "bg-green-500/40" : "bg-white/10"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Archetype Icon ───────────────────────────────────────────────────────────
function ArchetypeIcon({ archetype }: { archetype: string }) {
  const map: Record<string, { icon: string; color: string }> = {
    "fitness enthusiast": { icon: "💪", color: "bg-orange-500/10 border-orange-500/20" },
    "busy mum": { icon: "👩‍👧", color: "bg-pink-500/10 border-pink-500/20" },
    "athlete": { icon: "🏃", color: "bg-blue-500/10 border-blue-500/20" },
    "biohacker": { icon: "🧬", color: "bg-purple-500/10 border-purple-500/20" },
    "wellness advocate": { icon: "🌿", color: "bg-green-500/10 border-green-500/20" },
    "gym regular": { icon: "🏋️", color: "bg-yellow-500/10 border-yellow-500/20" },
    "health-conscious professional": { icon: "💼", color: "bg-cyan-500/10 border-cyan-500/20" },
  };
  const entry = map[archetype?.toLowerCase()] || { icon: "👤", color: "bg-white/5 border-white/10" };
  return (
    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center text-xl shrink-0 ${entry.color}`}>
      {entry.icon}
    </div>
  );
}

// ─── Energy Badge ─────────────────────────────────────────────────────────────
function EnergyBadge({ level }: { level: string }) {
  const map: Record<string, { icon: any; color: string }> = {
    high: { icon: Flame, color: "text-orange-400 bg-orange-400/10 border-orange-400/20" },
    medium: { icon: BarChart3, color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20" },
    low: { icon: Wind, color: "text-blue-400 bg-blue-400/10 border-blue-400/20" },
  };
  const entry = map[level?.toLowerCase()] || { icon: BarChart3, color: "text-gray-400 bg-gray-400/10 border-gray-400/20" };
  const Icon = entry.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold uppercase tracking-wide ${entry.color}`}>
      <Icon className="w-2.5 h-2.5" />
      {level}
    </span>
  );
}

// ─── Character Swap Modal ─────────────────────────────────────────────────────
function CharacterSwapModal({
  open, onClose, variant, originalTranscript, uploadId, product,
}: {
  open: boolean; onClose: () => void; variant: any;
  originalTranscript: string; uploadId: number; product: string;
}) {
  const [scriptSource, setScriptSource] = useState<ScriptSource>("variant");
  const [customScript, setCustomScript] = useState("");
  const [accent, setAccent] = useState<"australian" | "american">("australian");
  const [voiceId, setVoiceId] = useState("");
  const [portraitFile, setPortraitFile] = useState<File | null>(null);
  const [portraitPreview, setPortraitPreview] = useState<string | null>(null);
  const [portraitS3Url, setPortraitS3Url] = useState<string | null>(null);
  const [validation, setValidation] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const portraitInputRef = useRef<HTMLInputElement>(null);

  const { data: voices = [], isLoading: voicesLoading } = trpc.faceSwap.getVoicesByAccent.useQuery(
    { accent }, { enabled: open }
  );
  const uploadPortraitMutation = trpc.faceSwap.uploadPortrait.useMutation();
  const validatePortraitMutation = trpc.faceSwap.validatePortrait.useMutation();
  const createJobMutation = trpc.faceSwap.create.useMutation();

  const activeScript =
    scriptSource === "variant" ? (variant?.scriptText || "") :
    scriptSource === "original" ? (originalTranscript || "") :
    customScript;

  const runtimeSec = variant?.runtime || 30;
  const estimatedCost = runtimeSec <= 30 ? "$1.08" : runtimeSec <= 60 ? "$2.16" : "$3.24";

  const processPortraitFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Portrait must be under 10MB"); return; }

    setPortraitFile(file);
    setValidation(null);
    setPortraitS3Url(null);
    setPortraitPreview(URL.createObjectURL(file));

    const mimeType = file.type as "image/jpeg" | "image/png" | "image/webp";
    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    const b64 = btoa(Array.from(uint8).map(b => String.fromCharCode(b)).join(""));

    setIsUploading(true);
    try {
      const { url } = await uploadPortraitMutation.mutateAsync({ base64: b64, mimeType });
      setPortraitS3Url(url);
      setIsValidating(true);
      try {
        const result = await validatePortraitMutation.mutateAsync({ portraitBase64: b64, mimeType });
        setValidation(result);
      } catch (err: any) {
        toast.error(`Validation failed: ${err.message}`);
      } finally { setIsValidating(false); }
    } catch (err: any) {
      toast.error(`Upload failed: ${err.message}`);
    } finally { setIsUploading(false); }
  }, [uploadPortraitMutation, validatePortraitMutation]);

  const handlePortraitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processPortraitFile(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processPortraitFile(file);
  }, [processPortraitFile]);

  const handleSubmit = async () => {
    if (!activeScript.trim()) { toast.error("Please provide a script"); return; }
    if (!portraitS3Url) { toast.error("Please upload a portrait photo"); return; }
    if (!voiceId) { toast.error("Please select a voice"); return; }
    if (validation && !validation.passed) { toast.error("Portrait failed quality check — please upload a better photo"); return; }

    setIsSubmitting(true);
    try {
      const { jobId, estimatedCostUsd } = await createJobMutation.mutateAsync({
        portraitBase64: "",
        portraitMimeType: "image/jpeg",
        portraitS3Url,
        voiceId,
        voiceoverScript: activeScript,
        ugcVariantId: variant?.id,
        videoDurationSeconds: runtimeSec,
      });
      toast.success(`Character swap started — Job #${jobId}. Est. cost: ${estimatedCostUsd}. Takes 3–10 min.`);
      handleClose();
    } catch (err: any) {
      toast.error(`Failed to start job: ${err.message}`);
    } finally { setIsSubmitting(false); }
  };

  const handleClose = () => {
    setScriptSource("variant"); setCustomScript(""); setAccent("australian");
    setVoiceId(""); setPortraitFile(null); setPortraitPreview(null);
    setPortraitS3Url(null); setValidation(null);
    onClose();
  };

  const canSubmit = !isSubmitting && !isUploading && !isValidating && !!portraitS3Url && !!voiceId && !!activeScript.trim();

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-[#0A0C10] border-white/10 text-white max-w-2xl max-h-[92vh] overflow-y-auto p-0">
        {/* Modal Header */}
        <div className="px-6 pt-6 pb-4 border-b border-white/10 bg-gradient-to-r from-[#FF3838]/5 to-transparent">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#FF3838]/15 border border-[#FF3838]/30 flex items-center justify-center">
                <Film className="w-4.5 h-4.5 text-[#FF3838]" />
              </div>
              <div>
                <div className="text-lg font-bold">Character Swap</div>
                <div className="text-xs text-gray-500 font-normal mt-0.5">
                  Variant #{variant?.variantNumber} · {variant?.actorArchetype} · ~{runtimeSec}s
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="px-6 py-5 space-y-7">
          {/* ── Step 1: Script ── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-[#FF3838] flex items-center justify-center text-[10px] font-bold text-white shrink-0">1</div>
              <span className="text-sm font-semibold text-white">Choose Script</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: "variant", label: "Variant Script", desc: "Generated variant", icon: "✨" },
                { value: "original", label: "Original Script", desc: "Source video transcript", icon: "🎬" },
                { value: "custom", label: "Write My Own", desc: "Paste or type freely", icon: "✏️" },
              ] as { value: ScriptSource; label: string; desc: string; icon: string }[]).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setScriptSource(opt.value)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    scriptSource === opt.value
                      ? "border-[#FF3838]/60 bg-[#FF3838]/8 shadow-[0_0_0_1px_rgba(255,56,56,0.2)]"
                      : "border-white/8 bg-white/3 hover:border-white/15 hover:bg-white/5"
                  }`}
                >
                  <div className="text-base mb-1">{opt.icon}</div>
                  <div className="text-xs font-semibold text-white">{opt.label}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5 leading-tight">{opt.desc}</div>
                </button>
              ))}
            </div>
            <div className="rounded-xl border border-white/8 overflow-hidden">
              {scriptSource === "custom" ? (
                <Textarea
                  value={customScript}
                  onChange={e => setCustomScript(e.target.value)}
                  placeholder="Paste or type your script here..."
                  className="bg-[#0D0F14] border-0 text-white placeholder:text-gray-600 min-h-[110px] resize-none rounded-xl text-sm focus-visible:ring-0"
                />
              ) : (
                <div className="bg-[#0D0F14] p-4 text-sm text-gray-300 whitespace-pre-wrap max-h-[110px] overflow-y-auto leading-relaxed">
                  {activeScript || <span className="text-gray-600 italic">No script available for this option</span>}
                </div>
              )}
            </div>
          </div>

          {/* ── Step 2: Accent + Voice ── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-[#0347ED] flex items-center justify-center text-[10px] font-bold text-white shrink-0">2</div>
              <span className="text-sm font-semibold text-white">Accent & Voice</span>
            </div>
            {/* Accent toggle */}
            <div className="flex gap-2">
              {(["australian", "american"] as const).map(a => (
                <button
                  key={a}
                  onClick={() => { setAccent(a); setVoiceId(""); }}
                  className={`flex-1 py-2.5 px-4 rounded-xl border text-sm font-semibold transition-all ${
                    accent === a
                      ? "border-[#0347ED]/60 bg-[#0347ED]/10 text-white shadow-[0_0_0_1px_rgba(3,71,237,0.2)]"
                      : "border-white/8 bg-white/3 text-gray-400 hover:border-white/15 hover:text-white"
                  }`}
                >
                  {a === "australian" ? "🇦🇺 Australian" : "🇺🇸 American"}
                </button>
              ))}
            </div>
            {/* Voice selector */}
            <Select value={voiceId} onValueChange={setVoiceId} disabled={voicesLoading}>
              <SelectTrigger className="bg-[#0D0F14] border-white/10 text-white rounded-xl h-11">
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-gray-500" />
                  <SelectValue placeholder={voicesLoading ? "Loading voices..." : "Select a voice"} />
                </div>
              </SelectTrigger>
              <SelectContent className="bg-[#0D0F14] border-white/10">
                {(voices as any[]).map((v: any) => (
                  <SelectItem key={v.id} value={v.id} className="text-white hover:bg-white/5 focus:bg-white/5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{v.name}</span>
                      <span className="text-gray-500 text-xs">{v.gender} · {v.age}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* ── Step 3: Portrait ── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0">3</div>
              <span className="text-sm font-semibold text-white">Reference Portrait</span>
            </div>

            {/* Drop zone */}
            <div
              onClick={() => portraitInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`relative rounded-xl border-2 border-dashed cursor-pointer transition-all overflow-hidden ${
                isDragging ? "border-purple-500/60 bg-purple-500/5" :
                portraitFile ? "border-white/15 bg-white/3" :
                "border-white/10 bg-white/2 hover:border-white/20 hover:bg-white/4"
              }`}
            >
              {portraitPreview ? (
                <div className="flex items-center gap-4 p-4">
                  <div className="relative">
                    <img src={portraitPreview} alt="Portrait" className="w-20 h-20 rounded-xl object-cover border border-white/10" />
                    {(isUploading || isValidating) && (
                      <div className="absolute inset-0 rounded-xl bg-black/60 flex items-center justify-center">
                        <Loader2 className="w-5 h-5 animate-spin text-white" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium truncate">{portraitFile?.name}</div>
                    <div className="text-xs mt-1">
                      {isUploading ? <span className="text-yellow-400">Uploading to S3...</span> :
                       isValidating ? <span className="text-blue-400">Analysing with AI...</span> :
                       portraitS3Url ? <span className="text-green-400">✓ Uploaded & validated</span> : ""}
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); setPortraitFile(null); setPortraitPreview(null); setPortraitS3Url(null); setValidation(null); }}
                      className="text-xs text-gray-500 hover:text-white mt-1 underline"
                    >
                      Change photo
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-10 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3">
                    <User className="w-6 h-6 text-gray-500" />
                  </div>
                  <div className="text-white text-sm font-medium mb-1">Drop portrait photo here</div>
                  <div className="text-gray-500 text-xs">or click to browse · JPG, PNG, WEBP · min 1080×1080px</div>
                </div>
              )}
            </div>
            <input ref={portraitInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePortraitChange} />

            {/* Quality requirements */}
            {!validation && !isValidating && (
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  "Min 1080×1080px resolution",
                  "Front-facing (±15° max tilt)",
                  "Even, natural lighting",
                  "Neutral or slight smile",
                  "No glasses or hats",
                  "No heavy accessories",
                ].map(req => (
                  <div key={req} className="flex items-center gap-1.5 text-[11px] text-gray-500">
                    <div className="w-1 h-1 rounded-full bg-gray-600 shrink-0" />
                    {req}
                  </div>
                ))}
              </div>
            )}

            {/* Validation results */}
            {validation && (
              <div className={`rounded-xl border p-4 ${
                validation.passed ? "border-green-500/25 bg-green-500/5" : "border-red-500/25 bg-red-500/5"
              }`}>
                <div className={`flex items-center gap-2 text-sm font-semibold mb-3 ${validation.passed ? "text-green-400" : "text-red-400"}`}>
                  {validation.passed ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  {validation.passed ? "Portrait passed all quality checks" : "Portrait failed quality check"}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {validation.checks?.map((check: any) => (
                    <div key={check.criterion} className="flex items-center gap-2 text-xs">
                      {check.passed
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
                        : <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                      <span className={check.passed ? "text-gray-400" : "text-red-300"}>{check.criterion}</span>
                    </div>
                  ))}
                </div>
                {validation.feedback && (
                  <div className="text-xs text-gray-500 mt-3 pt-3 border-t border-white/5">{validation.feedback}</div>
                )}
              </div>
            )}
          </div>

          {/* ── Cost + Submit ── */}
          <div className="pt-2 border-t border-white/8">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-400">Estimated cost:</span>
                  <span className="text-white font-bold">{estimatedCost}</span>
                </div>
                <div className="text-[11px] text-gray-600">~{runtimeSec}s video · Magic Hour full-body swap · 3–10 min</div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose} className="border-white/10 text-white hover:bg-white/5 rounded-xl">
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className="bg-[#FF3838] hover:bg-[#FF3838]/90 text-white rounded-xl px-5 disabled:opacity-40"
                >
                  {isSubmitting ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Starting...</>
                  ) : (
                    <><Film className="w-4 h-4 mr-2" />Start Character Swap</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Variant Card ─────────────────────────────────────────────────────────────
function VariantCard({
  variant, selected, onToggle, onSwap,
}: {
  variant: any; selected: boolean; onToggle: () => void; onSwap: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const statusColorMap: Record<string, string> = {
    approved: "text-green-400 bg-green-400/10 border-green-400/20",
    rejected: "text-red-400 bg-red-400/10 border-red-400/20",
    generated: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
    awaiting_approval: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  };
  const statusColor = statusColorMap[variant.status] || "text-gray-400 bg-gray-400/10 border-gray-400/20";

  return (
    <div className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
      selected ? "border-[#FF3838]/40 bg-[#FF3838]/3 shadow-[0_0_0_1px_rgba(255,56,56,0.15)]" : "border-white/8 bg-white/2 hover:border-white/15"
    }`}>
      {/* Card Header */}
      <div className="p-4 flex items-start gap-3">
        <Checkbox
          checked={selected}
          onCheckedChange={onToggle}
          className="mt-1 shrink-0"
        />
        <ArchetypeIcon archetype={variant.actorArchetype} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-white font-bold text-sm">#{variant.variantNumber}</span>
              <span className="text-gray-400 text-xs capitalize">{variant.actorArchetype}</span>
              <EnergyBadge level={variant.energyLevel} />
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-semibold uppercase tracking-wide ${statusColor}`}>
                {variant.status?.replace("_", " ")}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-gray-500 capitalize">{variant.voiceTone} tone</span>
            <span className="text-gray-700">·</span>
            <span className="text-[11px] text-gray-500">~{variant.runtime}s</span>
          </div>
        </div>
        {/* Character Swap Button */}
        <button
          onClick={onSwap}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FF3838]/10 hover:bg-[#FF3838]/20 border border-[#FF3838]/25 hover:border-[#FF3838]/50 text-[#FF3838] text-xs font-semibold transition-all"
        >
          <Film className="w-3.5 h-3.5" />
          Swap
        </button>
      </div>

      {/* Script Preview */}
      <div className="px-4 pb-4">
        <div
          className={`text-sm text-gray-300 leading-relaxed overflow-hidden transition-all ${expanded ? "" : "line-clamp-3"}`}
        >
          {variant.scriptText}
        </div>
        {variant.scriptText?.length > 180 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-gray-500 hover:text-white mt-1.5 transition-colors"
          >
            {expanded ? "Show less ↑" : "Read more ↓"}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Character Swap Jobs Panel ─────────────────────────────────────────────────
function CharacterSwapJobsPanel({ product }: { product: string }) {
  const { data: jobs = [], refetch } = trpc.faceSwap.list.useQuery(undefined, {
    refetchInterval: (data: any) => {
      const arr = Array.isArray(data) ? data : [];
      const hasRunning = arr.some((j: any) => j.status === "processing" || j.status === "pending");
      return hasRunning ? 5000 : false;
    },
  });

  const pushMutation = trpc.faceSwap.pushToClickUp.useMutation({
    onSuccess: ({ taskUrl }) => { toast.success(`Pushed to ClickUp`); refetch(); },
    onError: (err) => toast.error(`ClickUp push failed: ${err.message}`),
  });

  if (!jobs.length) return null;

  return (
    <div className="mt-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-xl bg-[#FF3838]/15 border border-[#FF3838]/30 flex items-center justify-center">
          <Film className="w-4 h-4 text-[#FF3838]" />
        </div>
        <div>
          <h3 className="text-white font-bold text-sm">Character Swap Jobs</h3>
          <p className="text-gray-500 text-xs">{jobs.length} job{jobs.length !== 1 ? "s" : ""} · Magic Hour full-body swap</p>
        </div>
      </div>
      <div className="space-y-3">
        {(jobs as any[]).map((job: any) => (
          <div key={job.id} className="rounded-2xl border border-white/8 bg-white/2 overflow-hidden">
            <div className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  job.status === "completed" ? "bg-green-500/15 border border-green-500/30" :
                  job.status === "failed" ? "bg-red-500/15 border border-red-500/30" :
                  "bg-yellow-500/15 border border-yellow-500/30"
                }`}>
                  {job.status === "completed" ? <CheckCircle2 className="w-4 h-4 text-green-400" /> :
                   job.status === "failed" ? <XCircle className="w-4 h-4 text-red-400" /> :
                   <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />}
                </div>
                <div>
                  <div className="text-white text-sm font-semibold">Job #{job.id}</div>
                  <div className="text-gray-500 text-xs capitalize">{job.status}{job.estimatedCostUsd ? ` · ${job.estimatedCostUsd}` : ""}</div>
                </div>
              </div>
              <div className="flex gap-2">
                {job.status === "completed" && job.outputVideoUrl && (
                  <>
                    <a href={job.outputVideoUrl} download target="_blank" rel="noreferrer">
                      <Button size="sm" variant="outline" className="border-white/10 text-white hover:bg-white/5 rounded-xl h-8 text-xs">
                        <Download className="w-3 h-3 mr-1" />Download
                      </Button>
                    </a>
                    {!job.clickupTaskId ? (
                      <Button
                        size="sm"
                        onClick={() => pushMutation.mutate({ jobId: job.id, product, priority: "High" })}
                        disabled={pushMutation.isPending}
                        className="bg-[#0347ED] hover:bg-[#0347ED]/90 text-white rounded-xl h-8 text-xs"
                      >
                        <Send className="w-3 h-3 mr-1" />Push to ClickUp
                      </Button>
                    ) : (
                      <a href={job.clickupTaskUrl} target="_blank" rel="noreferrer">
                        <Button size="sm" variant="outline" className="border-green-600/30 text-green-400 rounded-xl h-8 text-xs">
                          <ExternalLink className="w-3 h-3 mr-1" />View in ClickUp
                        </Button>
                      </a>
                    )}
                  </>
                )}
              </div>
            </div>
            {job.status === "completed" && job.outputVideoUrl && (
              <div className="px-4 pb-4">
                <video src={job.outputVideoUrl} controls className="w-full max-w-lg rounded-xl border border-white/10" />
              </div>
            )}
            {job.errorMessage && (
              <div className="px-4 pb-4">
                <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/5 border border-red-500/15 rounded-xl p-3">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {job.errorMessage}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Blueprint Section ─────────────────────────────────────────────────────────
function BlueprintSection({ blueprint, upload, uploadId, approveBlueprint, generateVariants }: any) {
  const [collapsed, setCollapsed] = useState(false);
  if (!blueprint) return null;

  return (
    <div className="rounded-2xl border border-white/8 bg-white/2 overflow-hidden mb-6">
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between p-5 hover:bg-white/3 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#0347ED]/15 border border-[#0347ED]/30 flex items-center justify-center">
            <FileText className="w-4 h-4 text-[#0347ED]" />
          </div>
          <div className="text-left">
            <div className="text-white font-bold text-sm">Structure Blueprint</div>
            <div className="text-gray-500 text-xs">Winning structure extracted from source video</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {upload.blueprintApprovedAt && (
            <span className="text-xs text-green-400 bg-green-400/10 border border-green-400/20 px-2.5 py-1 rounded-full font-semibold">
              ✓ Approved
            </span>
          )}
          <span className="text-gray-500 text-xs">{collapsed ? "Show" : "Hide"}</span>
        </div>
      </button>

      {!collapsed && (
        <div className="px-5 pb-5 space-y-4 border-t border-white/5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-4">
            {/* Hook */}
            <div className="rounded-xl bg-orange-500/5 border border-orange-500/15 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-orange-400 text-xs font-bold uppercase tracking-wide">Hook</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                  blueprint.hook?.strength === "strong" ? "bg-green-500/15 text-green-400" :
                  blueprint.hook?.strength === "medium" ? "bg-yellow-500/15 text-yellow-400" :
                  "bg-red-500/15 text-red-400"
                }`}>{blueprint.hook?.strength}</span>
              </div>
              <p className="text-gray-300 text-xs leading-relaxed">{blueprint.hook?.text}</p>
              <p className="text-gray-600 text-[10px] mt-2">{blueprint.hook?.startTime}s – {blueprint.hook?.endTime}s</p>
            </div>
            {/* Body */}
            <div className="rounded-xl bg-blue-500/5 border border-blue-500/15 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-blue-400 text-xs font-bold uppercase tracking-wide">Body</span>
                <span className="text-[10px] text-gray-500">{blueprint.pacing?.wordsPerMinute} WPM</span>
              </div>
              <p className="text-gray-300 text-xs leading-relaxed line-clamp-3">{blueprint.body?.text}</p>
            </div>
            {/* CTA */}
            <div className="rounded-xl bg-purple-500/5 border border-purple-500/15 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-purple-400 text-xs font-bold uppercase tracking-wide">CTA</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                  blueprint.cta?.urgency === "high" ? "bg-red-500/15 text-red-400" :
                  blueprint.cta?.urgency === "medium" ? "bg-yellow-500/15 text-yellow-400" :
                  "bg-gray-500/15 text-gray-400"
                }`}>{blueprint.cta?.urgency} urgency</span>
              </div>
              <p className="text-gray-300 text-xs leading-relaxed">{blueprint.cta?.text}</p>
            </div>
          </div>

          {/* Actions */}
          {!upload.blueprintApprovedAt && (
            <Button
              onClick={() => approveBlueprint.mutate({ uploadId })}
              disabled={approveBlueprint.isPending}
              className="bg-[#FF3838] hover:bg-[#FF3838]/90 text-white rounded-xl w-full h-11"
            >
              {approveBlueprint.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Approving Blueprint...</>
              ) : (
                <><CheckCircle2 className="w-4 h-4 mr-2" />Approve Blueprint & Generate Variants<ArrowRight className="w-4 h-4 ml-2" /></>
              )}
            </Button>
          )}
          {upload.blueprintApprovedAt && upload.status === "blueprint_approved" && (
            <Button
              onClick={() => generateVariants.mutate({ uploadId })}
              disabled={generateVariants.isPending}
              className="bg-[#0347ED] hover:bg-[#0347ED]/90 text-white rounded-xl w-full h-11"
            >
              {generateVariants.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Starting Generation...</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" />Start Variant Generation<ArrowRight className="w-4 h-4 ml-2" /></>
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ────────────────────────────────────────────────────────────
export default function UgcDashboard() {
  const [, params] = useRoute("/ugc/:id");
  const uploadId = parseInt(params?.id || "0");
  const [selectedVariants, setSelectedVariants] = useState<number[]>([]);
  const [swapModalVariant, setSwapModalVariant] = useState<any>(null);

  const { data, isLoading, refetch } = trpc.ugc.get.useQuery({ id: uploadId }, {
    enabled: uploadId > 0,
    refetchInterval: (queryData) => {
      const status = (queryData as any)?.upload?.status;
      return (status === "transcribing" || status === "structure_extracted" || status === "generating_variants") ? 3000 : false;
    },
  });

  const approveBlueprint = trpc.ugc.approveBlueprint.useMutation({
    onSuccess: () => { toast.success("Blueprint approved! Generating variants..."); refetch(); },
    onError: (error) => toast.error(`Failed to approve blueprint: ${error.message}`),
  });
  const generateVariants = trpc.ugc.generateVariants.useMutation({
    onSuccess: () => { toast.success("Variant generation started!"); refetch(); },
    onError: (error) => toast.error(`Failed to generate variants: ${error.message}`),
  });
  const approveVariants = trpc.ugc.approveVariants.useMutation({
    onSuccess: (result) => { toast.success(`${result.count} variants approved!`); setSelectedVariants([]); refetch(); },
    onError: (error) => toast.error(`Failed to approve variants: ${error.message}`),
  });
  const rejectVariants = trpc.ugc.rejectVariants.useMutation({
    onSuccess: (result) => { toast.success(`${result.count} variants rejected`); setSelectedVariants([]); refetch(); },
    onError: (error) => toast.error(`Failed to reject variants: ${error.message}`),
  });
  const pushToClickup = trpc.ugc.pushToClickup.useMutation({
    onSuccess: (result) => { toast.success(`${result.count} variants pushed to ClickUp!`); setSelectedVariants([]); refetch(); },
    onError: (error) => toast.error(`Failed to push to ClickUp: ${error.message}`),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#FF3838] mx-auto" />
          <p className="text-gray-500 text-sm">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!data?.upload) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-gray-600 mx-auto" />
          <p className="text-gray-400">Upload not found</p>
          <Link href="/ugc"><Button variant="outline" className="border-white/10 text-white">← Back to UGC</Button></Link>
        </div>
      </div>
    );
  }

  const { upload, variants } = data;
  const blueprint = upload.structureBlueprint as any;
  const originalTranscript = upload.transcript || "";
  const approvedVariants = variants.filter((v: any) => v.status === "approved");
  const awaitingApproval = variants.filter((v: any) => v.status === "generated" || v.status === "awaiting_approval");

  const toggleVariant = (id: number) => setSelectedVariants(prev => prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]);
  const selectAll = () => setSelectedVariants(variants.map((v: any) => v.id));
  const deselectAll = () => setSelectedVariants([]);

  return (
    <div className="min-h-screen bg-[#01040A]">
      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* ── Back nav ── */}
        <Link href="/ugc">
          <button className="flex items-center gap-2 text-gray-500 hover:text-white text-sm mb-6 transition-colors group">
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            UGC Clone Engine
          </button>
        </Link>

        {/* ── Hero Header ── */}
        <div className="rounded-2xl border border-white/8 bg-gradient-to-br from-white/3 to-transparent overflow-hidden mb-6">
          <div className="flex flex-col md:flex-row gap-0">
            {/* Video thumbnail */}
            {upload.videoUrl && (
              <div className="md:w-72 shrink-0">
                <video
                  src={upload.videoUrl}
                  controls
                  className="w-full h-48 md:h-full object-cover"
                />
              </div>
            )}
            {/* Info */}
            <div className="flex-1 p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h1 className="text-2xl font-bold text-white mb-1">{upload.product}</h1>
                    <p className="text-gray-500 text-sm">Upload #{uploadId}{upload.audienceTag ? ` · ${upload.audienceTag}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide border ${
                      upload.status === "completed" ? "bg-green-500/10 border-green-500/25 text-green-400" :
                      upload.status === "generating_variants" ? "bg-yellow-500/10 border-yellow-500/25 text-yellow-400" :
                      "bg-gray-500/10 border-gray-500/25 text-gray-400"
                    }`}>
                      {upload.status?.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>
                {/* Stats row */}
                <div className="flex items-center gap-6 mb-5">
                  <div className="text-center">
                    <div className="text-xl font-bold text-white">{variants.length}</div>
                    <div className="text-[11px] text-gray-500">Variants</div>
                  </div>
                  <div className="w-px h-8 bg-white/8" />
                  <div className="text-center">
                    <div className="text-xl font-bold text-green-400">{approvedVariants.length}</div>
                    <div className="text-[11px] text-gray-500">Approved</div>
                  </div>
                  <div className="w-px h-8 bg-white/8" />
                  <div className="text-center">
                    <div className="text-xl font-bold text-yellow-400">{awaitingApproval.length}</div>
                    <div className="text-[11px] text-gray-500">Pending</div>
                  </div>
                  <div className="w-px h-8 bg-white/8" />
                  <div className="text-center">
                    <div className="text-xl font-bold text-white">{upload.desiredOutputVolume}</div>
                    <div className="text-[11px] text-gray-500">Target</div>
                  </div>
                </div>
              </div>
              {/* Pipeline stepper */}
              <PipelineStepper status={upload.status} />
            </div>
          </div>
        </div>

        {/* ── Transcribing / Extracting state ── */}
        {(upload.status === "transcribing" || upload.status === "uploaded") && (
          <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-6 mb-6 flex items-center gap-4">
            <Loader2 className="w-6 h-6 animate-spin text-yellow-400 shrink-0" />
            <div>
              <div className="text-white font-semibold text-sm">
                {upload.status === "transcribing" ? "Transcribing audio..." : "Processing upload..."}
              </div>
              <div className="text-gray-400 text-xs mt-0.5">
                {upload.status === "transcribing"
                  ? "Extracting transcript and analysing structure — this takes 1–2 minutes"
                  : "Preparing your video for processing"}
              </div>
            </div>
          </div>
        )}

        {/* ── Blueprint ── */}
        <BlueprintSection
          blueprint={blueprint}
          upload={upload}
          uploadId={uploadId}
          approveBlueprint={approveBlueprint}
          generateVariants={generateVariants}
        />

        {/* ── Generating state ── */}
        {upload.status === "generating_variants" && variants.length === 0 && (
          <div className="rounded-2xl border border-[#0347ED]/20 bg-[#0347ED]/5 p-8 mb-6 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#0347ED] mx-auto mb-3" />
            <div className="text-white font-bold mb-1">Generating Script Variants...</div>
            <div className="text-gray-400 text-sm">Creating {upload.desiredOutputVolume} unique variants across archetypes and voice tones</div>
          </div>
        )}

        {/* ── Variants ── */}
        {variants.length > 0 && (
          <div>
            {/* Section header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center">
                  <Users className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-white font-bold text-sm">Generated Variants</h2>
                  <p className="text-gray-500 text-xs">{variants.length} variants · {approvedVariants.length} approved · {awaitingApproval.length} awaiting review</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={selectAll} className="text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg border border-white/8 hover:border-white/15 transition-all">
                  Select all
                </button>
                <button onClick={deselectAll} className="text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg border border-white/8 hover:border-white/15 transition-all">
                  Deselect
                </button>
              </div>
            </div>

            {/* Bulk actions bar */}
            {selectedVariants.length > 0 && (
              <div className="mb-4 p-4 rounded-2xl bg-[#FF3838]/5 border border-[#FF3838]/20 flex items-center justify-between">
                <span className="text-white text-sm font-semibold">{selectedVariants.length} selected</span>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => approveVariants.mutate({ variantIds: selectedVariants })} disabled={approveVariants.isPending} className="bg-green-600 hover:bg-green-700 text-white rounded-xl h-8 text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => rejectVariants.mutate({ variantIds: selectedVariants })} disabled={rejectVariants.isPending} className="border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-xl h-8 text-xs">
                    <XCircle className="w-3.5 h-3.5 mr-1" />Reject
                  </Button>
                  <Button size="sm" onClick={() => pushToClickup.mutate({ variantIds: selectedVariants })} disabled={pushToClickup.isPending} className="bg-[#0347ED] hover:bg-[#0347ED]/90 text-white rounded-xl h-8 text-xs">
                    <Send className="w-3.5 h-3.5 mr-1" />Push to ClickUp
                  </Button>
                </div>
              </div>
            )}

            {/* Variants grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {variants.map((variant: any) => (
                <VariantCard
                  key={variant.id}
                  variant={variant}
                  selected={selectedVariants.includes(variant.id)}
                  onToggle={() => toggleVariant(variant.id)}
                  onSwap={() => setSwapModalVariant(variant)}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Character Swap Jobs ── */}
        <CharacterSwapJobsPanel product={upload.product} />
      </div>

      {/* ── Character Swap Modal ── */}
      {swapModalVariant && (
        <CharacterSwapModal
          open={!!swapModalVariant}
          onClose={() => setSwapModalVariant(null)}
          variant={swapModalVariant}
          originalTranscript={originalTranscript}
          uploadId={uploadId}
          product={upload.product}
        />
      )}
    </div>
  );
}
