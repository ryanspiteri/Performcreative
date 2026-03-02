import { useState, useRef, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Upload, UserRound, Mic, Video, CheckCircle2, XCircle, Loader2,
  AlertTriangle, Play, Download, ExternalLink, RefreshCw, ChevronRight,
  Clock, DollarSign, Zap
} from "lucide-react";

// ─── ElevenLabs voice options ─────────────────────────────────────────────────
const ELEVENLABS_VOICES = [
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", description: "Calm, professional female" },
  { id: "AZnzlk1XvdvUeBnXmlld", name: "Domi", description: "Strong, confident female" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella", description: "Soft, warm female" },
  { id: "ErXwobaYiN019PkySvjV", name: "Antoni", description: "Warm, natural male" },
  { id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli", description: "Emotional, expressive female" },
  { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh", description: "Deep, authoritative male" },
  { id: "VR6AewLTigWG4xSOukaG", name: "Arnold", description: "Crisp, confident male" },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam", description: "Deep, narrative male" },
  { id: "yoZ06aMxZJJ28mfd3POQ", name: "Sam", description: "Raspy, intense male" },
];

// ─── Status helpers ───────────────────────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  pending: "Queued",
  validating: "Validating Portrait",
  generating_voice: "Generating Voiceover",
  swapping: "Swapping Character",
  merging: "Merging Audio",
  completed: "Completed",
  failed: "Failed",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  validating: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  generating_voice: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  swapping: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  merging: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  completed: "bg-green-500/20 text-green-400 border-green-500/30",
  failed: "bg-red-500/20 text-red-400 border-red-500/30",
};

const PIPELINE_STEPS = [
  { key: "validating", label: "Portrait Validation" },
  { key: "generating_voice", label: "Voiceover Generation" },
  { key: "swapping", label: "Character Swap" },
  { key: "merging", label: "Audio Merge" },
  { key: "completed", label: "Complete" },
];

const STEP_ORDER = ["pending", "validating", "generating_voice", "swapping", "merging", "completed"];

function getStepIndex(status: string) {
  return STEP_ORDER.indexOf(status);
}

// ─── Portrait Check Item ──────────────────────────────────────────────────────
function PortraitCheckItem({ name, passed, note }: { name: string; passed: boolean; note: string }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-white/5 last:border-0">
      {passed
        ? <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
        : <XCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
      }
      <div>
        <p className="text-sm font-medium text-white/90">{name}</p>
        <p className="text-xs text-white/50 mt-0.5">{note}</p>
      </div>
    </div>
  );
}

// ─── Job Card ─────────────────────────────────────────────────────────────────
function JobCard({ jobId, product, onPushToClickUp }: {
  jobId: number;
  product: string;
  onPushToClickUp: (jobId: number) => void;
}) {
  const [enabled, setEnabled] = useState(true);
  const { data: job } = trpc.faceSwap.get.useQuery(
    { id: jobId },
    { refetchInterval: enabled ? 8000 : false }
  );

  useEffect(() => {
    if (job?.status === "completed" || job?.status === "failed") {
      setEnabled(false);
    }
  }, [job?.status]);

  if (!job) return null;

  const stepIndex = getStepIndex(job.status);

  return (
    <div className="bg-[#0D0F12] border border-white/10 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#FF3838]/10 flex items-center justify-center">
            <UserRound className="w-4 h-4 text-[#FF3838]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Job #{job.id}</p>
            <p className="text-xs text-white/40">{new Date(job.createdAt).toLocaleString()}</p>
          </div>
        </div>
        <Badge className={`text-xs border ${STATUS_COLORS[job.status] || "bg-white/10 text-white/60"}`}>
          {STATUS_LABELS[job.status] || job.status}
        </Badge>
      </div>

      {/* Progress steps */}
      {job.status !== "failed" && (
        <div className="flex items-center gap-1 mb-4">
          {PIPELINE_STEPS.map((step, i) => {
            const stepIdx = STEP_ORDER.indexOf(step.key);
            const isDone = stepIndex > stepIdx || job.status === "completed";
            const isActive = stepIndex === stepIdx;
            return (
              <div key={step.key} className="flex items-center gap-1 flex-1">
                <div className={`h-1.5 rounded-full flex-1 transition-all ${
                  isDone ? "bg-green-500" : isActive ? "bg-[#FF3838] animate-pulse" : "bg-white/10"
                }`} />
              </div>
            );
          })}
        </div>
      )}

      {/* Error message */}
      {job.status === "failed" && job.errorMessage && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-xs text-red-300">{job.errorMessage}</p>
        </div>
      )}

      {/* Cost */}
      {job.estimatedCostUsd && (
        <div className="flex items-center gap-2 text-xs text-white/40 mb-3">
          <DollarSign className="w-3 h-3" />
          <span>Estimated cost: {job.estimatedCostUsd}</span>
          {job.creditsCharged && <span>· {job.creditsCharged} credits</span>}
        </div>
      )}

      {/* Output video */}
      {job.status === "completed" && job.outputVideoUrl && (
        <div className="mt-3 space-y-3">
          <video
            src={job.outputVideoUrl}
            controls
            className="w-full rounded-lg bg-black max-h-64"
          />
          <div className="flex gap-2">
            <a
              href={job.outputVideoUrl}
              download
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-white/80 transition-colors"
            >
              <Download className="w-3 h-3" />
              Download
            </a>
            {!job.clickupTaskId && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-xs border-[#FF3838]/40 text-[#FF3838] hover:bg-[#FF3838]/10"
                onClick={() => onPushToClickUp(job.id)}
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                Push to ClickUp
              </Button>
            )}
            {job.clickupTaskUrl && (
              <a
                href={job.clickupTaskUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-lg text-xs text-green-400 transition-colors hover:bg-green-500/20"
              >
                <CheckCircle2 className="w-3 h-3" />
                In ClickUp
              </a>
            )}
          </div>
        </div>
      )}

      {/* Processing indicator */}
      {["pending", "validating", "generating_voice", "swapping", "merging"].includes(job.status) && (
        <div className="flex items-center gap-2 text-xs text-white/40">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>{STATUS_LABELS[job.status]}... this may take 3–10 minutes</span>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CharacterSwap() {
  // Form state
  const [sourceVideoUrl, setSourceVideoUrl] = useState("");
  const [portraitFile, setPortraitFile] = useState<File | null>(null);
  const [portraitPreview, setPortraitPreview] = useState<string | null>(null);
  const [portraitBase64, setPortraitBase64] = useState<string | null>(null);
  const [portraitMimeType, setPortraitMimeType] = useState<"image/jpeg" | "image/png" | "image/webp">("image/jpeg");
  const [voiceId, setVoiceId] = useState<string>("");
  const [voiceoverScript, setVoiceoverScript] = useState("");
  const [videoDuration, setVideoDuration] = useState(30);
  const [product, setProduct] = useState("Hyperburn");

  // Validation state
  const [validation, setValidation] = useState<any>(null);
  const [isValidating, setIsValidating] = useState(false);

  // Job tracking
  const [activeJobIds, setActiveJobIds] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const portraitInputRef = useRef<HTMLInputElement>(null);

  // tRPC mutations
  const validatePortraitMutation = trpc.faceSwap.validatePortrait.useMutation();
  const uploadPortraitMutation = trpc.faceSwap.uploadPortrait.useMutation();
  const createJobMutation = trpc.faceSwap.create.useMutation();
  const pushToClickUpMutation = trpc.faceSwap.pushToClickUp.useMutation();
  const { data: jobList, refetch: refetchJobs } = trpc.faceSwap.list.useQuery();

  // Handle portrait file selection
  const handlePortraitSelect = useCallback((file: File) => {
    setPortraitFile(file);
    setValidation(null);

    const mimeType = file.type as "image/jpeg" | "image/png" | "image/webp";
    setPortraitMimeType(mimeType || "image/jpeg");

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setPortraitPreview(result);
      // Extract base64 data (strip data URI prefix)
      const base64 = result.split(",")[1];
      setPortraitBase64(base64);
    };
    reader.readAsDataURL(file);
  }, []);

  // Validate portrait
  const handleValidatePortrait = async () => {
    if (!portraitBase64) return;
    setIsValidating(true);
    setValidation(null);
    try {
      const result = await validatePortraitMutation.mutateAsync({
        portraitBase64,
        mimeType: portraitMimeType,
      });
      setValidation(result);
    } catch (err: any) {
      toast.error(`Validation failed: ${err.message}`);
    } finally {
      setIsValidating(false);
    }
  };

  // Estimate cost
  const estimatedCost = ((videoDuration / 60) * 2.16).toFixed(2);

  // Submit job
  const handleSubmit = async () => {
    if (!sourceVideoUrl) {
      toast.error("Missing source video — please enter a source video URL.");
      return;
    }
    if (!portraitBase64) {
      toast.error("Missing portrait — please upload a reference portrait.");
      return;
    }
    if (validation && !validation.passed) {
      toast.error("Portrait failed validation — please upload a portrait that meets all quality requirements.");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Upload portrait to S3
      const { url: portraitS3Url } = await uploadPortraitMutation.mutateAsync({
        base64: portraitBase64,
        mimeType: portraitMimeType,
        fileName: portraitFile?.name || "portrait.jpg",
      });

      // 2. Submit job
      const { jobId, estimatedCostUsd } = await createJobMutation.mutateAsync({
        sourceVideoUrl,
        portraitBase64,
        portraitMimeType,
        portraitS3Url,
        voiceId: voiceId || undefined,
        voiceoverScript: voiceoverScript || undefined,
        videoDurationSeconds: videoDuration,
      });

      setActiveJobIds(prev => [jobId, ...prev]);
      toast.success(`Character swap started — Job #${jobId} queued. Estimated cost: ${estimatedCostUsd}. This will take 3–10 minutes.`);

      // Reset form
      setSourceVideoUrl("");
      setPortraitFile(null);
      setPortraitPreview(null);
      setPortraitBase64(null);
      setValidation(null);
      setVoiceoverScript("");
      refetchJobs();
    } catch (err: any) {
      toast.error(`Failed to start job: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Push to ClickUp
  const handlePushToClickUp = async (jobId: number) => {
    try {
      const { taskUrl } = await pushToClickUpMutation.mutateAsync({ jobId, product, priority: "High" });
      toast.success(`Pushed to ClickUp — task created: ${taskUrl}`);
      refetchJobs();
    } catch (err: any) {
      toast.error(`ClickUp push failed: ${err.message}`);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-[#FF3838]/10 flex items-center justify-center">
            <UserRound className="w-5 h-5 text-[#FF3838]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Character Swap</h1>
            <p className="text-sm text-white/50">Replace the entire character in a UGC video using AI</p>
          </div>
        </div>

        {/* Cost/speed info bar */}
        <div className="flex flex-wrap gap-4 mt-4">
          <div className="flex items-center gap-2 bg-[#0D0F12] border border-white/10 rounded-lg px-3 py-2">
            <DollarSign className="w-4 h-4 text-green-400" />
            <span className="text-xs text-white/70">~$1.08 per 30s · ~$2.16 per 60s</span>
          </div>
          <div className="flex items-center gap-2 bg-[#0D0F12] border border-white/10 rounded-lg px-3 py-2">
            <Clock className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-white/70">3–10 min processing time</span>
          </div>
          <div className="flex items-center gap-2 bg-[#0D0F12] border border-white/10 rounded-lg px-3 py-2">
            <Zap className="w-4 h-4 text-yellow-400" />
            <span className="text-xs text-white/70">Powered by Magic Hour · Full body replacement</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── LEFT: Configuration ── */}
        <div className="space-y-5">
          {/* Source Video */}
          <div className="bg-[#0D0F12] border border-white/10 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Video className="w-4 h-4 text-[#FF3838]" />
              Source Video
            </h2>
            <p className="text-xs text-white/50 mb-3">
              Enter the URL of the winning UGC video you want to clone. Must be a direct video URL (MP4).
            </p>
            <input
              type="url"
              value={sourceVideoUrl}
              onChange={e => setSourceVideoUrl(e.target.value)}
              placeholder="https://example.com/winning-ugc-video.mp4"
              className="w-full bg-[#191B1F] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#FF3838]/50"
            />
            {sourceVideoUrl && (
              <video src={sourceVideoUrl} controls className="w-full rounded-lg mt-3 bg-black max-h-40" />
            )}
          </div>

          {/* Portrait Upload */}
          <div className="bg-[#0D0F12] border border-white/10 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Upload className="w-4 h-4 text-[#FF3838]" />
              Reference Portrait
            </h2>

            {/* Quality requirements */}
            <div className="bg-[#191B1F] rounded-lg p-3 mb-3 text-xs text-white/50 space-y-1">
              <p className="text-white/70 font-medium mb-1">Portrait Requirements:</p>
              <p>✓ Minimum 1080×1080px resolution</p>
              <p>✓ Front-facing (±15° max tilt)</p>
              <p>✓ Even, natural lighting — no harsh shadows</p>
              <p>✓ Neutral or slight smile expression</p>
              <p>✓ No glasses, hats, or heavy accessories</p>
              <p>✓ Single person, face clearly visible</p>
            </div>

            {/* Upload area */}
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                portraitPreview ? "border-white/20" : "border-white/10 hover:border-[#FF3838]/40"
              }`}
              onClick={() => portraitInputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file && file.type.startsWith("image/")) handlePortraitSelect(file);
              }}
            >
              {portraitPreview ? (
                <div className="flex flex-col items-center gap-3">
                  <img src={portraitPreview} alt="Portrait" className="w-32 h-32 object-cover rounded-xl border border-white/10" />
                  <p className="text-xs text-white/50">{portraitFile?.name}</p>
                  <p className="text-xs text-[#FF3838] hover:underline">Click to replace</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="w-8 h-8 text-white/20" />
                  <p className="text-sm text-white/50">Drop portrait here or click to upload</p>
                  <p className="text-xs text-white/30">JPG, PNG, or WebP</p>
                </div>
              )}
            </div>
            <input
              ref={portraitInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) handlePortraitSelect(file);
              }}
            />

            {/* Validate button */}
            {portraitBase64 && (
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-3 border-white/10 text-white/70 hover:bg-white/5"
                onClick={handleValidatePortrait}
                disabled={isValidating}
              >
                {isValidating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                {isValidating ? "Validating..." : "Validate Portrait Quality"}
              </Button>
            )}

            {/* Validation results */}
            {validation && (
              <div className={`mt-3 rounded-lg border p-3 ${validation.passed ? "border-green-500/30 bg-green-500/5" : "border-red-500/30 bg-red-500/5"}`}>
                <div className="flex items-center gap-2 mb-2">
                  {validation.passed
                    ? <CheckCircle2 className="w-4 h-4 text-green-400" />
                    : <XCircle className="w-4 h-4 text-red-400" />
                  }
                  <p className={`text-sm font-semibold ${validation.passed ? "text-green-400" : "text-red-400"}`}>
                    {validation.passed ? "Portrait Approved" : "Portrait Failed Validation"}
                  </p>
                </div>
                <p className="text-xs text-white/50 mb-2">{validation.summary}</p>
                {validation.checks?.map((check: any) => (
                  <PortraitCheckItem key={check.name} {...check} />
                ))}
              </div>
            )}
          </div>

          {/* Voiceover (Optional) */}
          <div className="bg-[#0D0F12] border border-white/10 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
              <Mic className="w-4 h-4 text-[#FF3838]" />
              New Voiceover
              <Badge className="text-xs bg-white/5 text-white/40 border-white/10">Optional</Badge>
            </h2>
            <p className="text-xs text-white/50 mb-3">
              Leave blank to keep the original audio. If provided, the new voiceover will replace the audio in the face-swapped video.
            </p>

            <div className="space-y-3">
              <Select value={voiceId} onValueChange={setVoiceId}>
                <SelectTrigger className="bg-[#191B1F] border-white/10 text-white/80">
                  <SelectValue placeholder="Select a voice..." />
                </SelectTrigger>
                <SelectContent className="bg-[#191B1F] border-white/10">
                  {ELEVENLABS_VOICES.map(v => (
                    <SelectItem key={v.id} value={v.id} className="text-white/80 focus:bg-white/5">
                      <span className="font-medium">{v.name}</span>
                      <span className="text-white/40 ml-2 text-xs">{v.description}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {voiceId && (
                <Textarea
                  value={voiceoverScript}
                  onChange={e => setVoiceoverScript(e.target.value)}
                  placeholder="Enter the new script for the voiceover..."
                  className="bg-[#191B1F] border-white/10 text-white/80 placeholder:text-white/30 min-h-[100px] resize-none"
                />
              )}
            </div>
          </div>

          {/* Video Duration + Product */}
          <div className="bg-[#0D0F12] border border-white/10 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-white mb-3">Job Settings</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/50 mb-1.5 block">Video Duration (seconds)</label>
                <Select value={videoDuration.toString()} onValueChange={v => setVideoDuration(parseInt(v))}>
                  <SelectTrigger className="bg-[#191B1F] border-white/10 text-white/80">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#191B1F] border-white/10">
                    <SelectItem value="15" className="text-white/80 focus:bg-white/5">15 seconds</SelectItem>
                    <SelectItem value="30" className="text-white/80 focus:bg-white/5">30 seconds</SelectItem>
                    <SelectItem value="45" className="text-white/80 focus:bg-white/5">45 seconds</SelectItem>
                    <SelectItem value="60" className="text-white/80 focus:bg-white/5">60 seconds</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1.5 block">Product</label>
                <Select value={product} onValueChange={setProduct}>
                  <SelectTrigger className="bg-[#191B1F] border-white/10 text-white/80">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#191B1F] border-white/10">
                    {["Hyperburn", "Thermosleep", "Hyperload", "Thermoburn", "Carb Control"].map(p => (
                      <SelectItem key={p} value={p} className="text-white/80 focus:bg-white/5">{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Cost estimate + Submit */}
          <div className="bg-[#0D0F12] border border-white/10 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-white/50">Estimated cost for this job</p>
                <p className="text-2xl font-bold text-white">${estimatedCost}</p>
                <p className="text-xs text-white/30">{videoDuration}s video · Magic Hour credits</p>
              </div>
              {voiceId && voiceoverScript && (
                <div className="text-right">
                  <p className="text-xs text-white/50">+ Voiceover</p>
                  <p className="text-sm font-semibold text-white">~$0.05</p>
                  <p className="text-xs text-white/30">ElevenLabs</p>
                </div>
              )}
            </div>

            <Button
              className="w-full bg-[#FF3838] hover:bg-[#FF3838]/80 text-white font-semibold"
              onClick={handleSubmit}
              disabled={isSubmitting || !sourceVideoUrl || !portraitBase64}
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Starting Job...</>
              ) : (
                <><UserRound className="w-4 h-4 mr-2" />Start Character Swap</>
              )}
            </Button>
            {!validation && portraitBase64 && (
              <p className="text-xs text-yellow-400/70 mt-2 text-center">
                ⚠ Portrait not validated — we recommend validating before submitting
              </p>
            )}
          </div>
        </div>

        {/* ── RIGHT: Job History ── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-white/40" />
              Job History
            </h2>
            <Button variant="ghost" size="sm" className="text-xs text-white/40 hover:text-white/70" onClick={() => refetchJobs()}>
              Refresh
            </Button>
          </div>

          {activeJobIds.length === 0 && (!jobList || jobList.length === 0) ? (
            <div className="bg-[#0D0F12] border border-white/10 rounded-xl p-10 text-center">
              <UserRound className="w-10 h-10 text-white/10 mx-auto mb-3" />
              <p className="text-sm text-white/40">No character swap jobs yet</p>
              <p className="text-xs text-white/20 mt-1">Submit a job on the left to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Active jobs first (from this session) */}
              {activeJobIds.map(jobId => (
                <JobCard key={jobId} jobId={jobId} product={product} onPushToClickUp={handlePushToClickUp} />
              ))}
              {/* Historical jobs */}
              {jobList?.filter(j => !activeJobIds.includes(j.id)).map(job => (
                <JobCard key={job.id} jobId={job.id} product={product} onPushToClickUp={handlePushToClickUp} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
