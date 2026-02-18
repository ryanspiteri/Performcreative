import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Image, Loader2, Check, RefreshCw } from "lucide-react";

const PRODUCTS = ["HB", "HyperBurn", "SuperGreens", "EAA", "Creatine", "Pre-Workout"];
const PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;

export default function StaticPipeline() {
  const [product, setProduct] = useState("HB");
  const [priority, setPriority] = useState<typeof PRIORITIES[number]>("Medium");
  const [selectedAds, setSelectedAds] = useState<Set<string>>(new Set());
  const [, setLocation] = useLocation();

  const { data: ads, isLoading, refetch } = trpc.pipeline.fetchForeplayStatics.useQuery();

  const triggerMutation = trpc.pipeline.triggerStatic.useMutation({
    onSuccess: (data) => {
      toast.success("Static pipeline triggered!");
      setLocation(`/results/${data.runId}`);
    },
    onError: (err) => {
      toast.error("Failed: " + err.message);
    },
  });

  const toggleAd = (id: string) => {
    setSelectedAds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleTrigger = () => {
    if (selectedAds.size === 0) {
      toast.error("Please select at least one ad");
      return;
    }
    const selected = (ads || []).filter(a => selectedAds.has(a.id));
    triggerMutation.mutate({
      product,
      priority,
      selectedAdIds: Array.from(selectedAds),
      selectedAdImages: selected.map(a => ({
        id: a.id,
        imageUrl: a.imageUrl || a.thumbnailUrl || a.mediaUrl || "",
        brandName: a.brandName,
        title: a.title,
      })),
    });
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Static Ads Pipeline</h1>
          <p className="text-gray-400 text-sm mt-1">Browse competitor static ads from Foreplay, select references, and generate ONEST creatives</p>
        </div>
        <Button
          variant="outline"
          onClick={() => refetch()}
          className="border-white/10 text-gray-300 hover:text-white"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Config Row */}
      <div className="bg-[#191B1F] border border-white/5 rounded-xl p-4 mb-6 flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Product:</span>
          <select
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            className="bg-[#01040A] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white"
          >
            {PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Priority:</span>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as any)}
            className="bg-[#01040A] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white"
          >
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="flex-1" />
        <span className="text-sm text-gray-400">{selectedAds.size} selected</span>
        <Button
          onClick={handleTrigger}
          disabled={triggerMutation.isPending || selectedAds.size === 0}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {triggerMutation.isPending ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing...</>
          ) : (
            <><Image className="w-4 h-4 mr-2" /> Analyze & Generate</>
          )}
        </Button>
      </div>

      {/* Ad Gallery */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          <span className="ml-3 text-gray-400">Loading ads from Foreplay static_inspo board...</span>
        </div>
      ) : !ads || ads.length === 0 ? (
        <div className="bg-[#191B1F] border border-white/5 rounded-xl p-12 text-center">
          <Image className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 mb-2">No static ads found on the Foreplay board</p>
          <p className="text-gray-500 text-sm">Check that the static_inspo board exists under Competitor_inspo folder</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {ads.map((ad) => {
            const isSelected = selectedAds.has(ad.id);
            const imageUrl = ad.imageUrl || ad.thumbnailUrl || ad.mediaUrl || "";
            return (
              <button
                key={ad.id}
                onClick={() => toggleAd(ad.id)}
                className={`relative bg-[#191B1F] border rounded-xl overflow-hidden transition-all group ${
                  isSelected ? "border-emerald-500 ring-2 ring-emerald-500/30" : "border-white/5 hover:border-white/20"
                }`}
              >
                {/* Image */}
                <div className="aspect-square bg-[#0D0F12] flex items-center justify-center overflow-hidden">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={ad.title || "Ad"}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <Image className="w-8 h-8 text-gray-600" />
                  )}
                </div>

                {/* Selection indicator */}
                {isSelected && (
                  <div className="absolute top-2 right-2 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}

                {/* Info */}
                <div className="p-3">
                  <p className="text-white text-xs font-medium truncate">{ad.title || "Untitled"}</p>
                  <p className="text-gray-500 text-xs truncate">{ad.brandName || "Unknown brand"}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
