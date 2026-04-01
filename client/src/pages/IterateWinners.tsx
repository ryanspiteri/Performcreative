import { useState, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Upload, ArrowRight, Loader2, CheckCircle, XCircle, RefreshCw, Sparkles, Eye, Copy, Download, ExternalLink, AlertCircle, Users, Target, Info } from "lucide-react";
import { toast } from "sonner";
import { ACTIVE_PRODUCTS } from "../../../drizzle/schema";

const AUDIENCE_PRESETS = ["Gym-goers", "Busy professionals", "Athletes", "Health-conscious parents", "Biohackers", "Weight loss seekers"];
const ANGLE_OPTIONS = ["front", "side", "45-degree", "top-down", "back"];

type CreativityLevel = "SAFE" | "BOLD" | "WILD";
type VariationType = "headline_only" | "background_only" | "layout_only" | "benefit_callouts_only" | "props_only" | "talent_swap" | "full_remix";
type AspectRatio = "1:1" | "4:5" | "9:16" | "16:9";
type ImageModel = "nano_banana_pro" | "nano_banana_2";
type SourceType = "own_ad" | "competitor_ad";
type AdaptationMode = "concept" | "style";

type CompetitorCreative = {
  id: string;
  title: string;
  brandName: string;
  imageUrl?: string;
  thumbnailUrl?: string;
};

