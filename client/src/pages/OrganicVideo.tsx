import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Upload,
  Loader2,
  CheckCircle,
  Circle,
  Play,
  Copy,
  AlertCircle,
  ChevronRight,
  Ban,
  X,
  ChevronUp,
  ChevronDown,
  Film,
} from "lucide-react";

const PILLARS = [
  "PTC Value",
  "Story",
  "Edutaining",
  "Trends",
  "Sale",
  "Motivation",
  "Life Dump",
  "Workout",
];

const PURPOSES = ["Educate", "Inspire", "Entertain", "Sell", "Connect"];

const SUBTITLE_STYLES = [
  { id: "hormozi", label: "Hormozi Bold", description: "Large bold yellow/white text, center screen" },
  { id: "minimal", label: "Minimal Clean", description: "Small white text, bottom third" },
  { id: "karaoke", label: "Karaoke Highlight", description: "Word-by-word highlight, colored active word" },
  { id: "none", label: "No Subtitles", description: "Skip subtitle burn-in" },
];

const PIPELINE_STAGES = [
  { key: "uploading", label: "Uploading" },
  { key: "concatenating", label: "Concatenating Clips" },
  { key: "editing", label: "Auto Editing" },
  { key: "transcribing", label: "Transcribing" },
  { key: "reviewing", label: "Transcript Review" },
  { key: "subtitling", label: "Burning Subtitles" },
  { key: "captioning", label: "Generating Captions" },
  { key: "completed", label: "Completed" },
] as const;

type PlatformTab = "instagram" | "tiktok" | "linkedin";

type InputMode = "upload" | "path";

interface UploadedVideo {
  id: string;
  fileName: string;
  url: string;
  progress: number;
  status: "uploading" | "complete" | "error";
  error?: string;
}

function uploadFile(
  file: File,
  onProgress: (pct: number) => void,
): Promise<{ url: string }> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("video", file);
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", (evt) => {
      if (evt.lengthComputable) {
        onProgress(Math.round((evt.loaded / evt.total) * 100));
      }
    });
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        let msg = "Upload failed";
        try { msg = JSON.parse(xhr.responseText)?.error || msg; } catch {}
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.open("POST", "/api/organic/upload-video");
    xhr.send(formData);
  });
}

