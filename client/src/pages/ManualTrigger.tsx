import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Zap, Loader2 } from "lucide-react";

const PRODUCTS = ["HB", "HyperBurn", "SuperGreens", "EAA", "Creatine", "Pre-Workout"];
const PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;

export default function ManualTrigger() {
  const [product, setProduct] = useState("HB");
  const [priority, setPriority] = useState<typeof PRIORITIES[number]>("Medium");
  const [, setLocation] = useLocation();

  const triggerMutation = trpc.pipeline.triggerVideo.useMutation({
    onSuccess: (data) => {
      toast.success("Pipeline triggered successfully!");
      setLocation(`/results/${data.runId}`);
    },
    onError: (err) => {
      toast.error("Failed to trigger pipeline: " + err.message);
    },
  });

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-white mb-2">Manual Trigger</h1>
      <p className="text-gray-400 text-sm mb-8">
        Manually trigger a pull from the Foreplay #inspo board, select product and priority, and run the full video pipeline.
      </p>

      <div className="bg-[#191B1F] border border-white/5 rounded-xl p-6 space-y-6">
        {/* Product Selection */}
        <div>
          <label className="text-sm font-medium text-gray-300 mb-3 block">Product</label>
          <div className="grid grid-cols-3 gap-2">
            {PRODUCTS.map((p) => (
              <button
                key={p}
                onClick={() => setProduct(p)}
                className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  product === p
                    ? "bg-emerald-600 text-white"
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
          <label className="text-sm font-medium text-gray-300 mb-3 block">Priority</label>
          <div className="grid grid-cols-4 gap-2">
            {PRIORITIES.map((p) => (
              <button
                key={p}
                onClick={() => setPriority(p)}
                className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  priority === p
                    ? "bg-emerald-600 text-white"
                    : "bg-[#01040A] text-gray-400 hover:text-white border border-white/10"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Trigger Button */}
        <Button
          onClick={() => triggerMutation.mutate({ product, priority })}
          disabled={triggerMutation.isPending}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 text-base"
        >
          {triggerMutation.isPending ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Running Pipeline...
            </>
          ) : (
            <>
              <Zap className="w-5 h-5 mr-2" />
              Run Video Pipeline
            </>
          )}
        </Button>

        <div className="text-xs text-gray-500 space-y-1">
          <p>Pipeline steps: Foreplay Pull → Video Download → Audio Extraction → Whisper Transcription → Claude Vision Analysis → Script Generation (4) → Expert Review Panel → ClickUp Task Creation</p>
        </div>
      </div>
    </div>
  );
}
