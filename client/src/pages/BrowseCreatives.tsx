import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Play, Image as ImageIcon, Filter, Loader2, ChevronRight } from "lucide-react";

type Creative = {
  id: string;
  type: "VIDEO" | "STATIC";
  title: string;
  brandName: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  mediaUrl?: string;
};

const PRODUCTS = ["HB", "HyperBurn", "SuperGreens", "EAA", "Creatine", "Pre-Workout"];
const PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;

export default function BrowseCreatives() {
  const [filterType, setFilterType] = useState<"All" | "VIDEO" | "STATIC">("All");
  const [selectedCreative, setSelectedCreative] = useState<Creative | null>(null);
  const [product, setProduct] = useState("HB");
  const [priority, setPriority] = useState<typeof PRIORITIES[number]>("Medium");
  const [, setLocation] = useLocation();

  // Fetch both video and static ads
  const videosQuery = trpc.pipeline.fetchForeplayVideos.useQuery();
  const staticsQuery = trpc.pipeline.fetchForeplayStatics.useQuery();

  // Combine and filter creatives
  const creatives = useMemo(() => {
    const videos: Creative[] = (videosQuery.data || []).map((ad: any) => ({
      id: ad.id,
      type: "VIDEO" as const,
      title: ad.title || "Untitled Video",
      brandName: ad.brandName || "Unknown",
      thumbnailUrl: ad.thumbnailUrl,
      mediaUrl: ad.mediaUrl,
    }));

    const statics: Creative[] = (staticsQuery.data || []).map((ad: any) => ({
      id: ad.id,
      type: "STATIC" as const,
      title: ad.title || "Untitled Static",
      brandName: ad.brandName || "Unknown",
      imageUrl: ad.imageUrl,
    }));

    const all = [...videos, ...statics];
    if (filterType === "All") return all;
    return all.filter(c => c.type === filterType);
  }, [videosQuery.data, staticsQuery.data, filterType]);

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
      triggerVideoMutation.mutate({ product, priority });
    } else {
      triggerStaticMutation.mutate({
        product,
        priority,
        selectedAdIds: [selectedCreative.id],
        selectedAdImages: [{
          id: selectedCreative.id,
          imageUrl: selectedCreative.imageUrl || "",
          brandName: selectedCreative.brandName,
          title: selectedCreative.title,
        }],
      });
    }
  };

  const isLoading = videosQuery.isLoading || staticsQuery.isLoading;
  const isPending = triggerVideoMutation.isPending || triggerStaticMutation.isPending;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Browse Creatives</h1>
        <p className="text-gray-400 text-sm">
          Select a video or static ad from Foreplay to use as reference for your pipeline
        </p>
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
                {creatives.map((creative) => (
                  <div
                    key={creative.id}
                    onClick={() => setSelectedCreative(creative)}
                    className={`cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                      selectedCreative?.id === creative.id
                        ? "border-[#FF3838] shadow-lg shadow-[#FF3838]/20"
                        : "border-white/10 hover:border-white/20"
                    }`}
                  >
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
                ))}
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
