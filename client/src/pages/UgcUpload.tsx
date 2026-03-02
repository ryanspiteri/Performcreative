import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Upload, Loader2, Film, Sparkles, Users, ArrowRight,
  CheckCircle2, Clock, Zap, FileVideo, X, ChevronRight,
  Mic, FileText, Video
} from "lucide-react";
import { useLocation, Link } from "wouter";

const PRODUCTS = ["Hyperburn", "Thermosleep", "Hyperload", "Thermoburn", "Carb Control"];

const PIPELINE_STEPS = [
  { icon: Upload, label: "Upload Video", desc: "Drop your winning UGC" },
  { icon: Mic, label: "Transcribe", desc: "AI extracts the script" },
  { icon: FileText, label: "Blueprint", desc: "Winning structure mapped" },
  { icon: Sparkles, label: "Generate", desc: "Variants created at scale" },
  { icon: Film, label: "Character Swap", desc: "New talent, same energy" },
];

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function statusColor(status: string) {
  if (status === "completed") return "text-green-400 bg-green-400/10 border-green-400/20";
  if (status === "generating_variants" || status === "transcribing") return "text-yellow-400 bg-yellow-400/10 border-yellow-400/20";
  if (status === "blueprint_approved") return "text-blue-400 bg-blue-400/10 border-blue-400/20";
  return "text-gray-400 bg-gray-400/10 border-gray-400/20";
}

function statusLabel(status: string) {
  return status?.replace(/_/g, " ") || "unknown";
}