export default function IterateWinners() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<"upload" | "running" | "results">("upload");
  const [product, setProduct] = useState<string>(ACTIVE_PRODUCTS[0]);
  const [sourceType, setSourceType] = useState<SourceType>("own_ad");
  const [adaptationMode, setAdaptationMode] = useState<AdaptationMode>("concept");
  const [selectedCompetitor, setSelectedCompetitor] = useState<CompetitorCreative | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [uploadedImageName, setUploadedImageName] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [runId, setRunId] = useState<number | null>(null);
  const [creativityLevel, setCreativityLevel] = useState<CreativityLevel>("BOLD");
  const [variationType, setVariationType] = useState<VariationType>("full_remix"); // Legacy single selection
  const [variationCount, setVariationCount] = useState(5);
  const [perVariationStrategies, setPerVariationStrategies] = useState<VariationType[]>(Array(5).fill('full_remix'));
  const [usePerVariationMode, setUsePerVariationMode] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  const [imageModel, setImageModel] = useState<ImageModel>("nano_banana_pro");
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [selectedFlavour, setSelectedFlavour] = useState<string | null>(null);
  const [selectedRenderId, setSelectedRenderId] = useState<number | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);
  const [selectedAudience, setSelectedAudience] = useState<string>("");
  const [customAudience, setCustomAudience] = useState(false);

  const triggerIteration = trpc.pipeline.triggerIteration.useMutation();
  const uploadRender = trpc.renders.upload.useMutation();
  const staticsQuery = trpc.pipeline.fetchForeplayStatics.useQuery(undefined, { enabled: sourceType === "competitor_ad" });
  const productInfoQuery = trpc.productInfo.get.useQuery({ product }, { enabled: !!product });
  const rendersForFlavour = trpc.renders.listByFlavour.useQuery(
    { product, flavour: selectedFlavour || "" },
    { enabled: !!product && !!selectedFlavour }
  );
  const peopleQuery = trpc.people.list.useQuery();
  const flavourOptions = (productInfoQuery.data?.flavourVariants || "").split(",").map((s: string) => s.trim()).filter(Boolean);
  const competitorStatics: CompetitorCreative[] = (staticsQuery.data || []).map((c) => ({
    id: c.id,
    title: c.title ?? "Untitled",
    brandName: c.brandName ?? "Unknown",
    imageUrl: c.imageUrl ?? undefined,
    thumbnailUrl: c.thumbnailUrl ?? undefined,
  }));

  // Sync per-variation strategies array when variation count changes
  useEffect(() => {
    setPerVariationStrategies(prev => {
      const newArray = Array(variationCount).fill('full_remix');
      // Preserve existing selections up to the new count
      for (let i = 0; i < Math.min(prev.length, variationCount); i++) {
        newArray[i] = prev[i];
      }
      return newArray;
    });
  }, [variationCount]);

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

  // Calculate cost — Two-pass compositing: 2x Gemini calls per variation (background + original)
  // Nano Banana Pro: $0.12/image (1:1/4:5), $0.24 (9:16/16:9)
  // Nano Banana 2:   $0.04/image (1:1/4:5), $0.08 (9:16/16:9) — ~3x cheaper
  const perImageCostPro = aspectRatio === '1:1' || aspectRatio === '4:5' ? 0.12 : 0.24;
  const perImageCostNB2 = aspectRatio === '1:1' || aspectRatio === '4:5' ? 0.04 : 0.08;
  const perImageCost = imageModel === 'nano_banana_2' ? perImageCostNB2 : perImageCostPro;
  const estimatedCost = variationCount * perImageCost; // Single-pass generation (useCompositing: false)

  const sourceImageUrl = sourceType === "competitor_ad" ? (selectedCompetitor?.imageUrl || null) : uploadedImageUrl;
  const hasSource = !!sourceImageUrl;

  // Start the iteration pipeline
  const handleStartPipeline = async () => {
    if (!hasSource) {
      toast.error(sourceType === "competitor_ad" ? "Please select a competitor ad" : "Please upload a winning ad first");
      return;
    }
    if (sourceType === "competitor_ad" && !selectedCompetitor) {
      toast.error("Please select a competitor ad from the gallery");
      return;
    }
    setShowConfirmation(true);
  };

  const confirmAndStart = async () => {
    setShowConfirmation(false);
    if (!sourceImageUrl) return;
    try {
      const result = await triggerIteration.mutateAsync({
        product,
        priority: "Medium",
        sourceImageUrl,
        sourceImageName: sourceType === "own_ad" ? uploadedImageName : selectedCompetitor?.title ?? "Competitor Ad",
        sourceType,
        ...(sourceType === "competitor_ad" && {
          adaptationMode,
          foreplayAdId: selectedCompetitor?.id,
          foreplayAdTitle: selectedCompetitor?.title,
          foreplayAdBrand: selectedCompetitor?.brandName,
        }),
        creativityLevel,
        variationTypes: usePerVariationMode ? perVariationStrategies : [variationType],
        variationCount,
        aspectRatio,
        imageModel,
        selectedRenderId: selectedRenderId || undefined,
        selectedFlavour: selectedFlavour || undefined,
        selectedPersonId: selectedPersonId || undefined,
        selectedAudience: selectedAudience || undefined,
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
              <h1 className="text-2xl font-bold text-white">Static Iteration</h1>
              <p className="text-gray-400 text-sm">Upload a winning static ad and generate new variations with different copy angles</p>
            </div>
          </div>
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
                    {variationCount} variation{variationCount === 1 ? '' : 's'} × ${perImageCost.toFixed(2)} per image ({imageModel === 'nano_banana_2' ? 'Nano Banana 2' : 'Nano Banana Pro'})
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-400 mb-2">Estimated Time</div>
                  <div className={`px-3 py-2 rounded-lg text-sm font-semibold ${
                    imageModel === 'nano_banana_2'
                      ? 'bg-green-500/10 border border-green-500/30 text-green-300'
                      : 'bg-amber-500/10 border border-amber-500/30 text-amber-300'
                  }`}>
                    {imageModel === 'nano_banana_2'
                      ? `${Math.ceil(variationCount * 0.5)}–${variationCount} min`
                      : `${variationCount * 2}–${variationCount * 3} min`
                    }
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
              {ACTIVE_PRODUCTS.map((p) => (
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

          {/* Flavour / Render Picker */}
          {flavourOptions.length > 0 && (
            <div className="mb-8">
              <label className="block text-sm font-medium text-gray-300 mb-3">Product Flavour</label>
              <div className="flex flex-wrap gap-2 mb-3">
                <button
                  onClick={() => { setSelectedFlavour(null); setSelectedRenderId(null); }}
                  className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                    !selectedFlavour ? "bg-[#FF3838] text-white" : "bg-white/5 text-gray-400 hover:bg-white/10"
                  }`}
                >
                  Auto (Default)
                </button>
                {flavourOptions.map((f: string) => (
                  <button
                    key={f}
                    onClick={() => { setSelectedFlavour(f); setSelectedRenderId(null); }}
                    className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                      selectedFlavour === f ? "bg-[#FF3838] text-white" : "bg-white/5 text-gray-400 hover:bg-white/10"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              {/* Render thumbnails for selected flavour */}
              {selectedFlavour && (
                <div>
                  {rendersForFlavour.isLoading ? (
                    <div className="flex items-center gap-2 text-gray-500 text-xs py-2">
                      <Loader2 className="w-3 h-3 animate-spin" /> Loading renders...
                    </div>
                  ) : rendersForFlavour.data && rendersForFlavour.data.length > 0 ? (
                    <div className="flex gap-2 flex-wrap">
                      {rendersForFlavour.data.map((r: any) => (
                        <button
                          key={r.id}
                          onClick={() => setSelectedRenderId(r.id)}
                          className={`w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                            selectedRenderId === r.id ? "border-[#FF3838] shadow-lg shadow-red-500/20" : "border-white/10 hover:border-white/20"
                          }`}
                        >
                          <img src={r.url} alt={r.angle || r.flavour || "render"} className="w-full h-full object-cover" />
                          {r.angle && (
                            <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-[9px] text-center text-gray-300 py-0.5">{r.angle}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-xs">
                      No renders tagged for "{selectedFlavour}". <a href="/product-info" className="text-[#FF3838] hover:underline">Upload renders in Product Info</a>
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Source: Our ad vs Competitor ad */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-300 mb-3">Source</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setSourceType("own_ad"); setSelectedCompetitor(null); }}
                className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  sourceType === "own_ad"
                    ? "bg-[#FF3838] text-white"
                    : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                }`}
              >
                Our winning ad
              </button>
              <button
                type="button"
                onClick={() => { setSourceType("competitor_ad"); setUploadedImageUrl(null); setUploadedImageName(""); }}
                className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  sourceType === "competitor_ad"
                    ? "bg-[#FF3838] text-white"
                    : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                }`}
              >
                Competitor ad
              </button>
            </div>
          </div>

          {sourceType === "competitor_ad" && (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">Adapt for ONEST</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAdaptationMode("concept")}
                    className={`px-4 py-2 rounded-lg text-sm ${adaptationMode === "concept" ? "bg-[#0347ED] text-white" : "bg-white/5 text-gray-400 hover:bg-white/10"}`}
                  >
                    Adapt concept
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdaptationMode("style")}
                    className={`px-4 py-2 rounded-lg text-sm ${adaptationMode === "style" ? "bg-[#0347ED] text-white" : "bg-white/5 text-gray-400 hover:bg-white/10"}`}
                  >
                    Match style
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {adaptationMode === "concept" ? "Use the competitor’s idea/angle with ONEST visuals and copy." : "Replicate layout and look; swap in ONEST product and copy only."}
                </p>
              </div>
              <div className="mb-8">
                <label className="block text-sm font-medium text-gray-300 mb-3">Pick a competitor ad (Foreplay static)</label>
                {staticsQuery.isLoading ? (
                  <div className="text-gray-400 py-8 text-center">Loading competitor ads…</div>
                ) : staticsQuery.isError ? (
                  <div className="text-red-400 py-8 text-center border border-red-500/20 rounded-xl">Failed to load competitor ads — try syncing from Foreplay on Browse Creatives.</div>
                ) : competitorStatics.length === 0 ? (
                  <div className="text-gray-400 py-8 text-center border border-white/10 rounded-xl">No static ads in library. Sync from Foreplay on Browse Creatives.</div>
                ) : (
                  <div className="grid grid-cols-4 gap-3 max-h-64 overflow-y-auto">
                    {competitorStatics.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => { setSelectedCompetitor(c); }}
                        className={`rounded-xl overflow-hidden border-2 text-left transition-all ${
                          selectedCompetitor?.id === c.id ? "border-[#FF3838] ring-2 ring-[#FF3838]/30" : "border-white/10 hover:border-white/20"
                        }`}
                      >
                        {c.thumbnailUrl || c.imageUrl ? (
                          <img src={c.thumbnailUrl || c.imageUrl} alt={c.title} className="w-full aspect-square object-cover" />
                        ) : (
                          <div className="w-full aspect-square bg-white/5 flex items-center justify-center text-gray-500 text-xs">No preview</div>
                        )}
                        <div className="p-2 bg-[#0D0F12]">
                          <div className="text-xs text-white truncate">{c.title}</div>
                          <div className="text-xs text-gray-500 truncate">{c.brandName}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

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

          {/* Variation Strategy Selector with Per-Variation Mode */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Variation Strategy
            </label>
            <div className="bg-white/5 rounded-xl p-6">
              {/* Mode Toggle */}
              <div className="flex gap-2 mb-6">
                <button
                  onClick={() => setUsePerVariationMode(false)}
                  className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    !usePerVariationMode
                      ? "bg-[#FF3838] text-white shadow-lg shadow-red-500/20"
                      : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  All Same Strategy
                </button>
                <button
                  onClick={() => setUsePerVariationMode(true)}
                  className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    usePerVariationMode
                      ? "bg-[#FF3838] text-white shadow-lg shadow-red-500/20"
                      : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  Custom Per Variation
                </button>
              </div>

              {!usePerVariationMode ? (
                <>
                  <p className="text-sm text-gray-300 mb-4">
                    All {variationCount} variations will use the same strategy.
                  </p>
                  <div className="space-y-2">
                    {([
                      { value: 'full_remix', label: 'Full Remix', desc: 'Test everything — headlines, backgrounds, layouts, benefits.' },
                      { value: 'headline_only', label: 'Headline Only', desc: 'Test different headlines only.' },
                      { value: 'background_only', label: 'Background Only', desc: 'Test different backgrounds only.' },
                      { value: 'layout_only', label: 'Layout Only', desc: 'Test product placement and positioning.' },
                      { value: 'benefit_callouts_only', label: 'Benefits Only', desc: 'Test different benefit copy.' },
                      { value: 'props_only', label: 'Props Only', desc: 'Test different visual metaphors.' },
                      { value: 'talent_swap', label: 'Talent Swap', desc: 'Test different people/models.' },
                    ] as const).map((type) => {
                      const isSelected = variationType === type.value;
                      return (
                        <button
                          key={type.value}
                          onClick={() => setVariationType(type.value)}
                          className={`w-full px-4 py-3 rounded-lg text-left transition-all flex items-start gap-3 ${
                            isSelected
                              ? "bg-[#FF3838]/10 border-2 border-[#FF3838] text-white"
                              : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border-2 border-transparent"
                          }`}
                        >
                          <div className="flex-1">
                            <div className="font-semibold text-sm mb-1">{type.label}</div>
                            <div className="text-xs opacity-75">{type.desc}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-300 mb-4">
                    Choose a strategy for each variation individually. Test multiple hypotheses in one run.
                  </p>
                  
                  {/* Quick Presets */}
                  <div className="flex gap-2 mb-4">
                    <button
                      onClick={() => setPerVariationStrategies(Array(variationCount).fill('full_remix'))}
                      className="px-3 py-2 rounded-lg text-xs font-medium bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition-all"
                    >
                      All Full Remix
                    </button>
                    <button
                      onClick={() => setPerVariationStrategies(Array(variationCount).fill('headline_only'))}
                      className="px-3 py-2 rounded-lg text-xs font-medium bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition-all"
                    >
                      All Headlines
                    </button>
                    <button
                      onClick={() => setPerVariationStrategies(Array(variationCount).fill('background_only'))}
                      className="px-3 py-2 rounded-lg text-xs font-medium bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition-all"
                    >
                      All Backgrounds
                    </button>
                  </div>

                  {/* Individual Variation Selectors */}
                  <div className="space-y-3">
                    {Array.from({ length: variationCount }).map((_, index) => (
                      <div key={index} className="bg-white/5 rounded-lg p-4">
                        <label className="block text-xs font-medium text-gray-400 mb-2">
                          Variation {index + 1} Strategy
                        </label>
                        <select
                          value={perVariationStrategies[index]}
                          onChange={(e) => {
                            const newStrategies = [...perVariationStrategies];
                            newStrategies[index] = e.target.value as VariationType;
                            setPerVariationStrategies(newStrategies);
                          }}
                          className="w-full px-3 py-2 rounded-lg bg-white/10 text-white text-sm border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#FF3838] focus:border-transparent"
                        >
                          <option value="full_remix">Full Remix</option>
                          <option value="headline_only">Headline Only</option>
                          <option value="background_only">Background Only</option>
                          <option value="layout_only">Layout Only</option>
                          <option value="benefit_callouts_only">Benefits Only</option>
                          <option value="props_only">Props Only</option>
                          <option value="talent_swap">Talent Swap</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Variation Count Dropdown */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Number of Variations
            </label>
            <div className="bg-white/5 rounded-xl p-6">
              {/* Warning Banner for Nano Banana Pro */}
              {imageModel === 'nano_banana_pro' && (
                <div className="mb-4 bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-amber-300 mb-1">🍌 Nano Banana Pro — Premium Quality = Longer Wait</p>
                    <p className="text-xs text-amber-200/90 leading-relaxed">
                      Nano Banana Pro generates production-quality images with perfect text rendering, but takes <strong>2–3 minutes per image</strong>. Generating {variationCount} variation{variationCount === 1 ? '' : 's'} will take approximately <strong>{variationCount * 2}–{variationCount * 3} minutes</strong>.
                    </p>
                  </div>
                </div>
              )}
              {imageModel === 'nano_banana_2' && (
                <div className="mb-4 bg-green-500/10 border border-green-500/30 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-green-300 mb-1">⚡ Nano Banana 2 — Fast Generation</p>
                    <p className="text-xs text-green-200/90 leading-relaxed">
                      Nano Banana 2 is 4× faster and ~3× cheaper. Generating {variationCount} variation{variationCount === 1 ? '' : 's'} will take approximately <strong>{Math.ceil(variationCount * 0.5)}–{variationCount} minutes</strong>. Ranked #1 in Image Arena.
                    </p>
                  </div>
                </div>
              )}
              
              <select
                value={variationCount}
                onChange={(e) => setVariationCount(parseInt(e.target.value))}
                className="w-full px-4 py-3 rounded-lg bg-white/10 text-white border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#FF3838] focus:border-transparent transition-all"
              >
                {imageModel === 'nano_banana_2' ? (
                  <>
                    <option value={3}>3 variations (~2–3 minutes)</option>
                    <option value={5}>5 variations (~3–5 minutes)</option>
                    <option value={10}>10 variations (~5–10 minutes)</option>
                  </>
                ) : (
                  <>
                    <option value={3}>3 variations (~6–9 minutes)</option>
                    <option value={5}>5 variations (~10–15 minutes)</option>
                    <option value={10}>10 variations (~20–30 minutes)</option>
                  </>
                )}
              </select>
              <p className="text-xs text-gray-400 mt-3">
                {imageModel === 'nano_banana_2'
                  ? 'Nano Banana 2 is 4× faster — run more variations in less time.'
                  : 'Limited to 10 variations max due to Nano Banana Pro’s generation time. Quality over quantity — each variation is production-ready.'}
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


          {/* Image Model Selector */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-300 mb-3">Image Generation Model</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setImageModel('nano_banana_pro')}
                className={`relative p-4 rounded-xl text-left transition-all border-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0D0F12] ${
                  imageModel === 'nano_banana_pro'
                    ? 'bg-purple-500/10 border-purple-500 focus:ring-purple-500'
                    : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/8 focus:ring-white/20'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">🍌</span>
                  <span className="font-semibold text-sm text-white">Nano Banana Pro</span>
                  {imageModel === 'nano_banana_pro' && (
                    <span className="ml-auto text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full">Selected</span>
                  )}
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">Highest quality. Advanced reasoning, perfect text rendering. ~$0.12/image, 2–3 min per variation.</p>
                <div className="mt-2 flex gap-2">
                  <span className="text-xs bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded">Best quality</span>
                  <span className="text-xs bg-white/5 text-gray-400 px-2 py-0.5 rounded">Slower</span>
                </div>
              </button>

              <button
                onClick={() => setImageModel('nano_banana_2')}
                className={`relative p-4 rounded-xl text-left transition-all border-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0D0F12] ${
                  imageModel === 'nano_banana_2'
                    ? 'bg-green-500/10 border-green-500 focus:ring-green-500'
                    : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/8 focus:ring-white/20'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">⚡</span>
                  <span className="font-semibold text-sm text-white">Nano Banana 2</span>
                  {imageModel === 'nano_banana_2' && (
                    <span className="ml-auto text-xs bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full">Selected</span>
                  )}
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">4× faster, ~3× cheaper. Ranked #1 in Image Arena. ~$0.04/image, 30–60 sec per variation.</p>
                <div className="mt-2 flex gap-2">
                  <span className="text-xs bg-green-500/10 text-green-400 px-2 py-0.5 rounded">#1 Image Arena</span>
                  <span className="text-xs bg-white/5 text-gray-400 px-2 py-0.5 rounded">4× faster</span>
                </div>
              </button>
            </div>
          </div>

          {sourceType === "own_ad" && (
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
          )}

          {/* People Selector */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Include a Person (Optional)
            </label>
            {peopleQuery.data && peopleQuery.data.length > 0 ? (
              <div className="flex gap-3 overflow-x-auto pb-2">
                <button
                  onClick={() => setSelectedPersonId(null)}
                  className={`flex-shrink-0 w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all ${
                    !selectedPersonId ? "border-[#FF3838] bg-[#FF3838]/10" : "border-white/10 bg-white/5 hover:border-white/20"
                  }`}
                >
                  <span className="text-[10px] text-gray-400">None</span>
                </button>
                {peopleQuery.data.map((person: any) => (
                  <button
                    key={person.id}
                    onClick={() => setSelectedPersonId(selectedPersonId === person.id ? null : person.id)}
                    className={`flex-shrink-0 w-16 h-16 rounded-full overflow-hidden border-2 transition-all ${
                      selectedPersonId === person.id ? "border-[#FF3838] shadow-lg shadow-red-500/20" : "border-white/10 hover:border-white/20"
                    }`}
                    title={person.name}
                  >
                    <img src={person.url} alt={person.name} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-xs">
                No people uploaded yet. <a href="/people" className="text-[#FF3838] hover:underline">Add reference photos in People Library</a>
              </p>
            )}
          </div>

          {/* Audience Type */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
              <Target className="w-4 h-4" />
              Target Audience (Optional)
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              <button
                onClick={() => { setSelectedAudience(""); setCustomAudience(false); }}
                className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                  !selectedAudience && !customAudience ? "bg-[#FF3838] text-white" : "bg-white/5 text-gray-400 hover:bg-white/10"
                }`}
              >
                Auto
              </button>
              {AUDIENCE_PRESETS.map((a) => (
                <button
                  key={a}
                  onClick={() => { setSelectedAudience(a); setCustomAudience(false); }}
                  className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                    selectedAudience === a && !customAudience ? "bg-[#FF3838] text-white" : "bg-white/5 text-gray-400 hover:bg-white/10"
                  }`}
                >
                  {a}
                </button>
              ))}
              <button
                onClick={() => { setCustomAudience(true); setSelectedAudience(""); }}
                className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                  customAudience ? "bg-[#FF3838] text-white" : "bg-white/5 text-gray-400 hover:bg-white/10"
                }`}
              >
                Custom
              </button>
            </div>
            {customAudience && (
              <input
                type="text"
                value={selectedAudience}
                onChange={(e) => setSelectedAudience(e.target.value)}
                placeholder="Describe your target audience..."
                className="w-full bg-[#01040A] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600"
              />
            )}
          </div>

          {/* Start Button */}
          <button
            onClick={handleStartPipeline}
            disabled={!hasSource || triggerIteration.isPending}
            className={`w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-3 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0D0F12] ${
              hasSource && !triggerIteration.isPending
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
  const { data: runs, isLoading } = trpc.pipeline.list.useQuery({ pipelineType: "iteration" });
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
              {run.iterationSourceUrl ? (
                <img src={run.iterationSourceUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Upload className="w-6 h-6 text-gray-600" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium text-sm truncate mb-1">
                {run.iterationBrief?.originalHeadline || run.product || `Run #${run.id}`}
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
