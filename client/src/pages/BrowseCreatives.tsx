import { useState, useMemo, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Play, Image as ImageIcon, Filter, Loader2, ChevronRight, CheckCircle, Clock,
  Upload, Minus, Plus, DollarSign, Zap, Trophy, Info, Target, User
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
  "Hyperburn", "Thermosleep", "Protein + Collagen", "Hyperload", "Creatine",
  "Thermoburn", "Carb Control", "HyperPump", "AminoLoad", "Marine Collagen",
  "SuperGreens", "Whey ISO Pro",
];

const PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;

const SCRIPT_STYLES = [
  { id: "DR", label: "Direct Response", shortLabel: "DR", description: "Hard-sell with clear offer, urgency, and direct CTA", color: "bg-red-500/20 text-red-300 border-red-500/30" },
  { id: "UGC", label: "UGC / Testimonial", shortLabel: "UGC", description: "Authentic personal experience, soft-sell recommendation", color: "bg-green-500/20 text-green-300 border-green-500/30" },
  { id: "FOUNDER", label: "Founder-Led", shortLabel: "Founder", description: "Brand founder speaking with authority and passion", color: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  { id: "EDUCATION", label: "Education / Myth-Busting", shortLabel: "Education", description: "Teach something surprising, position product as answer", color: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
  { id: "LIFESTYLE", label: "Lifestyle / Aspiration", shortLabel: "Lifestyle", description: "Aspirational day-in-the-life with product woven in", color: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  { id: "DEMO", label: "Problem / Solution Demo", shortLabel: "Demo", description: "Show the problem, demonstrate the product solving it", color: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30" },
] as const;

const DURATIONS = [
  { value: 45, label: "45s" },
  { value: 60, label: "60s" },
  { value: 90, label: "90s" },
] as const;

const FUNNEL_STAGES = [
  { id: "cold" as const, label: "Cold", description: "New audiences, problem-aware", color: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  { id: "warm" as const, label: "Warm", description: "Engaged, solution-aware", color: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  { id: "retargeting" as const, label: "Retargeting", description: "Visited site, product-aware", color: "bg-orange-500/20 text-orange-300 border-orange-500/30" },
  { id: "retention" as const, label: "Retention", description: "Existing customers", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
] as const;

const ACTOR_ARCHETYPES = [
  { id: "FitnessEnthusiast" as const, label: "Fitness Enthusiast", description: "Gym-goer, tracks macros, performance-driven" },
  { id: "BusyMum" as const, label: "Busy Mum", description: "Time-poor, health-conscious, family-focused" },
  { id: "Athlete" as const, label: "Athlete", description: "Competitive, recovery-focused, data-driven" },
  { id: "Biohacker" as const, label: "Biohacker", description: "Ingredient-obsessed, optimisation-focused" },
  { id: "WellnessAdvocate" as const, label: "Wellness Advocate", description: "Holistic health, clean ingredients, mindful" },
] as const;

type FunnelStage = typeof FUNNEL_STAGES[number]["id"];
type ActorArchetype = typeof ACTOR_ARCHETYPES[number]["id"];

type StyleConfig = { styleId: "DR" | "UGC" | "FOUNDER" | "EDUCATION" | "LIFESTYLE" | "DEMO"; quantity: number };

export default function BrowseCreatives() {
  const [filterType, setFilterType] = useState<"All" | "VIDEO" | "STATIC">("All");
  const [selectedCreative, setSelectedCreative] = useState<Creative | null>(null);
  const [product, setProduct] = useState("Hyperburn");
  const [priority, setPriority] = useState<typeof PRIORITIES[number]>("Medium");
  const [, setLocation] = useLocation();

  // Copy Framework v3.0 state
  const [sourceType, setSourceType] = useState<"competitor" | "winning_ad">("competitor");
  const [duration, setDuration] = useState(60);
  const [funnelStage, setFunnelStage] = useState<FunnelStage>("cold");
  const [actorArchetype, setActorArchetype] = useState<ActorArchetype | null>(null);
  const [styleConfig, setStyleConfig] = useState<StyleConfig[]>(
    SCRIPT_STYLES.map(s => ({ styleId: s.id, quantity: 0 }))
  );

  // Winning ad upload state
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Config panel ref for auto-scroll
  const configPanelRef = useRef<HTMLDivElement>(null);

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

  // Style quantity helpers
  const totalScripts = styleConfig.reduce((sum, s) => sum + s.quantity, 0);

  const updateStyleQuantity = (styleId: string, delta: number) => {
    setStyleConfig(prev =>
      prev.map(s =>
        s.styleId === styleId
          ? { ...s, quantity: Math.max(0, Math.min(5, s.quantity + delta)) }
          : s
      )
    );
  };

  // Cost estimate for video pipeline (v3.0 — up to 5 review rounds)
  // Base cost: transcription + analysis + brief = ~$0.35
  // Per script: generation + review (avg 3 rounds) = ~$0.60 per script
  const baseCost = 0.35;
  const perScriptCost = 0.60;
  const estimatedCost = baseCost + (totalScripts * perScriptCost);

  // Check if any UGC scripts are selected (to show archetype picker)
  const hasUgcScripts = styleConfig.find(s => s.styleId === "UGC")?.quantity ?? 0;

  // Upload handler for winning ad
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

  const handleFileUpload = useCallback(async (file: File) => {
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      toast.error("File too large. Maximum 100MB.");
      return;
    }
    const validTypes = ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"];
    if (!validTypes.includes(file.type)) {
      toast.error("Invalid file type. Please upload MP4, WebM, MOV, or AVI.");
      return;
    }

    setIsUploading(true);
    setUploadedFileName(file.name);

    // Read file as base64
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadMutation.mutate({
        fileName: file.name,
        fileBase64: base64,
        contentType: file.type,
      });
    };
    reader.onerror = () => {
      setIsUploading(false);
      toast.error("Failed to read file");
    };
    reader.readAsDataURL(file);
  }, [uploadMutation]);

  // Mutations
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

  const handleSelectCreative = (creative: Creative) => {
    setSelectedCreative(creative);
    // Auto-scroll to config panel on mobile
    setTimeout(() => {
      configPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const handleRunPipeline = () => {
    if (sourceType === "winning_ad") {
      // Winning ad mode — use uploaded video
      if (!uploadedVideoUrl) {
        toast.error("Please upload a video first");
        return;
      }
      if (totalScripts === 0) {
        toast.error("Please select at least one script style");
        return;
      }
      triggerVideoMutation.mutate({
        product,
        priority,
        mediaUrl: uploadedVideoUrl,
        sourceType: "winning_ad",
        duration,
        funnelStage,
        actorArchetype: actorArchetype || undefined,
        styleConfig: styleConfig.filter(s => s.quantity > 0),
      });
    } else if (selectedCreative) {
      // Competitor mode
      if (selectedCreative.type === "VIDEO") {
        if (totalScripts === 0) {
          toast.error("Please select at least one script style");
          return;
        }
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
          funnelStage,
          actorArchetype: actorArchetype || undefined,
          styleConfig: styleConfig.filter(s => s.quantity > 0),
        });
      } else {
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
      }
    }
  };

  const isLoading = videosQuery.isLoading || staticsQuery.isLoading;
  const isPending = triggerVideoMutation.isPending || triggerStaticMutation.isPending;
  const isSyncing = syncMutation.isPending;

  const isVideoMode = sourceType === "winning_ad" || selectedCreative?.type === "VIDEO";
  const canRun = sourceType === "winning_ad"
    ? uploadedVideoUrl && totalScripts > 0
    : selectedCreative && (selectedCreative.type === "STATIC" || totalScripts > 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Browse Creatives</h1>
          <p className="text-gray-400 text-sm">
            Select a competitor ad from Foreplay or upload your own winning ad
          </p>
        </div>
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

      {/* Source Type Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => { setSourceType("competitor"); setUploadedVideoUrl(null); setUploadedFileName(null); }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
            sourceType === "competitor"
              ? "bg-[#FF3838] text-white shadow-lg shadow-[#FF3838]/20"
              : "bg-[#191B1F] text-gray-400 hover:text-white border border-white/10"
          }`}
        >
          <Zap className="w-4 h-4" />
          Competitor Ad
        </button>
        <button
          onClick={() => { setSourceType("winning_ad"); setSelectedCreative(null); }}
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

      {/* Filter Tabs — only show in competitor mode */}
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
          {sourceType === "winning_ad" ? (
            /* Winning Ad Upload Zone */
            <div className="bg-[#191B1F] border border-white/5 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">Upload Your Winning Ad</h3>
              <p className="text-gray-400 text-sm mb-6">
                Upload a video of your winning ad. The pipeline will analyse it and create variations using hook swaps, angle shifts, and audience reframes.
              </p>

              {uploadedVideoUrl ? (
                <div className="space-y-4">
                  <div className="bg-[#0F1117] rounded-lg border border-amber-500/30 p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-amber-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-white">{uploadedFileName || "Video uploaded"}</p>
                        <p className="text-xs text-gray-400">Ready for pipeline</p>
                      </div>
                      <button
                        onClick={() => { setUploadedVideoUrl(null); setUploadedFileName(null); }}
                        className="text-xs text-gray-400 hover:text-white"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <video
                    src={uploadedVideoUrl}
                    controls
                    className="w-full rounded-lg max-h-96"
                  />
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const file = e.dataTransfer.files[0];
                    if (file) handleFileUpload(file);
                  }}
                  className="border-2 border-dashed border-white/20 hover:border-amber-500/50 rounded-xl p-12 flex flex-col items-center justify-center cursor-pointer transition-colors min-h-[300px]"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-12 h-12 text-amber-400 animate-spin mb-4" />
                      <p className="text-white font-medium">Uploading {uploadedFileName}...</p>
                      <p className="text-gray-400 text-sm mt-1">This may take a moment for large files</p>
                    </>
                  ) : (
                    <>
                      <Upload className="w-12 h-12 text-gray-500 mb-4" />
                      <p className="text-white font-medium">Drop your video here or click to browse</p>
                      <p className="text-gray-400 text-sm mt-1">MP4, WebM, MOV, or AVI — Max 100MB</p>
                    </>
                  )}
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime,video/x-msvideo"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
              />
            </div>
          ) : (
            /* Competitor Ad Gallery */
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
                        onClick={() => handleSelectCreative(creative)}
                        className={`cursor-pointer rounded-lg overflow-hidden border-2 transition-all relative ${
                          selectedCreative?.id === creative.id
                            ? "border-[#FF3838] shadow-lg shadow-[#FF3838]/20"
                            : "border-white/10 hover:border-white/20"
                        }`}
                      >
                        {creative.isNew && (
                          <div className="absolute top-2 right-2 z-10 bg-emerald-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                            NEW
                          </div>
                        )}

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

                        <div className="relative bg-[#01040A] aspect-square flex items-center justify-center overflow-hidden">
                          {creative.type === "VIDEO" && creative.thumbnailUrl ? (
                            <>
                              <img src={creative.thumbnailUrl} alt={creative.title} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                <Play className="w-8 h-8 text-white fill-white" />
                              </div>
                            </>
                          ) : creative.type === "STATIC" && (creative.imageUrl || creative.thumbnailUrl) ? (
                            <img src={creative.imageUrl || creative.thumbnailUrl} alt={creative.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="flex flex-col items-center text-gray-500">
                              {creative.type === "VIDEO" ? <Play className="w-8 h-8 mb-2" /> : <ImageIcon className="w-8 h-8 mb-2" />}
                              <p className="text-xs">No preview</p>
                            </div>
                          )}
                        </div>

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
          )}
        </div>

        {/* Configuration Panel */}
        <div className="lg:col-span-1" ref={configPanelRef}>
          <div className="bg-[#191B1F] border border-white/5 rounded-xl p-6 sticky top-6 space-y-5 max-h-[calc(100vh-3rem)] overflow-y-auto">
            {(selectedCreative || sourceType === "winning_ad") ? (
              <>
                <h3 className="text-lg font-bold text-white">
                  {sourceType === "winning_ad" ? "Variation Config" : "Pipeline Config"}
                </h3>

                {/* Selected Creative Preview — only in competitor mode */}
                {sourceType === "competitor" && selectedCreative && (
                  <div className="p-3 bg-[#0F1117] rounded-lg border border-white/10">
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-[#01040A] flex-shrink-0">
                        {selectedCreative.thumbnailUrl || selectedCreative.imageUrl ? (
                          <img src={selectedCreative.thumbnailUrl || selectedCreative.imageUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-500">
                            <ImageIcon className="w-5 h-5" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{selectedCreative.title}</p>
                        <p className="text-xs text-gray-400">{selectedCreative.brandName}</p>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded mt-1 inline-block ${
                          selectedCreative.type === "VIDEO"
                            ? "bg-blue-900/50 text-blue-300"
                            : "bg-purple-900/50 text-purple-300"
                        }`}>
                          {selectedCreative.type}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Winning Ad Upload Status — only in winning_ad mode */}
                {sourceType === "winning_ad" && uploadedVideoUrl && (
                  <div className="p-3 bg-[#0F1117] rounded-lg border border-amber-500/30">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                        <Trophy className="w-5 h-5 text-amber-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{uploadedFileName}</p>
                        <p className="text-xs text-amber-400">Winning Ad · Ready</p>
                      </div>
                    </div>
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
                            ? sourceType === "winning_ad" ? "bg-amber-500 text-white" : "bg-[#FF3838] text-white"
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
                            ? sourceType === "winning_ad" ? "bg-amber-500 text-white" : "bg-[#FF3838] text-white"
                            : "bg-[#01040A] text-gray-400 hover:text-white border border-white/10"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Video-specific options */}
                {isVideoMode && (
                  <>
                    {/* Funnel Stage Selector */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Target className="w-3.5 h-3.5 text-gray-400" />
                        <label className="text-xs font-medium text-gray-300">Funnel Stage</label>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {FUNNEL_STAGES.map((stage) => (
                          <button
                            key={stage.id}
                            onClick={() => setFunnelStage(stage.id)}
                            className={`px-2.5 py-2 rounded-lg text-xs font-medium transition-all text-left ${
                              funnelStage === stage.id
                                ? `${stage.color} border`
                                : "bg-[#0F1117] text-gray-400 hover:text-white border border-white/5 hover:border-white/10"
                            }`}
                          >
                            <div className="font-semibold">{stage.label}</div>
                            <div className="text-[10px] opacity-70 mt-0.5">{stage.description}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Duration Selector */}
                    <div>
                      <label className="text-xs font-medium text-gray-300 mb-2 block">Script Duration</label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {DURATIONS.map((d) => (
                          <button
                            key={d.value}
                            onClick={() => setDuration(d.value)}
                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                              duration === d.value
                                ? sourceType === "winning_ad" ? "bg-amber-500 text-white" : "bg-[#FF3838] text-white"
                                : "bg-[#01040A] text-gray-400 hover:text-white border border-white/10"
                            }`}
                          >
                            {d.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Script Style Picker */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-medium text-gray-300">Script Styles</label>
                        <span className="text-xs text-gray-500">
                          {totalScripts > 0 ? `${totalScripts} total` : "Select styles"}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {SCRIPT_STYLES.map((style) => {
                          const config = styleConfig.find(s => s.styleId === style.id);
                          const qty = config?.quantity || 0;
                          return (
                            <div
                              key={style.id}
                              className={`flex items-center justify-between p-2.5 rounded-lg border transition-all ${
                                qty > 0
                                  ? `${style.color} border`
                                  : "bg-[#0F1117] border-white/5 hover:border-white/10"
                              }`}
                            >
                              <div className="flex-1 min-w-0 mr-2">
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs font-semibold ${qty > 0 ? "" : "text-gray-300"}`}>
                                    {style.shortLabel}
                                  </span>
                                </div>
                                <p className="text-[10px] text-gray-500 truncate">{style.description}</p>
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <button
                                  onClick={() => updateStyleQuantity(style.id, -1)}
                                  disabled={qty === 0}
                                  className="w-6 h-6 rounded flex items-center justify-center bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                  <Minus className="w-3 h-3 text-gray-300" />
                                </button>
                                <span className={`w-5 text-center text-sm font-bold ${qty > 0 ? "text-white" : "text-gray-600"}`}>
                                  {qty}
                                </span>
                                <button
                                  onClick={() => updateStyleQuantity(style.id, 1)}
                                  disabled={qty >= 5}
                                  className="w-6 h-6 rounded flex items-center justify-center bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                  <Plus className="w-3 h-3 text-gray-300" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {totalScripts === 0 && (
                        <p className="text-xs text-amber-400/70 mt-2 flex items-center gap-1">
                          <Info className="w-3 h-3" />
                          Select at least one script style to run the pipeline
                        </p>
                      )}
                    </div>

                    {/* Actor Archetype Picker — only when UGC scripts selected */}
                    {hasUgcScripts > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <User className="w-3.5 h-3.5 text-gray-400" />
                          <label className="text-xs font-medium text-gray-300">UGC Actor Archetype</label>
                          <span className="text-[10px] text-gray-500">(optional)</span>
                        </div>
                        <div className="space-y-1.5">
                          {ACTOR_ARCHETYPES.map((arch) => (
                            <button
                              key={arch.id}
                              onClick={() => setActorArchetype(actorArchetype === arch.id ? null : arch.id)}
                              className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all border ${
                                actorArchetype === arch.id
                                  ? "bg-green-500/20 text-green-300 border-green-500/30"
                                  : "bg-[#0F1117] text-gray-400 hover:text-white border-white/5 hover:border-white/10"
                              }`}
                            >
                              <div className="font-semibold">{arch.label}</div>
                              <div className="text-[10px] opacity-70 mt-0.5">{arch.description}</div>
                            </button>
                          ))}
                        </div>
                        <p className="text-[10px] text-gray-500 mt-1.5">Shapes UGC voice tone, vocabulary, and energy level</p>
                      </div>
                    )}

                    {/* Cost Estimate */}
                    {totalScripts > 0 && (
                      <div className="bg-[#0F1117] rounded-lg border border-white/10 p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <DollarSign className="w-4 h-4 text-gray-400" />
                          <span className="text-xs font-medium text-gray-300">Estimated Cost</span>
                        </div>
                        <div className="text-2xl font-bold text-white">
                          ${estimatedCost.toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                          <div>Base (transcription + analysis + brief): ${baseCost.toFixed(2)}</div>
                          <div>{totalScripts} script{totalScripts === 1 ? "" : "s"} x ${perScriptCost.toFixed(2)} (generation + review): ${(totalScripts * perScriptCost).toFixed(2)}</div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Run Pipeline Button */}
                <Button
                  onClick={handleRunPipeline}
                  disabled={isPending || !canRun}
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
                      {isVideoMode
                        ? `Run Video Pipeline${totalScripts > 0 ? ` · ${totalScripts} script${totalScripts === 1 ? "" : "s"} · ${duration}s` : ""}`
                        : `Run Static Pipeline`
                      }
                    </>
                  )}
                </Button>

                {/* Pipeline description */}
                <p className="text-xs text-gray-500">
                  {isVideoMode
                    ? sourceType === "winning_ad"
                      ? "Winning Ad Pipeline: Transcription → Analysis → Variation Brief → Script Generation → Expert Review → ClickUp"
                      : "Video Pipeline: Transcription → Visual Analysis → Creative Brief → Script Generation → Expert Review → ClickUp"
                    : "Static Pipeline: Analysis → Brief → Expert Review → 3 Image Variations → Expert Review → Team Approval → ClickUp"
                  }
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
