import { useState, useMemo, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Play, Image as ImageIcon, Filter, Loader2, ChevronRight,
  CheckCircle, Clock, Upload, Minus, Plus, Film, Trophy, Info
} from "lucide-react";

type Creative = {
  id: string;
  type: "VIDEO" | "STATIC";
  title: string;
  brandName: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  mediaUrl?: string;
  isNew?: boolean;
};

const PRODUCTS = [
  "Hyperburn", "Thermosleep", "Hyperload", "Thermoburn", "Carb Control",
  "Protein + Collagen", "Creatine", "HyperPump", "AminoLoad",
  "Marine Collagen", "SuperGreens", "Whey ISO Pro"
];
const PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;
const DURATIONS = [45, 60, 90] as const;

const SCRIPT_STYLES = [
  { key: "direct_response", label: "Direct Response", shortLabel: "DR", description: "Hard-sell with urgency, offers, and strong CTA" },
  { key: "ugc_testimonial", label: "UGC / Testimonial", shortLabel: "UGC", description: "Authentic personal recommendation feel" },
  { key: "education_myth_busting", label: "Education / Myth-Busting", shortLabel: "EDU", description: "Authority-led, debunks myths with science" },
  { key: "founder_led", label: "Founder-Led", shortLabel: "FND", description: "Brand story and mission from the founder" },
  { key: "lifestyle_aspiration", label: "Lifestyle / Aspiration", shortLabel: "LIFE", description: "Aspirational identity and transformation" },
  { key: "problem_solution_demo", label: "Problem / Solution Demo", shortLabel: "DEMO", description: "Visual before/after with product demo" },
] as const;

type SourceType = "competitor" | "winning_ad";

