import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Upload, ArrowRight, Loader2, CheckCircle, XCircle, RefreshCw, Sparkles, Eye, Copy, Download, ExternalLink, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const PRODUCTS = [
  "Hyperburn",
  "HyperLoad",
  "HyperSleep",
  "HyperGrowth",
  "SuperGreens",
  "CollagenPlus",
];

type CreativityLevel = "SAFE" | "BOLD" | "WILD";
type VariationType = "headline_only" | "background_only" | "layout_only" | "benefit_callouts_only" | "props_only" | "talent_swap" | "full_remix";
type AspectRatio = "1:1" | "4:5" | "9:16" | "16:9";

export default function IterateWinners() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<"upload" | "running" | "results">("upload");
  const [product, setProduct] = useState(PRODUCTS[0]);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [uploadedImageName, setUploadedImageName] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [runId, setRunId] = useState<number | null>(null);
  const [creativityLevel, setCreativityLevel] = useState<CreativityLevel>("BOLD");
  const [variationType, setVariationType] = useState<VariationType>("full_remix"); // Changed to single selection
  const [variationCount, setVariationCount] = useState(5);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  const [showConfirmation, setShowConfirmation] = useState(false);

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

  // Calculate cost (Nano Banana Pro pricing: $0.12 per image for 1:1/4:5, $0.24 for 9:16/16:9)
  const estimatedCost = variationCount * (aspectRatio === '1:1' || aspectRatio === '4:5' ? 0.12 : 0.24);

  // Start the iteration pipeline
  const handleStartPipeline = async () => {
    if (!uploadedImageUrl) {
      toast.error("Please upload a winning ad first");
      return;
    }

    // Show confirmation dialog
    setShowConfirmation(true);
  };

  const confirmAndStart = async () => {
    setShowConfirmation(false);
    
    try {
      const result = await triggerIteration.mutateAsync({
        product,
        priority: "Medium",
        sourceImageUrl: uploadedImageUrl!,
        sourceImageName: uploadedImageName,
        creativityLevel,
        variationTypes: [variationType], // Now single selection
        variationCount,
        aspectRatio,
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
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Iterate on Winners</h1>
              <p className="text-gray-400 text-sm">Upload a winning ad and generate new variations with different copy angles</p>
            </div>
          </div>
          <button
            onClick={() => setLocation("/iterate/generate-children")}
            className="flex items-center gap-2 bg-[#FF3838] hover:bg-[#FF3838]/80 text-white px-5 py-3 rounded-lg text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-[#FF3838] focus:ring-offset-2 focus:ring-offset-[#01040A]"
          >
            <Sparkles className="w-4 h-4" />
            Generate Children
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto">
        {/* Step 1: Upload & Configure */}
        <div className="bg-[#0D0F12] border border-white/5 rounded-2xl p-8">
          
          {/* MOVED UP: Cost Calculator - Now First */}
          <div className="mb-8">
            <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-400 mb-1">Estimated Cost</div>
                  <div className="text-3xl font-bold text-white">
                    ${estimatedCost.toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {variationCount} variation{variationCount === 1 ? '' : 's'} × ${aspectRatio === '1:1' || aspectRatio === '4:5' ? '0.12' : '0.24'} per image
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-400 mb-2">Estimated Time</div>
                  <div className="px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm font-semibold text-amber-300">
                    {variationCount * 2}-{variationCount * 3} min
                  </div>
                  <div className="text-xs text-gray-500 mt-2">Resolution: {aspectRatio === '1:1' ? '2048×2048' : aspectRatio === '4:5' ? '2048×2560' : aspectRatio === '9:16' ? '2304×4096' : '4096×2304'}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Product Selection */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-300 mb-3">Select Product</label>
            <div className="grid grid-cols-3 gap-2">
              {PRODUCTS.map((p) => (
                <button
                  key={p}
                  onClick={() => setProduct(p)}
                  className={`px-4 py-3 rounded-xl text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0D0F12] ${
                    product === p
                      ? "bg-[#FF3838] text-white shadow-lg shadow-red-500/20 focus:ring-[#FF3838]"
                      : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white focus:ring-white/20"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Creativity Slider */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-300 mb-3">Creative Risk Level</label>
            <div className="bg-white/5 rounded-xl p-6">
              <div className="flex gap-2 mb-4">
                {(['SAFE', 'BOLD', 'WILD'] as CreativityLevel[]).map((level) => (
                  <button
                    key={level}
                    onClick={() => setCreativityLevel(level)}
                    className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white/5 ${
                      creativityLevel === level
                        ? level === 'SAFE'
                          ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20 focus:ring-blue-400"
                          : level === 'BOLD'
                          ? "bg-[#A78BFA] text-white shadow-lg shadow-purple-500/20 focus:ring-[#A78BFA]"
                          : "bg-red-500 text-white shadow-lg shadow-red-500/20 focus:ring-red-400"
                        : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white focus:ring-white/20"
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
              <div className="text-sm text-gray-300 leading-relaxed">
                {creativityLevel === 'SAFE' && (
                  <p><span className="font-semibold text-blue-400">SAFE:</span> Minor headline tweaks, same visual style. Low risk, proven patterns. Example: "30 Days to Shredded" → "Transform in 30 Days"</p>
                )}
                {creativityLevel === 'BOLD' && (
                  <p><span className="font-semibold text-purple-400">BOLD:</span> New headlines + background variations. Moderate risk, higher upside. Example: Fire background → Ice/transformation theme. <span className="text-purple-300">(Recommended)</span></p>
                )}
                {creativityLevel === 'WILD' && (
                  <p><span className="font-semibold text-red-400">WILD:</span> Completely different concepts. High risk, moonshot potential. Example: Product-focused → Lifestyle/aspirational scene. May polarise but deeply resonate.</p>
                )}
              </div>
            </div>
          </div>

          {/* FIXED: Variation Type Selector - Single Select Radio Buttons */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Variation Strategy
            </label>
            <div className="bg-white/5 rounded-xl p-6">
              <p className="text-sm text-gray-300 mb-4">
                Choose which element to test. The system will generate {variationCount} variation{variationCount === 1 ? '' : 's'} testing this variable whilst keeping other elements similar to your control ad.
              </p>
              <div className="space-y-2">
                {([
                  { value: 'full_remix', label: 'Full Remix', desc: 'Test everything — headlines, backgrounds, layouts, benefits. Maximum creative diversity.' },
                  { value: 'headline_only', label: 'Headline Only', desc: 'Test different headlines whilst keeping background, layout, and benefits consistent.' },
                  { value: 'background_only', label: 'Background Only', desc: 'Test different background colours/styles whilst keeping headline and layout consistent.' },
                  { value: 'layout_only', label: 'Layout Only', desc: 'Test product placement and text positioning whilst keeping headline and background consistent.' },
                  { value: 'benefit_callouts_only', label: 'Benefits Only', desc: 'Test different benefit copy whilst keeping headline and visual style consistent.' },
                  { value: 'props_only', label: 'Props Only', desc: 'Test different visual metaphors/props whilst keeping headline and layout consistent.' },
                  { value: 'talent_swap', label: 'Talent Swap', desc: 'Test different people/models whilst keeping headline and composition consistent.' },
                ] as const).map((type) => {
                  const isSelected = variationType === type.value;
                  return (
                    <button
                      key={type.value}
                      onClick={() => setVariationType(type.value)}
                      className={`w-full px-4 py-3 rounded-lg text-left transition-all flex items-start gap-3 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white/5 ${
                        isSelected
                          ? "bg-[#FF3838] text-white shadow-lg shadow-red-500/20 focus:ring-[#FF3838]"
                          : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white focus:ring-white/20"
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        isSelected ? "border-white bg-white" : "border-gray-500"
                      }`}>
                        {isSelected && (
                          <div className="w-2.5 h-2.5 rounded-full bg-[#FF3838]" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-sm mb-1">{type.label}</div>
                        <div className="text-xs opacity-90 leading-relaxed">{type.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Variation Count Dropdown */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Number of Variations
            </label>
            <div className="bg-white/5 rounded-xl p-6">
              {/* Warning Banner for Nano Banana Pro */}
              <div className="mb-4 bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-300 mb-1">⏱️ Premium Quality = Longer Wait</p>
                  <p className="text-xs text-amber-200/90 leading-relaxed">
                    Nano Banana Pro generates production-quality images with perfect text rendering, but takes <strong>2-3 minutes per image</strong>. Generating {variationCount} variation{variationCount === 1 ? '' : 's'} will take approximately <strong>{variationCount * 2}-{variationCount * 3} minutes</strong>. Please be patient whilst we create your high-quality variations.
                  </p>
                </div>
              </div>
              
              <select
                value={variationCount}
                onChange={(e) => setVariationCount(parseInt(e.target.value))}
                className="w-full px-4 py-3 rounded-lg bg-white/10 text-white border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#FF3838] focus:border-transparent transition-all"
              >
                <option value={3}>3 variations (~6-9 minutes)</option>
                <option value={5}>5 variations (~10-15 minutes)</option>
                <option value={10}>10 variations (~20-30 minutes)</option>
              </select>
              <p className="text-xs text-gray-400 mt-3">
                Limited to 10 variations max due to Nano Banana Pro's generation time. Quality over quantity — each variation is production-ready.
              </p>
            </div>
          </div>

          {/* Aspect Ratio Selector */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-300 mb-3">Aspect Ratio</label>
            <div className="grid grid-cols-4 gap-2">
              {(['1:1', '4:5', '9:16', '16:9'] as AspectRatio[]).map((ratio) => (
                <button
                  key={ratio}
                  onClick={() => setAspectRatio(ratio)}
                  className={`px-4 py-3 rounded-xl text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0D0F12] ${
                    aspectRatio === ratio
                      ? "bg-[#FF3838] text-white shadow-lg shadow-red-500/20 focus:ring-[#FF3838]"
                      : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white focus:ring-white/20"
                  }`}
                >
                  {ratio}
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
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  document.getElementById('file-input')?.click();
                }
              }}
              tabIndex={0}
              role="button"
              aria-label="Upload winning ad image"
              className={`relative border-2 border-dashed rounded-2xl transition-all focus:outline-none focus:ring-2 focus:ring-[#FF3838] focus:ring-offset-2 focus:ring-offset-[#0D0F12] ${
                uploadedImageUrl
                  ? "border-green-500/30 bg-green-500/5"
                  : "border-white/10 hover:border-white/20 bg-white/[0.02] cursor-pointer"
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
                      <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 text-gray-300 text-sm cursor-pointer hover:bg-white/10 transition-colors w-fit focus-within:ring-2 focus-within:ring-white/30">
                        <Upload className="w-4 h-4" />
                        Replace Image
                        <input
                          id="file-input-replace"
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
                    id="file-input"
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
                { step: "3", title: "Brief", desc: "New copy angles" },
                { step: "4", title: "Generate", desc: "Variation images" },
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
            className={`w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-3 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0D0F12] ${
              uploadedImageUrl && !triggerIteration.isPending
                ? "bg-gradient-to-r from-[#A78BFA] to-pink-600 text-white hover:from-[#9F7AEA] hover:to-pink-500 shadow-lg shadow-purple-500/20 focus:ring-[#A78BFA]"
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
                Generate {variationCount} Variation{variationCount === 1 ? '' : 's'}
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>

        {/* Recent Iterations */}
        <RecentIterations />
      </div>

      {/* Confirmation Dialog */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0D0F12] border border-white/10 rounded-2xl p-8 max-w-md w-full">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-xl bg-[#FF3838]/10 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-6 h-6 text-[#FF3838]" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Confirm Generation</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  You're about to generate <span className="text-white font-semibold">{variationCount} variation{variationCount === 1 ? '' : 's'}</span> at <span className="text-white font-semibold">${estimatedCost.toFixed(2)}</span>. This will start the pipeline immediately.
                </p>
              </div>
            </div>
            <div className="bg-white/5 rounded-xl p-4 mb-6 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Product:</span>
                <span className="text-white font-medium">{product}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Variation Strategy:</span>
                <span className="text-white font-medium capitalize">{variationType.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Creativity Level:</span>
                <span className="text-white font-medium">{creativityLevel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Aspect Ratio:</span>
                <span className="text-white font-medium">{aspectRatio}</span>
              </div>
              <div className="border-t border-white/10 pt-2 mt-2 flex justify-between">
                <span className="text-gray-300 font-medium">Total Cost:</span>
                <span className="text-[#FF3838] font-bold text-lg">${estimatedCost.toFixed(2)}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmation(false)}
                className="flex-1 px-4 py-3 rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 transition-all font-medium focus:outline-none focus:ring-2 focus:ring-white/20"
              >
                Cancel
              </button>
              <button
                onClick={confirmAndStart}
                disabled={triggerIteration.isPending}
                className="flex-1 px-4 py-3 rounded-lg bg-[#FF3838] text-white hover:bg-[#FF3838]/90 transition-all font-bold focus:outline-none focus:ring-2 focus:ring-[#FF3838] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {triggerIteration.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Confirm & Generate
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Recent Iterations Component
function RecentIterations() {
  const { data: runs, isLoading } = trpc.pipeline.list.useQuery();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="mt-8 bg-[#0D0F12] border border-white/5 rounded-2xl p-8">
        <h2 className="text-lg font-bold text-white mb-4">Recent Iterations</h2>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-gray-500 animate-spin" />
        </div>
      </div>
    );
  }

  if (!runs || runs.length === 0) {
    return null;
  }

  return (
    <div className="mt-8 bg-[#0D0F12] border border-white/5 rounded-2xl p-8">
      <h2 className="text-lg font-bold text-white mb-4">Recent Iterations</h2>
      <div className="space-y-2">
        {runs.slice(0, 10).map((run: any) => (
          <button
            key={run.id}
            onClick={() => setLocation(`/results/${run.id}`)}
            className="w-full flex items-center gap-4 p-4 rounded-xl bg-white/[0.02] hover:bg-white/5 border border-white/5 transition-all text-left focus:outline-none focus:ring-2 focus:ring-[#FF3838] focus:ring-offset-2 focus:ring-offset-[#0D0F12]"
          >
            <div className="w-16 h-16 rounded-lg overflow-hidden bg-black/50 shrink-0">
              {run.sourceImageUrl ? (
                <img src={run.sourceImageUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Upload className="w-6 h-6 text-gray-600" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium text-sm truncate mb-1">
                {run.iterationBrief?.originalHeadline || run.sourceImageName || `Run #${run.id}`}
              </p>
              <p className="text-gray-500 text-xs">
                {run.product} · {new Date(run.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div>
              {run.status === 'completed' && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-500/10 text-green-400 text-xs font-medium">
                  <CheckCircle className="w-3 h-3" />
                  Completed
                </span>
              )}
              {run.status === 'running' && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-medium">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Processing
                </span>
              )}
              {run.status === 'failed' && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-500/10 text-red-400 text-xs font-medium">
                  <XCircle className="w-3 h-3" />
                  Failed
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
