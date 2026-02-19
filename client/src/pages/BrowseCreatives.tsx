import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Play, Image as ImageIcon, Filter, Loader2, ChevronRight, CheckCircle, Clock } from "lucide-react";

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

const PRODUCTS = ["Hyperburn", "Thermosleep", "Hyperload", "Thermoburn", "Carb Control"];
const PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;

export default function BrowseCreatives() {
  const [filterType, setFilterType] = useState<"All" | "VIDEO" | "STATIC">("All");
  const [selectedCreative, setSelectedCreative] = useState<Creative | null>(null);
  const [product, setProduct] = useState("Hyperburn");
  const [priority, setPriority] = useState<typeof PRIORITIES[number]>("Medium");
  const [, setLocation] = useLocation();

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

  // FEATURE 2: Fetch pipeline history to show badges
  const pipelineHistory = trpc.pipeline.list.useQuery();

  // Build a set of foreplayAdIds that have been processed
  const processedAdIds = useMemo(() => {
    const ids = new Set<string>();
    if (pipelineHistory.data) {
      for (const run of pipelineHistory.data) {
        if (run.foreplayAdId) ids.add(run.foreplayAdId);
      }
    }
    return ids;
  }, [pipelineHistory.data]);

  // Get pipeline status for a specific ad
  const getAdPipelineStatus = (adId: string): { status: string; count: number } | null => {
    if (!pipelineHistory.data) return null;
    const runs = pipelineHistory.data.filter(r => r.foreplayAdId === adId);
    if (runs.length === 0) return null;
    const latestRun = runs[0]; // already sorted by createdAt desc
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
      isNew: ad.isNew,
    }));

    const all = [...videos, ...statics];
    if (filterType === "All") return all;
    return all.filter(c => c.type === filterType);
  }, [videosQuery.data, staticsQuery.data, filterType]);

  // FIX 1: Video mutation now passes the selected creative's data
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

  const handleRunPipeline = () => {
    if (!selectedCreative) return;

    if (selectedCreative.type === "VIDEO") {
      triggerVideoMutation.mutate({
        product,
        priority,
        foreplayAdId: selectedCreative.id,
        foreplayAdTitle: selectedCreative.title,
        foreplayAdBrand: selectedCreative.brandName,
        mediaUrl: selectedCreative.mediaUrl || "",
        thumbnailUrl: selectedCreative.thumbnailUrl,
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
  };

  const isLoading = videosQuery.isLoading || staticsQuery.isLoading;
  const isPending = triggerVideoMutation.isPending || triggerStaticMutation.isPending;
  const isSyncing = syncMutation.isPending;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Browse Creatives</h1>
          <p className="text-gray-400 text-sm">
            Select a video or static ad from Foreplay to use as reference for your pipeline
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

      {/* Filter Tabs */}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gallery Grid */}
        <div className="lg:col-span-2">
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
                        ) : creative.type === "STATIC" && creative.imageUrl ? (
                          <img
                            src={creative.imageUrl}
                            alt={creative.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-gray-500">
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
        </div>

        {/* Configuration Panel */}
        <div className="lg:col-span-1">
          <div className="bg-[#191B1F] border border-white/5 rounded-xl p-6 sticky top-6 space-y-6">
            {selectedCreative ? (
              <>
                <div>
                  <h3 className="text-lg font-bold text-white mb-4">Configuration</h3>

                  {/* Selected Creative Preview */}
                  <div className="mb-6 p-4 bg-[#0F1117] rounded-lg border border-white/10">
                    <div className="aspect-square rounded-lg overflow-hidden mb-3 bg-[#01040A]">
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
                    <span className={`text-xs font-bold px-2 py-1 rounded mt-2 inline-block ${
                      selectedCreative.type === "VIDEO"
                        ? "bg-blue-900/50 text-blue-300"
                        : "bg-purple-900/50 text-purple-300"
                    }`}>
                      {selectedCreative.type}
                    </span>
                  </div>

                  {/* Product Selection */}
                  <div className="mb-6">
                    <label className="text-xs font-medium text-gray-300 mb-2 block">Product</label>
                    <div className="grid grid-cols-2 gap-2">
                      {PRODUCTS.map((p) => (
                        <button
                          key={p}
                          onClick={() => setProduct(p)}
                          className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                            product === p
                              ? "bg-[#FF3838] text-white"
                              : "bg-[#01040A] text-gray-400 hover:text-white border border-white/10"
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Priority Selection */}
                  <div className="mb-6">
                    <label className="text-xs font-medium text-gray-300 mb-2 block">Priority</label>
                    <div className="grid grid-cols-2 gap-2">
                      {PRIORITIES.map((p) => (
                        <button
                          key={p}
                          onClick={() => setPriority(p)}
                          className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                            priority === p
                              ? "bg-[#FF3838] text-white"
                              : "bg-[#01040A] text-gray-400 hover:text-white border border-white/10"
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Run Pipeline Button */}
                  <Button
                    onClick={handleRunPipeline}
                    disabled={isPending}
                    className="w-full bg-[#FF3838] hover:bg-[#FF3838]/90 text-white h-10 text-sm"
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Running...
                      </>
                    ) : (
                      <>
                        <ChevronRight className="w-4 h-4 mr-2" />
                        Run {selectedCreative.type === "VIDEO" ? "Video" : "Static"} Pipeline
                      </>
                    )}
                  </Button>

                  {/* Pipeline type description */}
                  <p className="text-xs text-gray-500 mt-3">
                    {selectedCreative.type === "VIDEO"
                      ? "Video pipeline: Transcription → Visual Analysis → 4 Script Variants → Expert Review → ClickUp"
                      : "Static pipeline: Analysis → Brief → Expert Review → 3 Image Variations → Expert Review → Team Approval → ClickUp"}
                  </p>
                </div>
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
