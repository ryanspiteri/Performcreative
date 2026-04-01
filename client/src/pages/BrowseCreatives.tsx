import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Play, Image as ImageIcon, Filter, Loader2, ChevronRight, CheckCircle, Clock,
  Upload, Minus, Plus, DollarSign, Zap, Trophy, Info, Target, User, Search
} from "lucide-react";
import { ACTIVE_PRODUCTS } from "../../../drizzle/schema";
import {
  PRIORITIES, SCRIPT_STYLES, DURATIONS, FUNNEL_STAGES, ACTOR_ARCHETYPES,
  COST_BASE, COST_PER_SCRIPT,
  type Creative, type FunnelStage, type ActorArchetype, type StyleConfig,
} from "../../../shared/pipeline";
import { CreativeDetailModal } from "@/components/browse/CreativeDetailModal";

export default function BrowseCreatives() {
  const [filterType, setFilterType] = useState<"All" | "VIDEO" | "STATIC">("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCreative, setSelectedCreative] = useState<Creative | null>(null);
  const [detailCreative, setDetailCreative] = useState<Creative | null>(null);
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

  // Pagination state
  const [videoOffset, setVideoOffset] = useState(0);
  const [staticOffset, setStaticOffset] = useState(0);
  const [allVideos, setAllVideos] = useState<Creative[]>([]);
  const [allStatics, setAllStatics] = useState<Creative[]>([]);
  const PAGE_SIZE = 50;

  // Config panel ref for auto-scroll
  const configPanelRef = useRef<HTMLDivElement>(null);

  // Fetch both video and static ads with pagination
  const videosQuery = trpc.pipeline.fetchForeplayVideos.useQuery({ limit: PAGE_SIZE, offset: videoOffset });
  const staticsQuery = trpc.pipeline.fetchForeplayStatics.useQuery({ limit: PAGE_SIZE, offset: staticOffset });

  // Accumulate paginated results
  // Sort state
  const [sortBy, setSortBy] = useState<"newest" | "quality">("newest");

  // Analyze mutation for lazy on-view analysis
  const analyzeMutation = trpc.pipeline.analyzeCreative.useMutation();
  const analyzingIds = useRef(new Set<number>());

  const videosData = useMemo(() => {
    const current = (videosQuery.data || []).map((ad: any) => ({
      id: ad.id,
      dbId: ad.dbId as number | undefined,
      type: "VIDEO" as const,
      title: ad.title || "Untitled Video",
      brandName: ad.brandName || "Unknown",
      thumbnailUrl: ad.thumbnailUrl,
      mediaUrl: ad.mediaUrl,
      isNew: ad.isNew,
      summary: ad.summary,
      qualityScore: ad.qualityScore,
      suggestedConfig: ad.suggestedConfig,
    }));
    if (videoOffset === 0) return current;
    const existing = new Set(allVideos.map(v => v.id));
    return [...allVideos, ...current.filter((c: Creative) => !existing.has(c.id))];
  }, [videosQuery.data, videoOffset, allVideos]);

  const staticsData = useMemo(() => {
    const current = (staticsQuery.data || []).map((ad: any) => ({
      id: ad.id,
      dbId: ad.dbId as number | undefined,
      type: "STATIC" as const,
      title: ad.title || "Untitled Static",
      brandName: ad.brandName || "Unknown",
      imageUrl: ad.imageUrl,
      thumbnailUrl: ad.thumbnailUrl,
      mediaUrl: ad.mediaUrl,
      isNew: ad.isNew,
      summary: ad.summary,
      qualityScore: ad.qualityScore,
      suggestedConfig: ad.suggestedConfig,
    }));
    if (staticOffset === 0) return current;
    const existing = new Set(allStatics.map(s => s.id));
    return [...allStatics, ...current.filter((c: Creative) => !existing.has(c.id))];
  }, [staticsQuery.data, staticOffset, allStatics]);

  // Track accumulated data for next page append
  useEffect(() => { if (videosData.length > 0) setAllVideos(videosData); }, [videosData]);
  useEffect(() => { if (staticsData.length > 0) setAllStatics(staticsData); }, [staticsData]);

  const hasMoreVideos = (videosQuery.data || []).length === PAGE_SIZE;
  const hasMoreStatics = (staticsQuery.data || []).length === PAGE_SIZE;

  const syncMutation = trpc.pipeline.syncForeplayNow.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setVideoOffset(0);
      setStaticOffset(0);
      setAllVideos([]);
      setAllStatics([]);
      videosQuery.refetch();
      staticsQuery.refetch();
    },
    onError: (err) => {
      toast.error("Sync failed: " + err.message);
    },
  });

  // Collect all creative IDs for targeted status lookup
  const allCreativeIds = useMemo(() => {
    const videoIds = videosData.map(v => v.id).filter(Boolean);
    const staticIds = staticsData.map(s => s.id).filter(Boolean);
    return [...videoIds, ...staticIds];
  }, [videosData, staticsData]);

  const pipelineStatusQuery = trpc.pipeline.statusByAdIds.useQuery(
    { adIds: allCreativeIds },
    { enabled: allCreativeIds.length > 0 }
  );

  const processedAdIds = useMemo(() => {
    return new Set(Object.keys(pipelineStatusQuery.data || {}));
  }, [pipelineStatusQuery.data]);

  const getAdPipelineStatus = (adId: string): { status: string; count: number } | null => {
    return pipelineStatusQuery.data?.[adId] || null;
  };

  const creatives = useMemo(() => {
    let all = [...videosData, ...staticsData];
    if (filterType !== "All") all = all.filter(c => c.type === filterType);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      all = all.filter(c => c.title.toLowerCase().includes(q) || c.brandName.toLowerCase().includes(q));
    }
    if (sortBy === "quality") {
      all = [...all].sort((a, b) => (b.qualityScore ?? 0) - (a.qualityScore ?? 0));
    }
    return all;
  }, [videosData, staticsData, filterType, searchQuery, sortBy]);

  // Lazy on-view analysis: intersection observer triggers analysis for visible cards
  const analysisQueue = useRef<number[]>([]);
  const processingCount = useRef(0);
  const MAX_CONCURRENT = 3;

  const processAnalysisQueue = useCallback(() => {
    while (processingCount.current < MAX_CONCURRENT && analysisQueue.current.length > 0) {
      const dbId = analysisQueue.current.shift()!;
      processingCount.current++;
      analyzeMutation.mutateAsync({ dbId }).then(() => {
        videosQuery.refetch();
        staticsQuery.refetch();
      }).finally(() => {
        processingCount.current--;
        processAnalysisQueue();
      });
    }
  }, [analyzeMutation, videosQuery, staticsQuery]);

  const cardObserverRef = useCallback((node: HTMLElement | null, creative: Creative) => {
    if (!node || !creative.dbId || creative.summary || analyzingIds.current.has(creative.dbId)) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && creative.dbId) {
        analyzingIds.current.add(creative.dbId);
        analysisQueue.current.push(creative.dbId);
        processAnalysisQueue();
        observer.disconnect();
      }
    }, { threshold: 0.5 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [processAnalysisQueue]);

  const hasMore = filterType === "VIDEO" ? hasMoreVideos : filterType === "STATIC" ? hasMoreStatics : (hasMoreVideos || hasMoreStatics);

  const loadMore = useCallback(() => {
    if (filterType !== "STATIC" && hasMoreVideos) setVideoOffset(prev => prev + PAGE_SIZE);
    if (filterType !== "VIDEO" && hasMoreStatics) setStaticOffset(prev => prev + PAGE_SIZE);
  }, [filterType, hasMoreVideos, hasMoreStatics]);

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
  const estimatedCost = COST_BASE + (totalScripts * COST_PER_SCRIPT);

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

  const [aiSuggested, setAiSuggested] = useState<Set<string>>(new Set());

  const handleSelectCreative = (creative: Creative) => {
    setSelectedCreative(creative);

    // Auto-fill config from AI suggestion if available
    if (creative.suggestedConfig) {
      const cfg = creative.suggestedConfig as any;
      const suggested = new Set<string>();
      if (cfg.product) { setProduct(cfg.product); suggested.add("product"); }
      if (cfg.funnelStage) { setFunnelStage(cfg.funnelStage); suggested.add("funnelStage"); }
      if (cfg.duration) { setDuration(cfg.duration); suggested.add("duration"); }
      if (cfg.actorArchetype) { setActorArchetype(cfg.actorArchetype); suggested.add("actorArchetype"); }
      if (cfg.styleConfig?.length) {
        setStyleConfig(SCRIPT_STYLES.map(s => {
          const match = cfg.styleConfig.find((sc: any) => sc.styleId === s.id);
          return { styleId: s.id, quantity: match?.quantity || 0 };
        }));
        suggested.add("styleConfig");
      }
      setAiSuggested(suggested);
    } else {
      setAiSuggested(new Set());
    }

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
          aria-label="Sync creatives from Foreplay"
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

      {/* Filter Tabs + Search — only show in competitor mode */}
      {sourceType === "competitor" && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex gap-2">
            {(["All", "VIDEO", "STATIC"] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                aria-pressed={filterType === type}
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
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search by title or brand..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search creatives"
              className="w-full pl-10 pr-3 py-2 bg-[#191B1F] border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#FF3838]/50"
            />
          </div>
          <div className="flex gap-1" role="radiogroup" aria-label="Sort order">
            {([{ id: "newest", label: "Newest" }, { id: "quality", label: "Best Quality" }] as const).map((s) => (
              <button
                key={s.id}
                role="radio"
                aria-checked={sortBy === s.id}
                onClick={() => setSortBy(s.id)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  sortBy === s.id
                    ? "bg-[#FF3838] text-white"
                    : "bg-[#191B1F] text-gray-400 hover:text-white border border-white/10"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
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
                <>
                <div className="grid grid-cols-2 gap-4" role="grid" aria-label="Creative gallery">
                  {creatives.map((creative: Creative) => {
                    const pipelineStatus = getAdPipelineStatus(creative.id);
                    const isSelected = selectedCreative?.id === creative.id;
                    return (
                      <div
                        key={creative.id}
                        ref={(node) => cardObserverRef(node, creative)}
                        role="gridcell"
                        tabIndex={0}
                        aria-selected={isSelected}
                        aria-label={`${creative.type} ad: ${creative.title} by ${creative.brandName}${creative.qualityScore ? `. Quality score: ${creative.qualityScore} out of 10` : ""}`}
                        onClick={() => handleSelectCreative(creative)}
                        onDoubleClick={() => setDetailCreative(creative)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSelectCreative(creative); } }}
                        className={`cursor-pointer rounded-lg overflow-hidden border-2 transition-all relative focus:outline-none focus:ring-2 focus:ring-[#FF3838]/50 ${
                          isSelected
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

                        {/* Quality Score Badge */}
                        {creative.qualityScore != null && (
                          <div className={`absolute top-2 right-12 z-10 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold backdrop-blur-sm ${
                            creative.qualityScore >= 7 ? "bg-emerald-500/90 text-white"
                            : creative.qualityScore >= 4 ? "bg-amber-500/90 text-white"
                            : "bg-red-500/90 text-white"
                          }`}>
                            {creative.qualityScore}/10
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
                          {creative.summary ? (
                            <p className="text-xs text-gray-500 truncate mt-1">{creative.summary}</p>
                          ) : creative.dbId && analyzingIds.current.has(creative.dbId) ? (
                            <div className="mt-1 h-3 bg-gray-800 rounded animate-pulse" aria-busy="true" />
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {hasMore && sourceType === "competitor" && (
                  <div className="flex justify-center mt-4">
                    <Button
                      variant="outline"
                      onClick={loadMore}
                      disabled={videosQuery.isLoading || staticsQuery.isLoading}
                      className="border-gray-700 text-gray-300 hover:bg-gray-800"
                    >
                      {(videosQuery.isLoading || staticsQuery.isLoading) ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading...</>
                      ) : (
                        "Load More"
                      )}
                    </Button>
                  </div>
                )}
                </>
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
                  <label className="text-xs font-medium text-gray-300 mb-2 block">
                    Product {aiSuggested.has("product") && <span className="text-emerald-400 ml-1">★ AI</span>}
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {ACTIVE_PRODUCTS.map((p) => (
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
                        <label className="text-xs font-medium text-gray-300">Funnel Stage {aiSuggested.has("funnelStage") && <span className="text-emerald-400 ml-1">★ AI</span>}</label>
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
                        <label className="text-xs font-medium text-gray-300">Script Styles {aiSuggested.has("styleConfig") && <span className="text-emerald-400 ml-1">★ AI</span>}</label>
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
                          <div>Base (transcription + analysis + brief): ${COST_BASE.toFixed(2)}</div>
                          <div>{totalScripts} script{totalScripts === 1 ? "" : "s"} x ${COST_PER_SCRIPT.toFixed(2)} (generation + review): ${(totalScripts * COST_PER_SCRIPT).toFixed(2)}</div>
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

      {/* Detail Modal — opens on double-click */}
      {detailCreative && (
        <CreativeDetailModal
          creative={detailCreative}
          onClose={() => setDetailCreative(null)}
          onRunPipeline={() => {
            handleSelectCreative(detailCreative);
          }}
        />
      )}
    </div>
  );
}
