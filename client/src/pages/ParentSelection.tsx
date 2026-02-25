import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { useLocation } from "wouter";
import { Loader2, Sparkles, CheckSquare, Square, ArrowLeft, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

export default function ParentSelection() {
  const [, setLocation] = useLocation();
  const [selectedParents, setSelectedParents] = useState<number[]>([]);
  const [childCount, setChildCount] = useState(5);

  const { data: runs, isLoading } = trpc.pipeline.list.useQuery();
  const utils = trpc.useUtils();

  const generateChildren = trpc.pipeline.generateChildren.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setSelectedParents([]);
      utils.pipeline.list.invalidate();
      setLocation("/");
    },
    onError: (err) => {
      toast.error(`Failed to generate children: ${err.message}`);
    },
  });

  // Filter for completed parent runs from iteration pipeline
  const parentRuns = runs?.filter(
    (run) =>
      run.pipelineType === "iteration" &&
      run.status === "completed" &&
      (run.variationLayer === "parent" || !run.variationLayer) && // null means it's a parent (old runs)
      run.iterationVariations &&
      Array.isArray(run.iterationVariations) &&
      run.iterationVariations.length > 0
  ) || [];

  const toggleParent = (runId: number) => {
    setSelectedParents((prev) =>
      prev.includes(runId) ? prev.filter((id) => id !== runId) : [...prev, runId]
    );
  };

  const toggleAll = () => {
    if (selectedParents.length === parentRuns.length) {
      setSelectedParents([]);
    } else {
      setSelectedParents(parentRuns.map((r) => r.id));
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-[#FF3838] animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => setLocation("/")}
          className="text-gray-400 hover:text-white flex items-center gap-1 text-sm mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>
        <h1 className="text-2xl font-bold text-white mb-2">Generate Child Variations</h1>
        <p className="text-gray-400 text-sm">
          Select parent variations to expand with tactical child variations (color shifts, lighting changes, typography tweaks, etc.)
        </p>
      </div>

      {/* Controls */}
      <div className="bg-[#191B1F] border border-white/5 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={toggleAll}
              className="flex items-center gap-2 text-sm text-gray-300 hover:text-white"
            >
              {selectedParents.length === parentRuns.length ? (
                <CheckSquare className="w-4 h-4 text-[#FF3838]" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              Select All ({parentRuns.length})
            </button>

            <div className="h-4 w-px bg-white/10" />

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Children per parent:</span>
              <select
                value={childCount}
                onChange={(e) => setChildCount(Number(e.target.value))}
                disabled={generateChildren.isPending}
                className="bg-[#01040A] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white disabled:opacity-50"
              >
                <option value={5}>5 variations</option>
                <option value={10}>10 variations</option>
              </select>
            </div>
          </div>

          <button
            onClick={() => generateChildren.mutate({ parentRunIds: selectedParents, childCount })}
            disabled={selectedParents.length === 0 || generateChildren.isPending}
            className="flex items-center gap-2 bg-[#FF3838] hover:bg-[#FF3838]/80 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generateChildren.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate {selectedParents.length * childCount} Children
                {selectedParents.length > 0 && ` (${selectedParents.length} × ${childCount})`}
              </>
            )}
          </button>
        </div>

        {selectedParents.length > 0 && (
          <div className="mt-4 p-3 bg-[#FF3838]/10 border border-[#FF3838]/20 rounded-lg">
            <p className="text-sm text-[#FF3838]">
              <strong>{selectedParents.length}</strong> parents selected →{" "}
              <strong>{selectedParents.length * childCount}</strong> children will be generated
            </p>
          </div>
        )}
      </div>

      {/* Parent Grid */}
      {parentRuns.length === 0 ? (
        <div className="bg-[#191B1F] border border-white/5 rounded-xl p-12 text-center">
          <ImageIcon className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-white font-medium mb-2">No parent variations available</h3>
          <p className="text-gray-400 text-sm mb-4">
            Complete some iteration pipeline runs first, then come back here to generate child variations.
          </p>
          <button
            onClick={() => setLocation("/")}
            className="bg-[#FF3838] hover:bg-[#FF3838]/80 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            Go to Dashboard
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {parentRuns.map((run) => {
            const isSelected = selectedParents.includes(run.id);
            const firstVariation = (run.iterationVariations as any[])?.[0];
            const thumbnail = firstVariation?.url;
            const headline = firstVariation?.headline || `${run.product} Variation`;

            return (
              <button
                key={run.id}
                onClick={() => toggleParent(run.id)}
                className={`relative rounded-xl overflow-hidden border-2 transition-all ${
                  isSelected
                    ? "border-[#FF3838] shadow-lg shadow-[#FF3838]/20"
                    : "border-white/10 hover:border-white/20"
                }`}
              >
                {/* Selection Indicator */}
                <div className="absolute top-2 left-2 z-10">
                  {isSelected ? (
                    <CheckSquare className="w-5 h-5 text-[#FF3838] bg-white rounded" />
                  ) : (
                    <Square className="w-5 h-5 text-white/50 bg-black/50 rounded" />
                  )}
                </div>

                {/* Thumbnail */}
                {thumbnail ? (
                  <img
                    src={thumbnail}
                    alt={headline}
                    className="w-full aspect-square object-cover"
                  />
                ) : (
                  <div className="w-full aspect-square bg-[#191B1F] flex items-center justify-center">
                    <ImageIcon className="w-12 h-12 text-gray-600" />
                  </div>
                )}

                {/* Info Overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3">
                  <p className="text-white font-semibold text-sm line-clamp-2">{headline}</p>
                  <p className="text-gray-400 text-xs mt-1">
                    Run #{run.id} · {run.product}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