export default function OrganicVideo() {
  // Form state
  const [inputMode, setInputMode] = useState<InputMode>("upload");
  const [sourcePath, setSourcePath] = useState("");
  const [uploadedVideos, setUploadedVideos] = useState<UploadedVideo[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [subtitleStyle, setSubtitleStyle] = useState("hormozi");
  const [pillar, setPillar] = useState("");
  const [purpose, setPurpose] = useState("");
  const [topic, setTopic] = useState("");

  // Pipeline state
  const [runId, setRunId] = useState<number | null>(null);
  const [editedTranscript, setEditedTranscript] = useState("");
  const [captionTab, setCaptionTab] = useState<PlatformTab>("instagram");

  // Health check
  const healthQuery = trpc.organic.checkAutoEditHealth.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const completedVideos = uploadedVideos.filter((v) => v.status === "complete");

  // Multi-file upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    // Reset file input so re-selecting the same files works
    e.target.value = "";

    setIsUploading(true);

    for (const file of files) {
      if (file.size > 500 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 500MB)`);
        continue;
      }

      const id = crypto.randomUUID();
      setUploadedVideos((prev) => [
        ...prev,
        { id, fileName: file.name, url: "", progress: 0, status: "uploading" },
      ]);

      try {
        const result = await uploadFile(file, (pct) => {
          setUploadedVideos((prev) =>
            prev.map((v) => (v.id === id ? { ...v, progress: pct } : v)),
          );
        });
        setUploadedVideos((prev) =>
          prev.map((v) =>
            v.id === id ? { ...v, url: result.url, status: "complete", progress: 100 } : v,
          ),
        );
      } catch (err: any) {
        setUploadedVideos((prev) =>
          prev.map((v) =>
            v.id === id ? { ...v, status: "error", error: err.message } : v,
          ),
        );
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    setIsUploading(false);
  };

  const removeVideo = (id: string) => {
    setUploadedVideos((prev) => prev.filter((v) => v.id !== id));
  };

  const moveVideo = (idx: number, direction: "up" | "down") => {
    setUploadedVideos((prev) => {
      const next = [...prev];
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= next.length) return prev;
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return next;
    });
  };

  // Trigger mutation
  const triggerVideo = trpc.organic.triggerVideo.useMutation({
    onSuccess: (data: { runId: number }) => {
      setRunId(data.runId);
      toast.success("Pipeline started");
    },
    onError: (err: any) => {
      toast.error(`Failed to start pipeline: ${err.message}`);
    },
  });

  // Poll run status
  const runQuery = trpc.organic.getRun.useQuery(
    { id: runId! },
    {
      enabled: !!runId,
      refetchInterval: (query: any) => {
        const status = query.state.data?.status;
        return status === "running" || status === "pending" ? 2000 : false;
      },
    }
  );

  // Approve transcript mutation
  const approveTranscript = trpc.organic.approveTranscript.useMutation({
    onSuccess: () => {
      toast.success("Transcript approved");
    },
    onError: (err: any) => {
      toast.error(`Failed to approve: ${err.message}`);
    },
  });

  const runData = runQuery.data;
  const currentStage = runData?.stage || null;
  const isRunning = runData?.status === "running" || runData?.status === "pending";
  const isCompleted = runData?.status === "completed";
  const isFailed = runData?.status === "failed";

  // When transcription arrives, populate the editor
  const transcriptionText = runData?.transcription ? (typeof runData.transcription === "string" ? runData.transcription : JSON.stringify(runData.transcription)) : null;
  if (transcriptionText && !editedTranscript && currentStage === "reviewing") {
    setEditedTranscript(transcriptionText);
  }

  const handleStart = () => {
    let videoInputPaths: string[];

    if (inputMode === "upload") {
      videoInputPaths = completedVideos.map((v) => v.url);
      if (videoInputPaths.length === 0) {
        toast.error("Please upload at least one video");
        return;
      }
    } else {
      const p = sourcePath.trim();
      if (!p) {
        toast.error("Please enter a source video path");
        return;
      }
      videoInputPaths = [p];
    }

    if (!pillar) {
      toast.error("Please select a content pillar");
      return;
    }
    if (!purpose) {
      toast.error("Please select a content purpose");
      return;
    }

    triggerVideo.mutate({
      videoInputPaths,
      subtitleStyle,
      contentPillar: pillar,
      contentPurpose: purpose,
      topic: topic.trim() || undefined,
    });
  };

  const handleApproveTranscript = () => {
    if (!runId) return;
    approveTranscript.mutate({ runId });
  };

  const handleSkipSubtitles = () => {
    if (!runId) return;
    approveTranscript.mutate({ runId });
  };

  const handleCopyCaption = (text: string, platform: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${platform} caption copied`);
  };

  const getStageIndex = (stage: string | null): number => {
    if (!stage) return -1;
    return PIPELINE_STAGES.findIndex((s) => s.key === stage);
  };

  const stageIdx = getStageIndex(currentStage);

  return (
    <div className="min-h-screen bg-[#01040A]">
      <div className="p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Organic Video Pipeline</h1>
          <p className="text-gray-400 text-sm">
            Upload clips, auto-edit, transcribe, subtitle, and caption organic content
          </p>
        </div>

        <div className="flex gap-6">
          {/* LEFT PANEL - Controls */}
          <div className="w-[400px] shrink-0 space-y-5">
            {/* Source Video */}
            <div className="bg-[#0D0F12] rounded-xl border border-white/5 p-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 block">
                  Source Videos
                </label>
                {/* Mode toggle */}
                <div className="flex gap-1 mb-3 bg-white/5 rounded-lg p-1">
                  <button
                    onClick={() => setInputMode("upload")}
                    className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${
                      inputMode === "upload" ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    Upload Files
                  </button>
                  <button
                    onClick={() => setInputMode("path")}
                    className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${
                      inputMode === "path" ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    Local Path
                  </button>
                </div>

                {inputMode === "upload" ? (
                  <div className="space-y-2">
                    {/* Uploaded videos list */}
                    {uploadedVideos.length > 0 && (
                      <div className="space-y-1.5">
                        {uploadedVideos.map((video, idx) => (
                          <div
                            key={video.id}
                            className={`flex items-center gap-2 rounded-lg px-3 py-2 ${
                              video.status === "complete"
                                ? "bg-green-500/10 border border-green-500/20"
                                : video.status === "error"
                                ? "bg-red-500/10 border border-red-500/20"
                                : "bg-white/5 border border-white/10"
                            }`}
                          >
                            {/* Reorder buttons */}
                            <div className="flex flex-col shrink-0">
                              <button
                                onClick={() => moveVideo(idx, "up")}
                                disabled={idx === 0}
                                className="text-gray-500 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed"
                              >
                                <ChevronUp className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => moveVideo(idx, "down")}
                                disabled={idx === uploadedVideos.length - 1}
                                className="text-gray-500 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed"
                              >
                                <ChevronDown className="w-3 h-3" />
                              </button>
                            </div>

                            {/* Status icon */}
                            {video.status === "complete" ? (
                              <CheckCircle className="w-3.5 h-3.5 text-green-400 shrink-0" />
                            ) : video.status === "error" ? (
                              <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                            ) : (
                              <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin shrink-0" />
                            )}

                            {/* File name + progress */}
                            <div className="flex-1 min-w-0">
                              <span className={`text-xs truncate block ${
                                video.status === "complete" ? "text-green-300" :
                                video.status === "error" ? "text-red-300" : "text-gray-300"
                              }`}>
                                {video.fileName}
                              </span>
                              {video.status === "uploading" && (
                                <div className="w-full bg-white/5 rounded-full h-1 mt-1">
                                  <div
                                    className="bg-red-500 h-1 rounded-full transition-all"
                                    style={{ width: `${video.progress}%` }}
                                  />
                                </div>
                              )}
                              {video.status === "error" && video.error && (
                                <span className="text-[10px] text-red-400/70 block">{video.error}</span>
                              )}
                            </div>

                            {/* Clip number */}
                            <span className="text-[10px] text-gray-600 shrink-0">
                              #{idx + 1}
                            </span>

                            {/* Remove button */}
                            <button
                              onClick={() => removeVideo(video.id)}
                              className="text-gray-500 hover:text-white shrink-0"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Upload dropzone */}
                    <label className="flex flex-col items-center gap-2 border-2 border-dashed border-white/10 rounded-lg p-4 cursor-pointer hover:border-white/20 transition-colors">
                      <Upload className="w-5 h-5 text-gray-500" />
                      <span className="text-xs text-gray-400">
                        {uploadedVideos.length > 0 ? "Add more clips" : "Click to upload videos"}
                      </span>
                      <span className="text-[10px] text-gray-600">MP4, MOV, AVI, MKV, WebM (max 500MB each)</span>
                      <input
                        type="file"
                        accept="video/mp4,video/quicktime,video/avi,video/x-matroska,video/webm"
                        multiple
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>

                    {/* Clip count */}
                    {completedVideos.length > 0 && (
                      <div className="flex items-center gap-1.5 px-1">
                        <Film className="w-3 h-3 text-gray-500" />
                        <span className="text-[10px] text-gray-500">
                          {completedVideos.length} clip{completedVideos.length !== 1 ? "s" : ""} ready
                          {completedVideos.length > 1 ? " — will be concatenated in order shown" : ""}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <Input
                    value={sourcePath}
                    onChange={(e) => setSourcePath(e.target.value)}
                    placeholder="/path/to/source-video.mp4"
                    className="bg-white/5 border-white/10 text-white placeholder:text-gray-600"
                  />
                )}
              </div>

              {/* Subtitle Style */}
              <div>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 block">
                  Subtitle Style
                </label>
                <Select value={subtitleStyle} onValueChange={setSubtitleStyle}>
                  <SelectTrigger className="w-full bg-white/5 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBTITLE_STYLES.map((style) => (
                      <SelectItem key={style.id} value={style.id}>
                        <div className="flex flex-col">
                          <span>{style.label}</span>
                          <span className="text-xs text-gray-500">{style.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Content Metadata */}
            <div className="bg-[#0D0F12] rounded-xl border border-white/5 p-5 space-y-4">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                Content Metadata
              </p>

              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">Pillar</label>
                <Select value={pillar} onValueChange={setPillar}>
                  <SelectTrigger className="w-full bg-white/5 border-white/10 text-white">
                    <SelectValue placeholder="Select pillar" />
                  </SelectTrigger>
                  <SelectContent>
                    {PILLARS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">Purpose</label>
                <Select value={purpose} onValueChange={setPurpose}>
                  <SelectTrigger className="w-full bg-white/5 border-white/10 text-white">
                    <SelectValue placeholder="Select purpose" />
                  </SelectTrigger>
                  <SelectContent>
                    {PURPOSES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">Topic</label>
                <Input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Morning routine with Hyperburn"
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-600"
                />
              </div>
            </div>

            {/* Health Status */}
            {healthQuery.data && !healthQuery.data.available && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs text-red-300">
                  Auto-edit service unavailable. Pipeline may skip editing stage.
                </p>
              </div>
            )}

            {/* Start Button */}
            <Button
              onClick={handleStart}
              disabled={triggerVideo.isPending || isRunning}
              className="w-full h-11 bg-[#FF3838] hover:bg-[#FF3838]/90 text-white font-semibold"
            >
              {triggerVideo.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Starting...
                </>
              ) : isRunning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Pipeline Running...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Start Pipeline
                </>
              )}
            </Button>
          </div>

          {/* RIGHT PANEL - Pipeline Stepper & Output */}
          <div className="flex-1 min-w-0">
            {!runId ? (
              /* Empty state */
              <div className="bg-[#0D0F12] rounded-xl border border-white/5 h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                    <Upload className="w-6 h-6 text-gray-600" />
                  </div>
                  <p className="text-gray-500 text-sm">
                    Upload your clips and start the pipeline
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Pipeline Stepper */}
                <div className="bg-[#0D0F12] rounded-xl border border-white/5 p-5">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-4">
                    Pipeline Progress
                  </p>
                  <div className="space-y-1">
                    {PIPELINE_STAGES.map((stage, idx) => {
                      const isActive = stage.key === currentStage;
                      const isDone = stageIdx > idx || isCompleted;
                      const isCurrent = isActive && isRunning;

                      return (
                        <div
                          key={stage.key}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                            isActive
                              ? "bg-white/5"
                              : ""
                          }`}
                        >
                          {isDone ? (
                            <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                          ) : isCurrent ? (
                            <Loader2 className="w-4 h-4 text-[#FF3838] animate-spin shrink-0" />
                          ) : (
                            <Circle className="w-4 h-4 text-gray-600 shrink-0" />
                          )}
                          <span
                            className={`text-sm ${
                              isDone
                                ? "text-green-400"
                                : isActive
                                ? "text-white font-medium"
                                : "text-gray-600"
                            }`}
                          >
                            {stage.label}
                          </span>
                          {idx < PIPELINE_STAGES.length - 1 && (
                            <ChevronRight className="w-3 h-3 text-gray-700 ml-auto" />
                          )}
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
                        <p className="text-red-400/70 text-xs mt-1">
                          {runData?.errorMessage || "An unexpected error occurred"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Transcript Review */}
                {currentStage === "reviewing" && isRunning && (
                  <div className="bg-[#0D0F12] rounded-xl border border-white/5 p-5 space-y-4">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Transcript Review
                    </p>
                    <p className="text-xs text-gray-500">
                      Edit the transcription below if needed, then approve to continue.
                    </p>
                    <Textarea
                      value={editedTranscript}
                      onChange={(e) => setEditedTranscript(e.target.value)}
                      rows={10}
                      className="bg-white/5 border-white/10 text-white text-sm font-mono"
                    />
                    <div className="flex gap-3">
                      <Button
                        onClick={handleApproveTranscript}
                        disabled={approveTranscript.isPending}
                        className="bg-green-600 hover:bg-green-600/90 text-white"
                      >
                        {approveTranscript.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4" />
                        )}
                        Looks Good
                      </Button>
                      <Button
                        onClick={handleSkipSubtitles}
                        disabled={approveTranscript.isPending}
                        variant="outline"
                        className="border-white/10 text-gray-300 hover:bg-white/5"
                      >
                        <Ban className="w-4 h-4" />
                        No Subtitles
                      </Button>
                    </div>
                  </div>
                )}

                {/* Completed Output */}
                {isCompleted && runData && (
                  <div className="bg-[#0D0F12] rounded-xl border border-white/5 p-5 space-y-5">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Output
                    </p>

                    {/* Video URL */}
                    {(runData.subtitledVideoUrl || runData.autoEditOutputUrl) && (
                      <div className="bg-white/5 rounded-lg p-3">
                        <label className="text-xs text-gray-500 mb-1 block">Video Output</label>
                        <div className="flex items-center gap-2">
                          <code className="text-xs text-green-400 flex-1 truncate">
                            {runData.subtitledVideoUrl || runData.autoEditOutputUrl}
                          </code>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleCopyCaption((runData.subtitledVideoUrl || runData.autoEditOutputUrl)!, "Video URL")}
                            className="shrink-0 text-gray-400 hover:text-white"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Platform Captions */}
                    {(runData.captionInstagram || runData.captionTiktok || runData.captionLinkedin) && (
                      <div>
                        <div className="flex gap-1 mb-3">
                          {(["instagram", "tiktok", "linkedin"] as PlatformTab[]).map((platform) => (
                            <button
                              key={platform}
                              onClick={() => setCaptionTab(platform)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                captionTab === platform
                                  ? "bg-white/10 text-white"
                                  : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                              }`}
                            >
                              {platform.charAt(0).toUpperCase() + platform.slice(1)}
                            </button>
                          ))}
                        </div>
                        <div className="bg-white/5 rounded-lg p-4">
                          <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                            {captionTab === "instagram" ? runData.captionInstagram :
                             captionTab === "tiktok" ? runData.captionTiktok :
                             runData.captionLinkedin || "No caption generated for this platform"}
                          </p>
                          <div className="mt-3 flex justify-end">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                handleCopyCaption(
                                  (captionTab === "instagram" ? runData.captionInstagram :
                                   captionTab === "tiktok" ? runData.captionTiktok :
                                   runData.captionLinkedin) || "",
                                  captionTab
                                )
                              }
                              className="text-gray-400 hover:text-white"
                            >
                              <Copy className="w-3.5 h-3.5" />
                              Copy
                            </Button>
                          </div>
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
    </div>
  );
}
