import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Upload, ArrowRight, Loader2, CheckCircle, XCircle, RefreshCw, Sparkles, Eye, Copy, Download, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const PRODUCTS = [
  "Hyperburn",
  "HyperLoad",
  "HyperSleep",
  "HyperGrowth",
  "SuperGreens",
  "CollagenPlus",
];

export default function IterateWinners() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<"upload" | "running" | "results">("upload");
  const [product, setProduct] = useState(PRODUCTS[0]);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [uploadedImageName, setUploadedImageName] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [runId, setRunId] = useState<number | null>(null);

  const triggerIteration = trpc.pipeline.triggerIteration.useMutation();
  const uploadRender = trpc.renders.upload.useMutation();

  // File upload handler
  const handleFileUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be under 10MB");
      return;
    }

    setUploading(true);
    try {
      // Convert to base64
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]); // Remove data:image/... prefix
        };
        reader.readAsDataURL(file);
      });

      // Upload to S3 via tRPC mutation
      const result = await uploadRender.mutateAsync({
        product: "iteration-source",
        fileName: file.name.replace(/\.[^.]+$/, ""),
        mimeType: file.type,
        base64Data: base64,
      });

      if (!result.url) {
        throw new Error("Upload failed — no URL returned");
      }

      setUploadedImageUrl(result.url);
      setUploadedImageName(file.name);
      toast.success("Image uploaded successfully");
    } catch (err: any) {
      toast.error(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  }, [uploadRender]);

  // Drag and drop handlers
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  // Start the iteration pipeline
  const handleStartPipeline = async () => {
    if (!uploadedImageUrl) {
      toast.error("Please upload a winning ad first");
      return;
    }

    try {
      const result = await triggerIteration.mutateAsync({
        product,
        priority: "Medium",
        sourceImageUrl: uploadedImageUrl,
        sourceImageName: uploadedImageName,
      });
      setRunId(result.runId);
      setLocation(`/results/${result.runId}`);
    } catch (err: any) {
      toast.error(`Failed to start pipeline: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#01040A] p-6">
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <RefreshCw className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Iterate on Winners</h1>
            <p className="text-gray-400 text-sm">Upload a winning ad and generate 3 new variations with different copy angles</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto">
        {/* Step 1: Upload & Configure */}
        <div className="bg-[#0D0F12] border border-white/5 rounded-2xl p-8">
          {/* Product Selection */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-300 mb-3">Select Product</label>
            <div className="grid grid-cols-3 gap-2">
              {PRODUCTS.map((p) => (
                <button
                  key={p}
                  onClick={() => setProduct(p)}
                  className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    product === p
                      ? "bg-[#FF3838] text-white shadow-lg shadow-red-500/20"
                      : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Upload Area */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-300 mb-3">Upload Your Winning Ad</label>
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className={`relative border-2 border-dashed rounded-2xl transition-all ${
                uploadedImageUrl
                  ? "border-green-500/30 bg-green-500/5"
                  : "border-white/10 hover:border-white/20 bg-white/[0.02]"
              }`}
            >
              {uploading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Loader2 className="w-10 h-10 text-[#FF3838] animate-spin mb-3" />
                  <p className="text-gray-400 text-sm">Uploading...</p>
                </div>
              ) : uploadedImageUrl ? (
                <div className="p-4">
                  <div className="flex gap-6">
                    <div className="w-48 h-48 rounded-xl overflow-hidden bg-black/50 shrink-0">
                      <img
                        src={uploadedImageUrl}
                        alt="Winning ad"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="flex-1 flex flex-col justify-center">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        <span className="text-green-400 font-medium text-sm">Image uploaded</span>
                      </div>
                      <p className="text-white font-medium mb-1">{uploadedImageName}</p>
                      <p className="text-gray-500 text-xs mb-4">Click or drag to replace</p>
                      <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 text-gray-300 text-sm cursor-pointer hover:bg-white/10 transition-colors w-fit">
                        <Upload className="w-4 h-4" />
                        Replace Image
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(file);
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center py-16 cursor-pointer">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                    <Upload className="w-8 h-8 text-gray-500" />
                  </div>
                  <p className="text-white font-medium mb-1">Drop your winning ad here</p>
                  <p className="text-gray-500 text-sm mb-4">or click to browse (PNG, JPG, up to 10MB)</p>
                  <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#FF3838]/10 text-[#FF3838] text-sm font-medium">
                    <Upload className="w-4 h-4" />
                    Choose File
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file);
                    }}
                  />
                </label>
              )}
            </div>
          </div>

          {/* How it works */}
          <div className="mb-8 p-5 rounded-xl bg-white/[0.02] border border-white/5">
            <h3 className="text-white font-medium text-sm mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              How Iteration Works
            </h3>
            <div className="grid grid-cols-4 gap-4">
              {[
                { step: "1", title: "Upload", desc: "Your winning ad" },
                { step: "2", title: "Analyse", desc: "AI extracts visual DNA" },
                { step: "3", title: "Brief", desc: "3 new copy angles" },
                { step: "4", title: "Generate", desc: "3 variation images" },
              ].map((s) => (
                <div key={s.step} className="text-center">
                  <div className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 text-sm font-bold flex items-center justify-center mx-auto mb-2">
                    {s.step}
                  </div>
                  <p className="text-white text-xs font-medium">{s.title}</p>
                  <p className="text-gray-500 text-[10px]">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Start Button */}
          <button
            onClick={handleStartPipeline}
            disabled={!uploadedImageUrl || triggerIteration.isPending}
            className={`w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-3 ${
              uploadedImageUrl && !triggerIteration.isPending
                ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-500 hover:to-pink-500 shadow-lg shadow-purple-500/20"
                : "bg-white/5 text-gray-600 cursor-not-allowed"
            }`}
          >
            {triggerIteration.isPending ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Starting Pipeline...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Generate 3 Variations
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>

        {/* Recent Iteration Runs */}
        <RecentIterationRuns />
      </div>
    </div>
  );
}

function RecentIterationRuns() {
  const [, setLocation] = useLocation();
  const { data: runs } = trpc.pipeline.list.useQuery();

  const iterationRuns = runs?.filter((r: any) => r.pipelineType === "iteration") || [];

  if (iterationRuns.length === 0) return null;

  return (
    <div className="mt-8">
      <h2 className="text-white font-semibold text-lg mb-4">Recent Iterations</h2>
      <div className="space-y-3">
        {iterationRuns.slice(0, 10).map((run: any) => (
          <button
            key={run.id}
            onClick={() => setLocation(`/results/${run.id}`)}
            className="w-full bg-[#0D0F12] border border-white/5 rounded-xl p-4 flex items-center gap-4 hover:bg-white/[0.03] transition-colors text-left"
          >
            {run.iterationSourceUrl && (
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-black/50 shrink-0">
                <img src={run.iterationSourceUrl} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex-1">
              <p className="text-white text-sm font-medium">{run.foreplayAdTitle || "Iteration"}</p>
              <p className="text-gray-500 text-xs">{run.product} · {new Date(run.createdAt).toLocaleDateString()}</p>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-medium ${
              run.status === "completed" ? "bg-green-500/10 text-green-400" :
              run.status === "running" ? "bg-blue-500/10 text-blue-400" :
              "bg-red-500/10 text-red-400"
            }`}>
              {run.status === "completed" ? "Completed" :
               run.status === "running" ? (run.iterationStage === "stage_2b_approval" ? "Awaiting Approval" : "Processing") :
               "Failed"}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