export default function UgcUpload() {
  const [, setLocation] = useLocation();
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [product, setProduct] = useState<string>("");
  const [audienceTag, setAudienceTag] = useState<string>("");
  const [desiredOutputVolume, setDesiredOutputVolume] = useState<number>(10);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: recentUploads = [] } = trpc.ugc.list.useQuery(undefined, {
    refetchInterval: 10000,
  });

  const processFile = useCallback((file: File) => {
    if (!file.type.startsWith("video/")) { toast.error("Please select a video file"); return; }
    if (file.size > 500 * 1024 * 1024) { toast.error("Video must be under 500MB"); return; }
    setVideoFile(file);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleUpload = async () => {
    if (!videoFile || !product) return;
    setUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append("video", videoFile);
      formData.append("product", product);
      if (audienceTag) formData.append("audienceTag", audienceTag);
      formData.append("desiredOutputVolume", desiredOutputVolume.toString());

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(p => Math.min(p + Math.random() * 15, 85));
      }, 400);

      const response = await fetch("/api/ugc/upload", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }

      const data = await response.json();
      toast.success("Video uploaded! Pipeline starting...");
      setTimeout(() => setLocation(`/ugc/${data.id}`), 500);
    } catch (error: any) {
      toast.error(`Upload failed: ${error.message}`);
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const canSubmit = !!videoFile && !!product && !uploading;

  return (
    <div className="min-h-screen bg-[#01040A]">
      <div className="max-w-5xl mx-auto px-6 py-10">

        {/* ── Page Header ── */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-2xl bg-[#FF3838]/15 border border-[#FF3838]/30 flex items-center justify-center">
              <Film className="w-5 h-5 text-[#FF3838]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">UGC Clone Engine</h1>
              <p className="text-gray-500 text-sm">Turn one winning video into dozens of unique UGC ads</p>
            </div>
          </div>

          {/* Pipeline steps */}
          <div className="flex items-center gap-0 overflow-x-auto pb-2">
            {PIPELINE_STEPS.map((step, idx) => {
              const Icon = step.icon;
              return (
                <div key={step.label} className="flex items-center shrink-0">
                  <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-white/3 border border-white/8">
                    <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center">
                      <Icon className="w-3.5 h-3.5 text-gray-400" />
                    </div>
                    <div>
                      <div className="text-white text-xs font-semibold">{step.label}</div>
                      <div className="text-gray-600 text-[10px]">{step.desc}</div>
                    </div>
                  </div>
                  {idx < PIPELINE_STEPS.length - 1 && (
                    <ChevronRight className="w-4 h-4 text-gray-700 mx-1 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* ── Upload Form (left, wider) ── */}
          <div className="lg:col-span-3 space-y-5">

            {/* Drop Zone */}
            <div
              onClick={() => !uploading && fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); if (!uploading) setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`relative rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200 overflow-hidden ${
                uploading ? "cursor-not-allowed opacity-60" :
                isDragging ? "border-[#FF3838]/60 bg-[#FF3838]/5 scale-[1.01]" :
                videoFile ? "border-green-500/40 bg-green-500/3" :
                "border-white/10 bg-white/2 hover:border-white/20 hover:bg-white/4"
              }`}
            >
              {videoFile ? (
                <div className="p-6 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0">
                    <FileVideo className="w-7 h-7 text-green-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-semibold truncate">{videoFile.name}</div>
                    <div className="text-gray-500 text-sm mt-0.5">{formatFileSize(videoFile.size)} · {videoFile.type.split("/")[1]?.toUpperCase()}</div>
                    {uploading && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                          <span>Uploading...</span>
                          <span>{Math.round(uploadProgress)}%</span>
                        </div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#FF3838] rounded-full transition-all duration-300"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  {!uploading && (
                    <button
                      onClick={e => { e.stopPropagation(); setVideoFile(null); }}
                      className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-500 hover:text-white transition-all shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <div className={`w-16 h-16 rounded-2xl border flex items-center justify-center mx-auto mb-4 transition-all ${
                    isDragging ? "bg-[#FF3838]/15 border-[#FF3838]/40" : "bg-white/5 border-white/10"
                  }`}>
                    <Upload className={`w-8 h-8 transition-colors ${isDragging ? "text-[#FF3838]" : "text-gray-500"}`} />
                  </div>
                  <div className="text-white font-bold text-lg mb-1">
                    {isDragging ? "Drop it here" : "Drop your winning UGC video"}
                  </div>
                  <div className="text-gray-500 text-sm mb-4">or click to browse your files</div>
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/8 text-xs text-gray-500">
                    <Film className="w-3.5 h-3.5" />
                    MP4, MOV, WEBM · Max 500MB
                  </div>
                </div>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={handleFileChange} disabled={uploading} />

            {/* Config fields */}
            <div className="rounded-2xl border border-white/8 bg-white/2 p-5 space-y-5">
              {/* Product */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#FF3838]/20 border border-[#FF3838]/30 flex items-center justify-center text-[10px] font-bold text-[#FF3838]">1</span>
                  Product
                </label>
                <Select value={product} onValueChange={setProduct} disabled={uploading}>
                  <SelectTrigger className="bg-[#01040A] border-white/10 text-white rounded-xl h-11">
                    <SelectValue placeholder="Select a product..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0D0F14] border-white/10">
                    {PRODUCTS.map(p => (
                      <SelectItem key={p} value={p} className="text-white hover:bg-white/5 focus:bg-white/5">{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Audience Tag */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#0347ED]/20 border border-[#0347ED]/30 flex items-center justify-center text-[10px] font-bold text-[#0347ED]">2</span>
                  Audience Tag
                  <span className="text-gray-600 font-normal text-xs">(optional)</span>
                </label>
                <Input
                  placeholder="e.g. busy mums, athletes, biohackers"
                  value={audienceTag}
                  onChange={e => setAudienceTag(e.target.value)}
                  className="bg-[#01040A] border-white/10 text-white placeholder:text-gray-600 rounded-xl h-11"
                  disabled={uploading}
                />
                <p className="text-xs text-gray-600">Guides variant generation toward specific audience archetypes</p>
              </div>

              {/* Output Volume */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-[10px] font-bold text-purple-400">3</span>
                  Output Volume
                </label>
                {/* Presets + custom input in one row */}
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    { label: "10", value: 10 },
                    { label: "25", value: 25 },
                    { label: "50", value: 50 },
                    { label: "100", value: 100 },
                  ].map(preset => (
                    <button
                      key={preset.value}
                      onClick={() => setDesiredOutputVolume(preset.value)}
                      disabled={uploading}
                      className={`px-4 py-2 rounded-xl border text-sm font-semibold transition-all ${
                        desiredOutputVolume === preset.value
                          ? "border-purple-500/50 bg-purple-500/10 text-purple-300"
                          : "border-white/8 bg-white/2 text-gray-400 hover:border-white/15 hover:text-white"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                  <div className="flex items-center gap-2 ml-1">
                    <Input
                      type="number"
                      min={1}
                      max={200}
                      value={desiredOutputVolume}
                      onChange={e => setDesiredOutputVolume(parseInt(e.target.value) || 1)}
                      className="bg-[#01040A] border-white/10 text-white rounded-xl h-9 w-24 text-sm"
                      disabled={uploading}
                    />
                    <span className="text-gray-600 text-xs whitespace-nowrap">custom (1–200)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Submit */}
            <Button
              onClick={handleUpload}
              disabled={!canSubmit}
              className="w-full h-13 bg-[#FF3838] hover:bg-[#FF3838]/90 text-white rounded-2xl text-base font-bold disabled:opacity-40 transition-all"
            >
              {uploading ? (
                <><Loader2 className="w-5 h-5 mr-2.5 animate-spin" />Uploading {Math.round(uploadProgress)}%...</>
              ) : (
                <><Sparkles className="w-5 h-5 mr-2.5" />Start Clone Pipeline<ArrowRight className="w-5 h-5 ml-2.5" /></>
              )}
            </Button>
          </div>

          {/* ── Right panel: info + recent uploads ── */}
          <div className="lg:col-span-2 space-y-5">
            {/* What happens next */}
            <div className="rounded-2xl border border-white/8 bg-white/2 p-5">
              <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-400" />
                What happens next
              </h3>
              <div className="space-y-3">
                {[
                  { icon: Mic, color: "text-blue-400", label: "Audio transcribed", desc: "Whisper extracts the full script in ~60s" },
                  { icon: FileText, color: "text-purple-400", label: "Blueprint extracted", desc: "Claude maps hook, body, CTA & pacing" },
                  { icon: Users, color: "text-green-400", label: "Variants generated", desc: "Scripts across 7 archetypes & 5 tones" },
                  { icon: Film, color: "text-[#FF3838]", label: "Character swap ready", desc: "Upload a portrait to clone the talent" },
                ].map(item => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="flex items-start gap-3">
                      <div className={`w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center shrink-0 mt-0.5`}>
                        <Icon className={`w-3.5 h-3.5 ${item.color}`} />
                      </div>
                      <div>
                        <div className="text-white text-xs font-semibold">{item.label}</div>
                        <div className="text-gray-600 text-[11px] mt-0.5 leading-tight">{item.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent uploads */}
            {(recentUploads as any[]).length > 0 && (
              <div className="rounded-2xl border border-white/8 bg-white/2 p-5">
                <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  Recent Uploads
                </h3>
                <div className="space-y-2">
                  {(recentUploads as any[]).slice(0, 6).map((upload: any) => (
                    <Link key={upload.id} href={`/ugc/${upload.id}`}>
                      <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-all cursor-pointer group border border-transparent hover:border-white/8">
                        <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                          <Video className="w-4 h-4 text-gray-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-white text-xs font-semibold truncate">{upload.product}</div>
                          <div className="text-gray-600 text-[10px]">#{upload.id}{upload.audienceTag ? ` · ${upload.audienceTag}` : ""}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold capitalize ${statusColor(upload.status)}`}>
                            {statusLabel(upload.status)}
                          </span>
                          <ChevronRight className="w-3.5 h-3.5 text-gray-700 group-hover:text-gray-400 transition-colors" />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Tips */}
            <div className="rounded-2xl border border-yellow-500/15 bg-yellow-500/3 p-5">
              <h3 className="text-yellow-400 font-bold text-xs mb-3 uppercase tracking-wide">💡 Best results</h3>
              <ul className="space-y-2">
                {[
                  "Use a 30–90s video with a clear hook and CTA",
                  "Talking-head style works best for character swap",
                  "Good lighting and clear audio = better transcription",
                  "Start with 10 variants to validate quality",
                ].map(tip => (
                  <li key={tip} className="flex items-start gap-2 text-[11px] text-gray-400">
                    <CheckCircle2 className="w-3 h-3 text-yellow-500/60 shrink-0 mt-0.5" />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