export default function BrowseCreatives() {
  const [filterType, setFilterType] = useState<"All" | "VIDEO" | "STATIC">("All");
  const [selectedCreative, setSelectedCreative] = useState<Creative | null>(null);
  const [product, setProduct] = useState("Hyperburn");
  const [priority, setPriority] = useState<typeof PRIORITIES[number]>("Medium");
  const [, setLocation] = useLocation();

  // New Copy Framework v2.0 state
  const [sourceType, setSourceType] = useState<SourceType>("competitor");
  const [duration, setDuration] = useState<number>(60);
  const [styleConfig, setStyleConfig] = useState<Record<string, number>>({
    direct_response: 0,
    ugc_testimonial: 0,
    education_myth_busting: 0,
    founder_led: 0,
    lifestyle_aspiration: 0,
    problem_solution_demo: 0,
  });

  // Winning ad upload state
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch both video and static ads
  const videosQuery = trpc.pipeline.fetchForeplayVideos.useQuery();
  const staticsQuery = trpc.pipeline.fetchForeplayStatics.useQuery();
  const syncMutation = trpc.pipeline.syncForeplayNow.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      videosQuery.refetch();
      staticsQuery.refetch();
    },
    onError: (err) => {
      toast.error("Sync failed: " + err.message);
    },
  });

  // Pipeline history for badges
  const pipelineHistory = trpc.pipeline.list.useQuery();

  const processedAdIds = useMemo(() => {
    const ids = new Set<string>();
    if (pipelineHistory.data) {
      for (const run of pipelineHistory.data) {
        if (run.foreplayAdId) ids.add(run.foreplayAdId);
      }
    }
    return ids;
  }, [pipelineHistory.data]);

  const getAdPipelineStatus = (adId: string): { status: string; count: number } | null => {
    if (!pipelineHistory.data) return null;
    const runs = pipelineHistory.data.filter(r => r.foreplayAdId === adId);
    if (runs.length === 0) return null;
    const latestRun = runs[0];
    return { status: latestRun.status, count: runs.length };
  };

  // Combine and filter creatives
  const creatives = useMemo(() => {
    const videos: Creative[] = (videosQuery.data || []).map((ad: any) => ({
      id: ad.id,
      type: "VIDEO" as const,
      title: ad.title || "Untitled Video",
      brandName: ad.brandName || "Unknown",
      thumbnailUrl: ad.thumbnailUrl,
      mediaUrl: ad.mediaUrl,
      isNew: ad.isNew,
    }));

    const statics: Creative[] = (staticsQuery.data || []).map((ad: any) => ({
      id: ad.id,
      type: "STATIC" as const,
      title: ad.title || "Untitled Static",
      brandName: ad.brandName || "Unknown",
      imageUrl: ad.imageUrl,
      thumbnailUrl: ad.thumbnailUrl,
      mediaUrl: ad.mediaUrl,
      isNew: ad.isNew,
    }));

    const all = [...videos, ...statics];
    if (filterType === "All") return all;
    return all.filter(c => c.type === filterType);
  }, [videosQuery.data, staticsQuery.data, filterType]);

  // Upload mutation for winning ad
  const uploadMutation = trpc.pipeline.uploadWinningAdVideo.useMutation({
    onSuccess: (data) => {
      setUploadedVideoUrl(data.url);
      setIsUploading(false);
      toast.success("Video uploaded successfully");
    },
    onError: (err) => {
      setIsUploading(false);
      toast.error("Upload failed: " + err.message);
    },
  });

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"];
    if (!validTypes.includes(file.type)) {
      toast.error("Please upload a video file (MP4, WebM, MOV, AVI)");
      return;
    }

    // Validate file size (100MB)
    if (file.size > 100 * 1024 * 1024) {
      toast.error("File too large. Maximum size is 100MB.");
      return;
    }

    setIsUploading(true);
    setUploadedFileName(file.name);

    // Convert to base64
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadMutation.mutate({
        fileName: file.name,
        mimeType: file.type,
        base64Data: base64,
      });
    };
    reader.onerror = () => {
      setIsUploading(false);
      toast.error("Failed to read file");
    };
    reader.readAsDataURL(file);
  }, [uploadMutation]);

  // Trigger mutations
  const triggerVideoMutation = trpc.pipeline.triggerVideo.useMutation({
    onSuccess: (data) => {
      toast.success("Video pipeline triggered!");
      setLocation(`/results/${data.runId}`);
    },
    onError: (err) => {
      toast.error("Failed to trigger pipeline: " + err.message);
    },
  });

  const triggerStaticMutation = trpc.pipeline.triggerStatic.useMutation({
    onSuccess: (data) => {
      toast.success("Static pipeline triggered!");
      setLocation(`/results/${data.runId}`);
    },
    onError: (err) => {
      toast.error("Failed to trigger pipeline: " + err.message);
    },
  });

  // Style config helpers
  const updateStyleCount = (key: string, delta: number) => {
    setStyleConfig(prev => ({
      ...prev,
      [key]: Math.max(0, Math.min(5, (prev[key] || 0) + delta)),
    }));
  };

  const totalScripts = Object.values(styleConfig).reduce((sum, v) => sum + v, 0);

  // Determine if we can run the video pipeline
  const canRunVideo = () => {
    if (sourceType === "winning_ad") {
      return uploadedVideoUrl && product && totalScripts > 0;
    }
    return selectedCreative?.type === "VIDEO" && product && totalScripts > 0;
  };

  const handleRunPipeline = () => {
    // Static pipeline — unchanged
    if (selectedCreative?.type === "STATIC" && sourceType === "competitor") {
      triggerStaticMutation.mutate({
        product,
        priority,
        selectedAdId: selectedCreative.id,
        selectedAdImage: {
          id: selectedCreative.id,
          imageUrl: selectedCreative.imageUrl || "",
          brandName: selectedCreative.brandName,
          title: selectedCreative.title,
        },
      });
      return;
    }

    // Video pipeline — with new Copy Framework parameters
    if (sourceType === "winning_ad" && uploadedVideoUrl) {
      triggerVideoMutation.mutate({
        product,
        priority,
        foreplayAdTitle: uploadedFileName || "Winning Ad Upload",
        foreplayAdBrand: "ONEST Health",
        mediaUrl: uploadedVideoUrl,
        sourceType: "winning_ad",
        duration,
        styleConfig,
      });
    } else if (selectedCreative?.type === "VIDEO") {
      triggerVideoMutation.mutate({
        product,
        priority,
        foreplayAdId: selectedCreative.id,
        foreplayAdTitle: selectedCreative.title,
        foreplayAdBrand: selectedCreative.brandName,
        mediaUrl: selectedCreative.mediaUrl || "",
        thumbnailUrl: selectedCreative.thumbnailUrl,
        sourceType: "competitor",
        duration,
        styleConfig,
      });
    }
  };

  const isLoading = videosQuery.isLoading || staticsQuery.isLoading;
  const isPending = triggerVideoMutation.isPending || triggerStaticMutation.isPending;
  const isSyncing = syncMutation.isPending;

  // Determine if the config panel should show video-specific options
  const showVideoOptions = sourceType === "winning_ad" || selectedCreative?.type === "VIDEO";

  // Build run button label
  const getRunButtonLabel = () => {
    if (sourceType === "winning_ad") {
      return `Run Winning Ad Pipeline · ${totalScripts} script${totalScripts !== 1 ? "s" : ""} · ${duration}s`;
    }
    if (selectedCreative?.type === "STATIC") {
      return "Run Static Pipeline";
    }
    return `Run Video Pipeline · ${totalScripts} script${totalScripts !== 1 ? "s" : ""} · ${duration}s`;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Browse Creatives</h1>
          <p className="text-gray-400 text-sm">
            Select a video or static ad from Foreplay, or upload your own winning ad
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => syncMutation.mutate()}
            disabled={isSyncing}
            className="bg-[#0347ED] hover:bg-[#0347ED]/90 text-white h-10 text-sm whitespace-nowrap"
          >
            {isSyncing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Syncing...
              </>
            ) : (
              "Sync from Foreplay"
            )}
          </Button>
        </div>
      </div>

      {/* Source Type Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => {
            setSourceType("competitor");
            setUploadedVideoUrl(null);
            setUploadedFileName(null);
          }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
            sourceType === "competitor"
              ? "bg-[#FF3838] text-white shadow-lg shadow-[#FF3838]/20"
              : "bg-[#191B1F] text-gray-400 hover:text-white border border-white/10"
          }`}
        >
          <Film className="w-4 h-4" />
          Competitor Ad
        </button>
        <button
          onClick={() => {
            setSourceType("winning_ad");
            setSelectedCreative(null);
          }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
            sourceType === "winning_ad"
              ? "bg-amber-500 text-white shadow-lg shadow-amber-500/20"
              : "bg-[#191B1F] text-gray-400 hover:text-white border border-white/10"
          }`}
        >
          <Trophy className="w-4 h-4" />
          Our Winning Ad
        </button>
      </div>

      {/* Filter Tabs — only show for competitor mode */}
      {sourceType === "competitor" && (
        <div className="flex gap-2">
          {(["All", "VIDEO", "STATIC"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterType === type
                  ? "bg-[#FF3838] text-white"
                  : "bg-[#191B1F] text-gray-400 hover:text-white border border-white/10"
              }`}
            >
              <Filter className="w-4 h-4 inline mr-2" />
              {type}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gallery Grid or Upload Zone */}
        <div className="lg:col-span-2">
          {sourceType === "competitor" ? (
            /* Foreplay Gallery */
            <div className="bg-[#191B1F] border border-white/5 rounded-xl p-6">
              {isLoading ? (
                <div className="flex items-center justify-center h-96">
                  <Loader2 className="w-8 h-8 animate-spin text-[#FF3838]" />
                </div>
              ) : creatives.length === 0 ? (
                <div className="flex items-center justify-center h-96 text-gray-400">
                  <p>No creatives found</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {creatives.map((creative) => {
                    const pipelineStatus = getAdPipelineStatus(creative.id);
                    return (
                      <div
                        key={creative.id}
                        onClick={() => setSelectedCreative(creative)}
                        className={`cursor-pointer rounded-lg overflow-hidden border-2 transition-all relative ${
                          selectedCreative?.id === creative.id
                            ? "border-[#FF3838] shadow-lg shadow-[#FF3838]/20"
                            : "border-white/10 hover:border-white/20"
                        }`}
                      >
                        {/* NEW badge */}
                        {creative.isNew && (
                          <div className="absolute top-2 right-2 z-10 bg-emerald-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                            NEW
                          </div>
                        )}

                        {/* Pipeline History Badge */}
                        {pipelineStatus && (
                          <div className="absolute top-2 left-2 z-10">
                            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold backdrop-blur-sm ${
                              pipelineStatus.status === "completed"
                                ? "bg-emerald-500/90 text-white"
                                : pipelineStatus.status === "running"
                                ? "bg-orange-500/90 text-white"
                                : pipelineStatus.status === "failed"
                                ? "bg-red-500/90 text-white"
                                : "bg-blue-500/90 text-white"
                            }`}>
                              {pipelineStatus.status === "completed" ? (
                                <CheckCircle className="w-3 h-3" />
                              ) : pipelineStatus.status === "running" ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Clock className="w-3 h-3" />
                              )}
                              {pipelineStatus.status === "completed" ? "Processed" :
                               pipelineStatus.status === "running" ? "Running" :
                               pipelineStatus.status === "failed" ? "Failed" : "Pending"}
                              {pipelineStatus.count > 1 && (
                                <span className="ml-1 bg-white/20 px-1 rounded">{pipelineStatus.count}x</span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Thumbnail */}
                        <div className="relative bg-[#01040A] aspect-square flex items-center justify-center overflow-hidden">
                          {creative.type === "VIDEO" && creative.thumbnailUrl ? (
                            <>
                              <img
                                src={creative.thumbnailUrl}
                                alt={creative.title}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                <Play className="w-8 h-8 text-white fill-white" />
                              </div>
                            </>
                          ) : creative.type === "STATIC" && (creative.imageUrl || creative.thumbnailUrl) ? (
                            <img
                              src={creative.imageUrl || creative.thumbnailUrl}
                              alt={creative.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="flex flex-col items-center text-gray-500">
                              {creative.type === "VIDEO" ? (
                                <Play className="w-8 h-8 mb-2" />
                              ) : (
                                <ImageIcon className="w-8 h-8 mb-2" />
                              )}
                              <p className="text-xs">No preview</p>
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="p-3 bg-[#0F1117]">
                          <div className="flex items-start justify-between mb-1">
                            <p className="text-sm font-medium text-white truncate flex-1">{creative.title}</p>
                            <span className={`text-xs font-bold px-2 py-1 rounded ml-2 ${
                              creative.type === "VIDEO"
                                ? "bg-blue-900/50 text-blue-300"
                                : "bg-purple-900/50 text-purple-300"
                            }`}>
                              {creative.type}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400">{creative.brandName}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Winning Ad Upload Zone */
            <div className="bg-[#191B1F] border border-white/5 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-2">Upload Your Winning Ad</h3>
              <p className="text-gray-400 text-sm mb-6">
                Upload a video of your winning ad to generate new script variations based on what's already working.
              </p>

              {uploadedVideoUrl ? (
                <div className="space-y-4">
                  <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
                    <video
                      src={uploadedVideoUrl}
                      controls
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-[#0F1117] rounded-lg border border-white/10">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                      <div>
                        <p className="text-sm font-medium text-white">{uploadedFileName}</p>
                        <p className="text-xs text-gray-400">Uploaded successfully</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setUploadedVideoUrl(null);
                        setUploadedFileName(null);
                      }}
                      className="text-gray-400 hover:text-white border-white/10"
                    >
                      Replace
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
                    isUploading
                      ? "border-amber-500/50 bg-amber-500/5"
                      : "border-white/10 hover:border-amber-500/50 hover:bg-amber-500/5"
                  }`}
                >
                  {isUploading ? (
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-12 h-12 text-amber-400 animate-spin" />
                      <p className="text-white font-medium">Uploading {uploadedFileName}...</p>
                      <p className="text-gray-400 text-sm">This may take a moment for larger files</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <Upload className="w-12 h-12 text-gray-500" />
                      <p className="text-white font-medium">Drop your video here or click to browse</p>
                      <p className="text-gray-400 text-sm">MP4, WebM, MOV, AVI — Max 100MB</p>
                    </div>
                  )}
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime,video/x-msvideo"
                onChange={handleFileUpload}
                className="hidden"
              />

              {/* Info callout */}
              <div className="mt-6 p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                <div className="flex gap-3">
                  <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-300 mb-1">Winning Ad Mode</p>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      The pipeline will analyse your winning ad and generate new script variations using
                      hook swaps, angle shifts, audience reframes, and format adaptations — extending
                      what's already working rather than starting from scratch.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Configuration Panel */}
        <div className="lg:col-span-1">
          <div className="bg-[#191B1F] border border-white/5 rounded-xl p-6 sticky top-6 space-y-5">
            {(selectedCreative || sourceType === "winning_ad") ? (
              <>
                <h3 className="text-lg font-bold text-white">Configuration</h3>

                {/* Selected Creative Preview — only for competitor mode */}
                {sourceType === "competitor" && selectedCreative && (
                  <div className="p-3 bg-[#0F1117] rounded-lg border border-white/10">
                    <div className="aspect-video rounded-lg overflow-hidden mb-3 bg-[#01040A]">
                      {selectedCreative.type === "VIDEO" && selectedCreative.thumbnailUrl ? (
                        <img
                          src={selectedCreative.thumbnailUrl}
                          alt={selectedCreative.title}
                          className="w-full h-full object-cover"
                        />
                      ) : selectedCreative.type === "STATIC" && selectedCreative.imageUrl ? (
                        <img
                          src={selectedCreative.imageUrl}
                          alt={selectedCreative.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-500">
                          <ImageIcon className="w-8 h-8" />
                        </div>
                      )}
                    </div>
                    <p className="text-sm font-medium text-white truncate">{selectedCreative.title}</p>
                    <p className="text-xs text-gray-400">{selectedCreative.brandName}</p>
                  </div>
                )}

                {/* Product Selection */}
                <div>
                  <label className="text-xs font-medium text-gray-300 mb-2 block">Product</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {PRODUCTS.map((p) => (
                      <button
                        key={p}
                        onClick={() => setProduct(p)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          product === p
                            ? sourceType === "winning_ad"
                              ? "bg-amber-500 text-white"
                              : "bg-[#FF3838] text-white"
                            : "bg-[#01040A] text-gray-400 hover:text-white border border-white/10"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Priority Selection */}
                <div>
                  <label className="text-xs font-medium text-gray-300 mb-2 block">Priority</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {PRIORITIES.map((p) => (
                      <button
                        key={p}
                        onClick={() => setPriority(p)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          priority === p
                            ? sourceType === "winning_ad"
                              ? "bg-amber-500 text-white"
                              : "bg-[#FF3838] text-white"
                            : "bg-[#01040A] text-gray-400 hover:text-white border border-white/10"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Video-specific options */}
                {showVideoOptions && (
                  <>
                    {/* Duration Selector */}
                    <div>
                      <label className="text-xs font-medium text-gray-300 mb-2 block">Script Duration</label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {DURATIONS.map((d) => (
                          <button
                            key={d}
                            onClick={() => setDuration(d)}
                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                              duration === d
                                ? sourceType === "winning_ad"
                                  ? "bg-amber-500 text-white"
                                  : "bg-[#FF3838] text-white"
                                : "bg-[#01040A] text-gray-400 hover:text-white border border-white/10"
                            }`}
                          >
                            ~{d}s
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Script Style Picker */}
                    <div>
                      <label className="text-xs font-medium text-gray-300 mb-2 block">
                        Script Styles
                        <span className="text-gray-500 ml-2">({totalScripts} total)</span>
                      </label>
                      <div className="space-y-2">
                        {SCRIPT_STYLES.map((style) => (
                          <div
                            key={style.key}
                            className="flex items-center justify-between p-2.5 bg-[#0F1117] rounded-lg border border-white/5"
                          >
                            <div className="flex-1 min-w-0 mr-3">
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  (styleConfig[style.key] || 0) > 0
                                    ? sourceType === "winning_ad"
                                      ? "bg-amber-500/20 text-amber-300"
                                      : "bg-[#FF3838]/20 text-[#FF3838]"
                                    : "bg-white/5 text-gray-500"
                                }`}>
                                  {style.shortLabel}
                                </span>
                                <span className="text-xs font-medium text-white truncate">{style.label}</span>
                              </div>
                              <p className="text-[10px] text-gray-500 mt-0.5 truncate">{style.description}</p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                onClick={() => updateStyleCount(style.key, -1)}
                                disabled={(styleConfig[style.key] || 0) === 0}
                                className="w-6 h-6 rounded bg-[#01040A] border border-white/10 flex items-center justify-center text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className={`w-6 text-center text-sm font-bold ${
                                (styleConfig[style.key] || 0) > 0 ? "text-white" : "text-gray-600"
                              }`}>
                                {styleConfig[style.key] || 0}
                              </span>
                              <button
                                onClick={() => updateStyleCount(style.key, 1)}
                                disabled={(styleConfig[style.key] || 0) >= 5}
                                className="w-6 h-6 rounded bg-[#01040A] border border-white/10 flex items-center justify-center text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Run Pipeline Button */}
                <Button
                  onClick={handleRunPipeline}
                  disabled={
                    isPending ||
                    (showVideoOptions && totalScripts === 0) ||
                    (sourceType === "winning_ad" && !uploadedVideoUrl) ||
                    (sourceType === "competitor" && !selectedCreative)
                  }
                  className={`w-full h-11 text-sm font-medium ${
                    sourceType === "winning_ad"
                      ? "bg-amber-500 hover:bg-amber-500/90 text-white"
                      : "bg-[#FF3838] hover:bg-[#FF3838]/90 text-white"
                  }`}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <ChevronRight className="w-4 h-4 mr-2" />
                      {getRunButtonLabel()}
                    </>
                  )}
                </Button>

                {/* Validation hint */}
                {showVideoOptions && totalScripts === 0 && (
                  <p className="text-xs text-amber-400/70 text-center">
                    Select at least one script style above to continue
                  </p>
                )}

                {/* Pipeline description */}
                <p className="text-xs text-gray-500">
                  {sourceType === "winning_ad"
                    ? "Winning Ad Pipeline: Transcription → Analysis → Variation Concepts → Script Generation → Expert Review → ClickUp"
                    : selectedCreative?.type === "VIDEO"
                    ? "Video Pipeline: Transcription → Visual Analysis → Concept Briefs → Script Generation → Expert Review → ClickUp"
                    : "Static Pipeline: Analysis → Brief → Expert Review → Image Variations → Expert Review → Team Approval → ClickUp"}
                </p>
              </>
            ) : (
              <div className="text-center py-12">
                <ImageIcon className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">Select a creative to configure and run the pipeline</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
