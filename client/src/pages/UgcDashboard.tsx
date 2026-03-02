import { useState, useRef } from "react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Loader2, CheckCircle2, XCircle, Clock, Play, Send, UserRound,
  Upload, Mic, Video, DollarSign, ChevronRight, RefreshCw, Download, ExternalLink
} from "lucide-react";

// ─── Script Source Options ────────────────────────────────────────────────────
type ScriptSource = "variant" | "original" | "custom";

// ─── Character Swap Modal ─────────────────────────────────────────────────────
function CharacterSwapModal({
  open,
  onClose,
  variant,
  originalTranscript,
  uploadId,
  product,
}: {
  open: boolean;
  onClose: () => void;
  variant: any;
  originalTranscript: string;
  uploadId: number;
  product: string;
}) {
  const [scriptSource, setScriptSource] = useState<ScriptSource>("variant");
  const [customScript, setCustomScript] = useState("");
  const [accent, setAccent] = useState<"australian" | "american">("australian");
  const [voiceId, setVoiceId] = useState("");
  const [portraitFile, setPortraitFile] = useState<File | null>(null);
  const [portraitPreview, setPortraitPreview] = useState<string | null>(null);
  const [portraitBase64, setPortraitBase64] = useState<string | null>(null);
  const [portraitMimeType, setPortraitMimeType] = useState<"image/jpeg" | "image/png" | "image/webp">("image/jpeg");
  const [portraitS3Url, setPortraitS3Url] = useState<string | null>(null);
  const [validation, setValidation] = useState<any>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const portraitInputRef = useRef<HTMLInputElement>(null);

  // Voices filtered by accent
  const { data: voices = [], isLoading: voicesLoading } = trpc.faceSwap.getVoicesByAccent.useQuery(
    { accent },
    { enabled: open }
  );

  // Portrait upload mutation
  const uploadPortraitMutation = trpc.faceSwap.uploadPortrait.useMutation();

  // Validate portrait mutation
  const validatePortraitMutation = trpc.faceSwap.validatePortrait.useMutation();

  // Create face swap job mutation
  const createJobMutation = trpc.faceSwap.create.useMutation();

  // Determine the active script text
  const activeScript =
    scriptSource === "variant"
      ? variant?.scriptText || ""
      : scriptSource === "original"
      ? originalTranscript || ""
      : customScript;

  // Estimated cost based on variant runtime
  const runtimeSec = variant?.runtime || 30;
  const estimatedCost = runtimeSec <= 30 ? "$1.08" : runtimeSec <= 60 ? "$2.16" : "$3.24";

  const handlePortraitChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Portrait must be under 10MB"); return; }

    setPortraitFile(file);
    setValidation(null);
    setPortraitS3Url(null);

    const mimeType = file.type as "image/jpeg" | "image/png" | "image/webp";
    setPortraitMimeType(mimeType);

    const preview = URL.createObjectURL(file);
    setPortraitPreview(preview);

    // Convert to base64
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      const base64 = dataUrl.split(",")[1];
      setPortraitBase64(base64);

      // Upload to S3
      setIsUploading(true);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const uint8 = new Uint8Array(arrayBuffer);
        const binaryStr = Array.from(uint8).map(b => String.fromCharCode(b)).join("");
        const b64 = btoa(binaryStr);
        const { url } = await uploadPortraitMutation.mutateAsync({ base64: b64, mimeType });
        setPortraitS3Url(url);

        // Auto-validate
        setIsValidating(true);
        try {
          const result = await validatePortraitMutation.mutateAsync({ portraitBase64: b64, mimeType });
          setValidation(result);
        } catch (err: any) {
          toast.error(`Validation failed: ${err.message}`);
        } finally {
          setIsValidating(false);
        }
      } catch (err: any) {
        toast.error(`Upload failed: ${err.message}`);
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!activeScript.trim()) { toast.error("Please provide a script"); return; }
    if (!portraitBase64 || !portraitS3Url) { toast.error("Please upload a portrait photo"); return; }
    if (!voiceId) { toast.error("Please select a voice"); return; }
    if (validation && !validation.passed) { toast.error("Portrait failed quality check — please upload a better photo"); return; }

    setIsSubmitting(true);
    try {
      const { jobId, estimatedCostUsd } = await createJobMutation.mutateAsync({
        sourceVideoUrl: "", // Will use the upload's video URL server-side via ugcVariantId
        portraitBase64,
        portraitMimeType,
        portraitS3Url,
        voiceId,
        voiceoverScript: activeScript,
        ugcVariantId: variant?.id,
        videoDurationSeconds: runtimeSec,
      });
      toast.success(`Character swap started — Job #${jobId}. Est. cost: ${estimatedCostUsd}. Takes 3–10 min.`);
      onClose();
    } catch (err: any) {
      toast.error(`Failed to start job: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setScriptSource("variant");
    setCustomScript("");
    setAccent("australian");
    setVoiceId("");
    setPortraitFile(null);
    setPortraitPreview(null);
    setPortraitBase64(null);
    setPortraitS3Url(null);
    setValidation(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-[#0D0F12] border-white/10 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Video className="w-5 h-5 text-[#FF3838]" />
            Character Swap — Variant #{variant?.variantNumber}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Generate a new video with a different character using the selected script and voice.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Step 1: Script Source */}
          <div className="space-y-3">
            <Label className="text-white font-semibold">1. Choose Script</Label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: "variant", label: "Variant Script", desc: "Generated variant" },
                { value: "original", label: "Original Script", desc: "From source video" },
                { value: "custom", label: "Write My Own", desc: "Paste or type" },
              ] as { value: ScriptSource; label: string; desc: string }[]).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setScriptSource(opt.value)}
                  className={`p-3 rounded border text-left transition-all ${
                    scriptSource === opt.value
                      ? "border-[#FF3838] bg-[#FF3838]/10"
                      : "border-white/10 bg-[#01040A] hover:border-white/20"
                  }`}
                >
                  <div className="text-sm font-medium text-white">{opt.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>

            {/* Script preview / editor */}
            <div className="space-y-1">
              {scriptSource === "custom" ? (
                <Textarea
                  value={customScript}
                  onChange={e => setCustomScript(e.target.value)}
                  placeholder="Paste or type your script here..."
                  className="bg-[#01040A] border-white/10 text-white placeholder:text-gray-600 min-h-[120px] resize-none"
                />
              ) : (
                <div className="bg-[#01040A] border border-white/10 rounded p-3 text-sm text-gray-300 whitespace-pre-wrap max-h-[120px] overflow-y-auto">
                  {activeScript || <span className="text-gray-600 italic">No script available</span>}
                </div>
              )}
            </div>
          </div>

          {/* Step 2: Accent + Voice */}
          <div className="space-y-3">
            <Label className="text-white font-semibold">2. Choose Accent & Voice</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-gray-400">Accent</Label>
                <div className="flex gap-2">
                  {(["australian", "american"] as const).map(a => (
                    <button
                      key={a}
                      onClick={() => { setAccent(a); setVoiceId(""); }}
                      className={`flex-1 py-2 px-3 rounded border text-sm font-medium transition-all ${
                        accent === a
                          ? "border-[#0347ED] bg-[#0347ED]/10 text-white"
                          : "border-white/10 bg-[#01040A] text-gray-400 hover:border-white/20"
                      }`}
                    >
                      {a === "australian" ? "🇦🇺 Australian" : "🇺🇸 American"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-gray-400">Voice</Label>
                <Select value={voiceId} onValueChange={setVoiceId} disabled={voicesLoading}>
                  <SelectTrigger className="bg-[#01040A] border-white/10 text-white">
                    <SelectValue placeholder={voicesLoading ? "Loading voices..." : "Select a voice"} />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0D0F12] border-white/10">
                    {voices.map((v: any) => (
                      <SelectItem key={v.id} value={v.id} className="text-white hover:bg-white/5">
                        <span className="font-medium">{v.name}</span>
                        <span className="text-gray-500 text-xs ml-2">{v.gender} · {v.age}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Step 3: Portrait Upload */}
          <div className="space-y-3">
            <Label className="text-white font-semibold">3. Upload Reference Portrait</Label>
            <div
              onClick={() => portraitInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
                portraitFile ? "border-white/20 bg-[#01040A]" : "border-white/10 hover:border-white/20 bg-[#01040A]"
              }`}
            >
              {portraitPreview ? (
                <div className="flex items-center gap-4">
                  <img src={portraitPreview} alt="Portrait" className="w-20 h-20 rounded-lg object-cover border border-white/10" />
                  <div className="text-left">
                    <div className="text-white text-sm font-medium">{portraitFile?.name}</div>
                    <div className="text-gray-500 text-xs mt-1">
                      {isUploading ? "Uploading to S3..." : isValidating ? "Validating..." : portraitS3Url ? "Uploaded ✓" : ""}
                    </div>
                    {(isUploading || isValidating) && <Loader2 className="w-4 h-4 animate-spin text-gray-400 mt-1" />}
                  </div>
                </div>
              ) : (
                <div>
                  <Upload className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                  <div className="text-gray-400 text-sm">Click to upload portrait photo</div>
                  <div className="text-gray-600 text-xs mt-1">JPG, PNG or WEBP · Min 1080×1080px</div>
                </div>
              )}
            </div>
            <input
              ref={portraitInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handlePortraitChange}
            />

            {/* Validation Results */}
            {validation && (
              <div className={`p-3 rounded border ${validation.passed ? "border-green-600/30 bg-green-600/5" : "border-red-600/30 bg-red-600/5"}`}>
                <div className={`text-sm font-semibold mb-2 ${validation.passed ? "text-green-400" : "text-red-400"}`}>
                  {validation.passed ? "✓ Portrait passed quality check" : "✗ Portrait failed quality check"}
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {validation.checks?.map((check: any) => (
                    <div key={check.criterion} className="flex items-center gap-1.5 text-xs">
                      {check.passed
                        ? <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0" />
                        : <XCircle className="w-3 h-3 text-red-400 shrink-0" />}
                      <span className={check.passed ? "text-gray-400" : "text-red-300"}>{check.criterion}</span>
                    </div>
                  ))}
                </div>
                {validation.feedback && (
                  <div className="text-xs text-gray-500 mt-2">{validation.feedback}</div>
                )}
              </div>
            )}

            {/* Quality guidelines */}
            {!validation && (
              <div className="text-xs text-gray-600 space-y-0.5">
                <div>Requirements: min 1080×1080px · front-facing ±15° · even lighting · neutral expression · no glasses or hats</div>
              </div>
            )}
          </div>

          {/* Cost + Submit */}
          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <div className="flex items-center gap-1.5 text-sm text-gray-400">
              <DollarSign className="w-4 h-4" />
              Est. cost: <span className="text-white font-semibold">{estimatedCost}</span>
              <span className="text-gray-600">· ~{runtimeSec}s video · Magic Hour</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose} className="border-white/10 text-white hover:bg-white/5">
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || isUploading || isValidating || !portraitS3Url || !voiceId || !activeScript.trim()}
                className="bg-[#FF3838] hover:bg-[#FF3838]/90 text-white"
              >
                {isSubmitting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Starting...</>
                ) : (
                  <><Video className="w-4 h-4 mr-2" />Start Character Swap</>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Character Swap Jobs Panel ────────────────────────────────────────────────
function CharacterSwapJobsPanel({ uploadId, product }: { uploadId: number; product: string }) {
  const { data: jobs = [], refetch } = trpc.faceSwap.list.useQuery(undefined, {
      refetchInterval: (data: any) => {
        const arr = Array.isArray(data) ? data : [];
        const hasRunning = arr.some((j: any) => j.status === "processing" || j.status === "pending");
        return hasRunning ? 5000 : false;
      },
    }
  );

  const pushMutation = trpc.faceSwap.pushToClickUp.useMutation({
    onSuccess: ({ taskUrl }) => {
      toast.success(`Pushed to ClickUp — ${taskUrl}`);
      refetch();
    },
    onError: (err) => toast.error(`ClickUp push failed: ${err.message}`),
  });

  if (!jobs.length) return null;

  return (
    <Card className="bg-[#0D0F12] border-white/10 mt-6">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Video className="w-5 h-5 text-[#FF3838]" />
          Character Swap Jobs
        </CardTitle>
        <CardDescription className="text-gray-400">
          {jobs.length} job{jobs.length !== 1 ? "s" : ""} · Magic Hour full-body character swap
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {jobs.map((job: any) => (
          <div key={job.id} className="p-4 bg-[#01040A] rounded border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Badge
                  variant={job.status === "completed" ? "default" : job.status === "failed" ? "destructive" : "secondary"}
                  className="text-xs"
                >
                  {job.status === "processing" && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                  {job.status}
                </Badge>
                <span className="text-gray-400 text-xs">Job #{job.id}</span>
                {job.estimatedCostUsd && (
                  <span className="text-gray-500 text-xs">{job.estimatedCostUsd}</span>
                )}
              </div>
              <div className="flex gap-2">
                {job.status === "completed" && job.outputVideoUrl && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      asChild
                      className="border-white/10 text-white hover:bg-white/5 h-7 text-xs"
                    >
                      <a href={job.outputVideoUrl} download target="_blank" rel="noreferrer">
                        <Download className="w-3 h-3 mr-1" />Download
                      </a>
                    </Button>
                    {!job.clickupTaskId && (
                      <Button
                        size="sm"
                        onClick={() => pushMutation.mutate({ jobId: job.id, product, priority: "High" })}
                        disabled={pushMutation.isPending}
                        className="bg-[#0347ED] hover:bg-[#0347ED]/90 text-white h-7 text-xs"
                      >
                        <Send className="w-3 h-3 mr-1" />Push to ClickUp
                      </Button>
                    )}
                    {job.clickupTaskId && (
                      <Button size="sm" variant="outline" asChild className="border-green-600/30 text-green-400 h-7 text-xs">
                        <a href={job.clickupTaskUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="w-3 h-3 mr-1" />View in ClickUp
                        </a>
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
            {job.status === "completed" && job.outputVideoUrl && (
              <video
                src={job.outputVideoUrl}
                controls
                className="w-full max-w-md rounded border border-white/10 mt-2"
              />
            )}
            {job.errorMessage && (
              <div className="text-red-400 text-xs mt-1">{job.errorMessage}</div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function UgcDashboard() {
  const [, params] = useRoute("/ugc/:id");
  const uploadId = parseInt(params?.id || "0");

  const [selectedVariants, setSelectedVariants] = useState<number[]>([]);
  const [swapModalVariant, setSwapModalVariant] = useState<any>(null);

  const { data, isLoading, refetch } = trpc.ugc.get.useQuery({ id: uploadId }, {
    enabled: uploadId > 0,
    refetchInterval: (queryData) => {
      const status = (queryData as any)?.upload?.status;
      if (status === "transcribing" || status === "structure_extracted" || status === "generating_variants") {
        return 3000;
      }
      return false;
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
      <div className="p-8 flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!data?.upload) {
    return (
      <div className="p-8">
        <div className="text-center text-gray-400">Upload not found</div>
      </div>
    );
  }

  const { upload, variants } = data;
  const blueprint = upload.structureBlueprint as any;
  const originalTranscript = upload.transcript || "";

  const toggleVariant = (id: number) => {
    setSelectedVariants((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );
  };

  const selectAll = () => setSelectedVariants(variants.map((v: any) => v.id));
  const deselectAll = () => setSelectedVariants([]);

  const approvedVariants = variants.filter((v: any) => v.status === "approved");
  const awaitingApproval = variants.filter((v: any) => v.status === "generated" || v.status === "awaiting_approval");

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">UGC Clone Dashboard</h1>
        <p className="text-gray-400">Upload #{uploadId} — {upload.product}</p>
      </div>

      {/* Upload Status Card */}
      <Card className="bg-[#0D0F12] border-white/10 mb-6">
        <CardHeader>
          <CardTitle className="text-white">Upload Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-gray-500 mb-1">Status</div>
              <Badge variant={upload.status === "completed" ? "default" : "secondary"}>
                {upload.status}
              </Badge>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Product</div>
              <div className="text-white">{upload.product}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Audience</div>
              <div className="text-white">{upload.audienceTag || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Desired Volume</div>
              <div className="text-white">{upload.desiredOutputVolume}</div>
            </div>
          </div>

          {upload.videoUrl && (
            <div>
              <div className="text-xs text-gray-500 mb-2">Video</div>
              <video
                src={upload.videoUrl}
                controls
                className="w-full max-w-md rounded-lg border border-white/10"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Structure Blueprint Card */}
      {blueprint && (
        <Card className="bg-[#0D0F12] border-white/10 mb-6">
          <CardHeader>
            <CardTitle className="text-white">Structure Blueprint</CardTitle>
            <CardDescription className="text-gray-400">
              Extracted winning structure from the original video
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm font-semibold text-white mb-1">Hook ({blueprint.hook?.strength})</div>
              <div className="text-gray-300 text-sm bg-[#01040A] p-3 rounded border border-white/5">
                {blueprint.hook?.text}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {blueprint.hook?.startTime}s - {blueprint.hook?.endTime}s
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold text-white mb-1">Body</div>
              <div className="text-gray-300 text-sm bg-[#01040A] p-3 rounded border border-white/5">
                {blueprint.body?.text}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Key Points: {blueprint.body?.keyPoints?.join(", ")}
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold text-white mb-1">CTA ({blueprint.cta?.urgency} urgency)</div>
              <div className="text-gray-300 text-sm bg-[#01040A] p-3 rounded border border-white/5">
                {blueprint.cta?.text}
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold text-white mb-1">Pacing</div>
              <div className="text-gray-300 text-sm">
                {blueprint.pacing?.wordsPerMinute} WPM · {blueprint.pacing?.energyLevel} energy · {blueprint.pacing?.pauseCount} pauses
              </div>
            </div>

            {!upload.blueprintApprovedAt && (
              <Button
                onClick={() => approveBlueprint.mutate({ uploadId })}
                disabled={approveBlueprint.isPending}
                className="bg-[#FF3838] hover:bg-[#FF3838]/90 text-white"
              >
                {approveBlueprint.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Approving...</>
                ) : (
                  <><CheckCircle2 className="w-4 h-4 mr-2" />Approve Blueprint & Generate Variants</>
                )}
              </Button>
            )}

            {upload.blueprintApprovedAt && upload.status === "blueprint_approved" && (
              <Button
                onClick={() => generateVariants.mutate({ uploadId })}
                disabled={generateVariants.isPending}
                className="bg-[#0347ED] hover:bg-[#0347ED]/90 text-white"
              >
                {generateVariants.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Starting...</>
                ) : (
                  <><Play className="w-4 h-4 mr-2" />Start Variant Generation</>
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Variants Card */}
      {variants.length > 0 && (
        <Card className="bg-[#0D0F12] border-white/10">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white">Generated Variants</CardTitle>
                <CardDescription className="text-gray-400">
                  {variants.length} variants · {approvedVariants.length} approved · {awaitingApproval.length} awaiting approval
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAll} className="border-white/10 text-white hover:bg-white/5">
                  Select All
                </Button>
                <Button variant="outline" size="sm" onClick={deselectAll} className="border-white/10 text-white hover:bg-white/5">
                  Deselect All
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Bulk Actions */}
            {selectedVariants.length > 0 && (
              <div className="mb-4 p-4 bg-[#01040A] rounded border border-white/10 flex items-center justify-between">
                <div className="text-white">{selectedVariants.length} variants selected</div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => approveVariants.mutate({ variantIds: selectedVariants })}
                    disabled={approveVariants.isPending}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1" />Approve Selected
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => rejectVariants.mutate({ variantIds: selectedVariants })}
                    disabled={rejectVariants.isPending}
                    className="border-red-600 text-red-600 hover:bg-red-600/10"
                  >
                    <XCircle className="w-4 h-4 mr-1" />Reject Selected
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => pushToClickup.mutate({ variantIds: selectedVariants })}
                    disabled={pushToClickup.isPending}
                    className="bg-[#0347ED] hover:bg-[#0347ED]/90 text-white"
                  >
                    <Send className="w-4 h-4 mr-1" />Push to ClickUp
                  </Button>
                </div>
              </div>
            )}

            {/* Variants List */}
            <div className="space-y-3">
              {variants.map((variant: any) => (
                <div
                  key={variant.id}
                  className="p-4 bg-[#01040A] rounded border border-white/10 hover:border-white/20 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selectedVariants.includes(variant.id)}
                      onCheckedChange={() => toggleVariant(variant.id)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="text-white font-semibold">Variant #{variant.variantNumber}</div>
                          <Badge variant="outline" className="text-xs">{variant.actorArchetype}</Badge>
                          <Badge variant="outline" className="text-xs">{variant.voiceTone}</Badge>
                          <Badge variant="outline" className="text-xs">{variant.energyLevel} energy</Badge>
                          <Badge
                            variant={
                              variant.status === "approved" ? "default"
                              : variant.status === "rejected" ? "destructive"
                              : "secondary"
                            }
                            className="text-xs"
                          >
                            {variant.status}
                          </Badge>
                        </div>
                        {/* Character Swap Button — available for all variants */}
                        <Button
                          size="sm"
                          onClick={() => setSwapModalVariant(variant)}
                          className="bg-[#FF3838]/10 hover:bg-[#FF3838]/20 text-[#FF3838] border border-[#FF3838]/30 hover:border-[#FF3838]/50 shrink-0 ml-2"
                        >
                          <Video className="w-3.5 h-3.5 mr-1.5" />
                          Character Swap
                        </Button>
                      </div>
                      <div className="text-gray-300 text-sm mb-2 whitespace-pre-wrap">
                        {variant.scriptText}
                      </div>
                      <div className="text-xs text-gray-500">
                        Runtime: ~{variant.runtime}s
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {upload.status === "generating_variants" && variants.length === 0 && (
        <Card className="bg-[#0D0F12] border-white/10">
          <CardContent className="py-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-4" />
            <div className="text-white font-semibold mb-2">Generating Variants...</div>
            <div className="text-gray-400 text-sm">
              This may take a few minutes depending on the desired output volume
            </div>
          </CardContent>
        </Card>
      )}

      {/* Character Swap Jobs Panel */}
      <CharacterSwapJobsPanel uploadId={uploadId} product={upload.product} />

      {/* Character Swap Modal */}
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
