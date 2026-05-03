import { useState, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Upload, ArrowRight, Loader2, CheckCircle, XCircle, RefreshCw, Sparkles, Eye, Copy, Download, ExternalLink, AlertCircle, Users, Target, Info, X, Zap, FlaskConical, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { ACTIVE_PRODUCTS } from "../../../drizzle/schema";

const AUDIENCE_PRESETS = ["Gym-goers", "Busy professionals", "Athletes", "Health-conscious parents", "Biohackers", "Weight loss seekers"];
const ANGLE_OPTIONS = ["front", "side", "45-degree", "top-down", "back"];

type VariationType = "headline_only" | "background_only" | "layout_only" | "benefit_callouts_only" | "props_only" | "talent_swap" | "full_remix";
type AspectRatio = "1:1" | "4:5" | "9:16" | "16:9";
type ImageModel = "nano_banana_pro" | "nano_banana_2" | "openai_gpt_image";
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
  // styleMode + adAngle pickers were removed when pain-points became the
  // primary steering axis. styleMode is hard-coded to EVOLVE_REFERENCE in
  // the submit payload; adAngle defaults server-side to "auto".
  const [variationType, setVariationType] = useState<VariationType>("full_remix"); // Legacy single selection
  const [variationCount, setVariationCount] = useState(5);
  const [perVariationStrategies, setPerVariationStrategies] = useState<VariationType[]>(Array(5).fill('full_remix'));
  const [usePerVariationMode, setUsePerVariationMode] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  const [imageModel, setImageModel] = useState<ImageModel>("nano_banana_pro");
  const [resolution, setResolution] = useState<"2K" | "4K">("2K");
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [selectedFlavour, setSelectedFlavour] = useState<string | null>(null);
  const [selectedRenderId, setSelectedRenderId] = useState<number | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);
  // Per-variation person overrides when Custom Per Variation mode is active.
  // Length tracks variationCount; null = "use global" / "no one".
  const [perVariationPersonIds, setPerVariationPersonIds] = useState<(number | null)[]>(Array(5).fill(null));
  const [selectedAudience, setSelectedAudience] = useState<string>("");
  const [customAudience, setCustomAudience] = useState(false);

  // Winner handoff: set when navigated here from CreativePerformance's
  // "Iterate image" button with URL params (?sourceCreativeAssetId=N&...).
  // Drives the top banner + provenance fields on the iteration mutation.
  // Auto-cleared if the user modifies the source (competitor mode, new upload,
  // etc.) so we never submit `ai-winner` provenance with a stale asset ID.
  const [winnerSource, setWinnerSource] = useState<{ name: string; creativeAssetId: number } | null>(null);

  const triggerIteration = trpc.pipeline.triggerIteration.useMutation();
  const uploadRender = trpc.renders.upload.useMutation();
  const staticsQuery = trpc.pipeline.fetchForeplayStatics.useQuery(undefined, { enabled: sourceType === "competitor_ad" });
  const productInfoQuery = trpc.productInfo.get.useQuery({ product }, { enabled: !!product });
  // Fetch the winner's current thumbnail server-side. Intentionally NOT passing
  // sourceImageUrl via URL params — Meta CDN URLs have signed-token expiry and
  // break on bookmark/refresh. Fetching by ID always returns a fresh URL.
  const winnerAssetQuery = trpc.analytics.getCreativeDetail.useQuery(
    { creativeAssetId: winnerSource?.creativeAssetId ?? 0 },
    { enabled: !!winnerSource?.creativeAssetId },
  );
  // getCreativeDetail returns `null` (not `{ asset: null }`) when the asset
  // no longer exists. Detect via isFetched + data === null, then show the
  // banner with an inline "preview unavailable" fallback.
  const isDeletedWinner = winnerAssetQuery.isFetched && winnerAssetQuery.data === null;
  const fetchedWinnerAsset = winnerAssetQuery.data?.asset ?? null;
  const rendersForFlavour = trpc.renders.listByFlavour.useQuery(
    { product, flavour: selectedFlavour || "" },
    { enabled: !!product && !!selectedFlavour }
  );
  const peopleQuery = trpc.people.list.useQuery();
  const rawFlavours = productInfoQuery.data?.flavourVariants || "";
  const flavourOptions = rawFlavours.includes(",")
    ? rawFlavours.split(",").map((s: string) => s.trim()).filter(Boolean)
    : rawFlavours.includes("\n")
      ? rawFlavours.split("\n").map((s: string) => s.trim()).filter(Boolean)
      : rawFlavours.includes("|")
        ? rawFlavours.split("|").map((s: string) => s.trim()).filter(Boolean)
        : rawFlavours.trim() ? [rawFlavours.trim()] : [];
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
    setPerVariationPersonIds(prev => {
      const newArray: (number | null)[] = Array(variationCount).fill(null);
      for (let i = 0; i < Math.min(prev.length, variationCount); i++) {
        newArray[i] = prev[i];
      }
      return newArray;
    });
  }, [variationCount]);

  // Hydrate from URL params when navigated here via "Iterate image" on
  // CreativePerformance. Product is only applied if valid (guards against
  // ?product=FakeName). sourceCreativeAssetId is validated (positive int)
  // before setting winnerSource. sourceImageUrl is NOT accepted via URL —
  // fetched fresh from getCreativeDetail to survive CDN token expiry.
  //
  // Depends on window.location.search so SPA navigation from /iterate to
  // /iterate?sourceCreativeAssetId=X re-hydrates. Wouter keeps the
  // component mounted for same-route query-string changes.
  const locationSearch = typeof window !== "undefined" ? window.location.search : "";
  useEffect(() => {
    if (runId) return; // Don't override an in-progress run
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(locationSearch);
    const p = params.get("product");
    const assetIdParam = params.get("sourceCreativeAssetId");
    const name = params.get("winnerName");

    if (p && (ACTIVE_PRODUCTS as readonly string[]).includes(p)) {
      setProduct(p);
    }
    if (assetIdParam) {
      const parsed = parseInt(assetIdParam, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        setWinnerSource({ name: name || "Unknown winner", creativeAssetId: parsed });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationSearch]);

  // Populate the source image from the fetched winner asset once it lands.
  // Only sets uploadedImageUrl if the user hasn't already uploaded something
  // themselves — respects a manual override.
  useEffect(() => {
    if (fetchedWinnerAsset?.thumbnailUrl && !uploadedImageUrl) {
      setUploadedImageUrl(fetchedWinnerAsset.thumbnailUrl);
      setUploadedImageName(winnerSource?.name || "Winner");
    }
  }, [fetchedWinnerAsset, uploadedImageUrl, winnerSource?.name]);

  // Auto-clear winner context when the user modifies the source. Prevents
  // provenance leaks like: hydrate from winner → switch to competitor_ad →
  // submit with creativeSource='ai-winner' + sourceCreativeAssetId={original}
  // even though the uploaded image is a different creative entirely.
  //
  // Also scrubs URL params via history.replaceState so bookmarks/refresh
  // don't re-hydrate the stale winner context. Matches the pattern in
  // ScriptGenerator.tsx:462.
  const clearWinnerContext = useCallback(() => {
    setWinnerSource(null);
    setUploadedImageUrl(null);
    setUploadedImageName("");
    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", "/iterate");
    }
  }, []);

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
      // User uploaded their own image → downgrade provenance to manual.
      // The URL param handoff is no longer a source of truth.
      if (winnerSource) {
        setWinnerSource(null);
        if (typeof window !== "undefined") {
          window.history.replaceState({}, "", "/iterate");
        }
      }
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
  const perImageCostOpenAI = 0.15; // gpt-image-1 estimate, refine after bakeoff
  const perImageCost =
    imageModel === 'nano_banana_2' ? perImageCostNB2
    : imageModel === 'openai_gpt_image' ? perImageCostOpenAI
    : perImageCostPro;
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
        // Hard-coded EVOLVE_REFERENCE — the previous picker was demoted as
        // part of the pain-point flow. Brief generator's pain-point branch
        // doesn't read styleMode anyway; the legacy adAngle fallback does.
        styleMode: "EVOLVE_REFERENCE",
        variationTypes: usePerVariationMode ? perVariationStrategies : [variationType],
        variationCount,
        ...(usePerVariationMode && { selectedPersonIds: perVariationPersonIds }),
        aspectRatio,
        imageModel,
        resolution,
        selectedRenderId: selectedRenderId || undefined,
        selectedFlavour: selectedFlavour || undefined,
        selectedPersonId: selectedPersonId || undefined,
        selectedAudience: selectedAudience || undefined,
        // Winner provenance. winnerSource is auto-cleared on any source
        // modification (competitor switch, new upload, etc.), and we also
        // gate on sourceType === "own_ad" here as belt-and-braces —
        // competitor-mode iterations can never carry ai-winner provenance,
        // even if a race left winnerSource set.
        ...(winnerSource && sourceType === "own_ad" && {
          sourceCreativeAssetId: winnerSource.creativeAssetId,
          creativeSource: "ai-winner" as const,
        }),
      });
      setRunId(result.runId);
      setLocation(`/results/${result.runId}`);
    } catch (err: any) {
      toast.error(`Failed to start pipeline: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0B0D] p-6">
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-[#FF3838] flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Static Iteration</h1>
              <p className="text-gray-400 text-sm">Upload a winning static ad and generate new variations with different copy angles</p>
            </div>
          </div>
        </div>
      </div>

      {/* Winner handoff banner — visible when the page was opened with
          ?sourceCreativeAssetId=N from the "Iterate image" button on
          CreativePerformance. Banner auto-disappears when the user modifies
          the source (upload a different file, switch to competitor mode,
          pick a competitor, or click the X). */}
      {winnerSource && (
        <section
          role="region"
          aria-label="Winner context"
          className="max-w-4xl mx-auto mb-4 bg-[#15171B] border border-[#FF3838]/30 rounded-lg p-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-2 text-sm text-white">
            {winnerAssetQuery.isLoading ? (
              <Loader2 className="w-4 h-4 text-[#FF3838] animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="w-4 h-4 text-[#FF3838]" aria-hidden="true" />
            )}
            <span>
              Iterating winner: <strong>{winnerSource.name}</strong>
              {isDeletedWinner && (
                <>
                  {" "}
                  <span className="text-[#F59E0B]">
                    · Preview unavailable — upload manually below
                  </span>
                </>
              )}
            </span>
          </div>
          <button
            type="button"
            onClick={clearWinnerContext}
            className="text-gray-400 hover:text-white transition-colors p-1 rounded"
            aria-label="Clear winner context"
          >
            <X className="w-4 h-4" />
          </button>
        </section>
      )}

      <div className="max-w-4xl mx-auto">
        {/* Step 1: Upload & Configure */}
        <div className="bg-[#15171B] border border-white/5 rounded-lg p-8">

          {/* ─── Section: Source ─── */}
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500 mb-4">Source</h2>

          {/* Product Selection */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-300 mb-3">Select Product</label>
            <div className="grid grid-cols-3 gap-2">
              {ACTIVE_PRODUCTS.map((p) => (
                <button
                  key={p}
                  onClick={() => setProduct(p)}
                  className={`px-4 py-3 rounded-sm text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#15171B] ${
                    product === p
                      ? "bg-[#FF3838] text-white focus:ring-[#FF3838]"
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
                  className={`px-4 py-2 rounded-sm text-xs font-medium transition-all ${
                    !selectedFlavour ? "bg-[#FF3838] text-white" : "bg-white/5 text-gray-400 hover:bg-white/10"
                  }`}
                >
                  Auto (Default)
                </button>
                {flavourOptions.map((f: string) => (
                  <button
                    key={f}
                    onClick={() => { setSelectedFlavour(f); setSelectedRenderId(null); }}
                    className={`px-4 py-2 rounded-sm text-xs font-medium transition-all ${
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
                          className={`w-20 h-20 rounded-md overflow-hidden border-2 transition-all ${
                            selectedRenderId === r.id ? "border-[#FF3838]" : "border-white/10 hover:border-white/20"
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
                className={`px-4 py-3 rounded-sm text-sm font-medium transition-all ${
                  sourceType === "own_ad"
                    ? "bg-[#FF3838] text-white"
                    : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                }`}
              >
                Our winning ad
              </button>
              <button
                type="button"
                onClick={() => {
                  setSourceType("competitor_ad");
                  setUploadedImageUrl(null);
                  setUploadedImageName("");
                  // Switching to competitor mode invalidates winner provenance
                  // (the winner was an own_ad). Clear + scrub URL.
                  if (winnerSource) clearWinnerContext();
                }}
                className={`px-4 py-3 rounded-sm text-sm font-medium transition-all ${
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
                    className={`px-4 py-2 rounded-sm text-sm ${adaptationMode === "concept" ? "bg-[#FF3838] text-white" : "bg-white/5 text-gray-400 hover:bg-white/10"}`}
                  >
                    Adapt concept
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdaptationMode("style")}
                    className={`px-4 py-2 rounded-sm text-sm ${adaptationMode === "style" ? "bg-[#FF3838] text-white" : "bg-white/5 text-gray-400 hover:bg-white/10"}`}
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
                  <div className="text-red-400 py-8 text-center border border-red-500/20 rounded-lg">Failed to load competitor ads — try syncing from Foreplay on Browse Creatives.</div>
                ) : competitorStatics.length === 0 ? (
                  <div className="text-gray-400 py-8 text-center border border-white/10 rounded-lg">No static ads in library. Sync from Foreplay on Browse Creatives.</div>
                ) : (
                  <div className="grid grid-cols-4 gap-3 max-h-64 overflow-y-auto">
                    {competitorStatics.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setSelectedCompetitor(c);
                          // Picking a competitor invalidates winner provenance.
                          if (winnerSource) clearWinnerContext();
                        }}
                        className={`rounded-md overflow-hidden border-2 text-left transition-all ${
                          selectedCompetitor?.id === c.id ? "border-[#FF3838] ring-2 ring-[#FF3838]/30" : "border-white/10 hover:border-white/20"
                        }`}
                      >
                        {c.thumbnailUrl || c.imageUrl ? (
                          <img src={c.thumbnailUrl || c.imageUrl} alt={c.title} className="w-full aspect-square object-cover" />
                        ) : (
                          <div className="w-full aspect-square bg-white/5 flex items-center justify-center text-gray-500 text-xs">No preview</div>
                        )}
                        <div className="p-2 bg-[#0A0B0D]">
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

          {/* Upload Your Winning Ad — moved here after source selection */}
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
              className={`relative border-2 border-dashed rounded-md transition-all focus:outline-none focus:ring-2 focus:ring-[#FF3838] focus:ring-offset-2 focus:ring-offset-[#15171B] ${
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
                    <div className="w-48 h-48 rounded-md overflow-hidden bg-black/50 shrink-0">
                      <img src={uploadedImageUrl} alt="Winning ad" className="w-full h-full object-contain" />
                    </div>
                    <div className="flex-1 flex flex-col justify-center">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        <span className="text-green-400 font-medium text-sm">Image uploaded</span>
                      </div>
                      <p className="text-white font-medium mb-1">{uploadedImageName}</p>
                      <p className="text-gray-500 text-xs mb-4">Click or drag to replace</p>
                      <label className="inline-flex items-center gap-2 px-4 py-2 rounded-sm bg-white/5 text-gray-300 text-sm cursor-pointer hover:bg-white/10 transition-colors w-fit">
                        <Upload className="w-4 h-4" />
                        Replace Image
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileUpload(file); }} />
                      </label>
                    </div>
                  </div>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center py-16 cursor-pointer">
                  <div className="w-16 h-16 rounded-md bg-white/5 flex items-center justify-center mb-4">
                    <Upload className="w-8 h-8 text-gray-500" />
                  </div>
                  <p className="text-white font-medium mb-1">Drop your winning ad here</p>
                  <p className="text-gray-500 text-sm mb-4">or click to browse (PNG, JPG, up to 10MB)</p>
                  <div className="flex items-center gap-2 px-4 py-2 rounded-sm bg-[#FF3838]/10 text-[#FF3838] text-sm font-medium">
                    <Upload className="w-4 h-4" />
                    Choose File
                  </div>
                  <input id="file-input" type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileUpload(file); }} />
                </label>
              )}
            </div>
          </div>
          )}

          {/* ─── Section: Variations ─── */}
          <div className="mt-10 pt-8 border-t border-white/5">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500 mb-4">Variations</h2>
          </div>

          {/* Number of Variations — moved above Strategy */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-300 mb-3">Number of Variations</label>
            <select
              value={variationCount}
              onChange={(e) => setVariationCount(parseInt(e.target.value))}
              className="w-full px-4 py-3 rounded-sm bg-white/10 text-white border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#FF3838] focus:border-transparent transition-all"
            >
              {imageModel === 'nano_banana_2' ? (
                <>
                  <option value={3}>3 variations (~2-3 minutes)</option>
                  <option value={5}>5 variations (~3-5 minutes)</option>
                  <option value={10}>10 variations (~5-10 minutes)</option>
                </>
              ) : (
                <>
                  <option value={3}>3 variations (~6-9 minutes)</option>
                  <option value={5}>5 variations (~10-15 minutes)</option>
                  <option value={10}>10 variations (~20-30 minutes)</option>
                </>
              )}
            </select>
          </div>

          {/* Variation Strategy Selector — collapsed under Advanced. Default
              full_remix covers the user's 95% case post-pain-point flow.
              Talent_swap / headline_only / etc. still available for the rare
              narrow-test scenarios. */}
          <details className="mb-8 group">
            <summary className="text-xs font-medium text-gray-500 hover:text-gray-300 cursor-pointer flex items-center gap-2 select-none">
              <span>Advanced — variation strategy</span>
              <span className="text-gray-600 group-open:hidden">(default: Full Remix)</span>
              <a
                href="https://github.com/ryanspiteri/Performcreative/blob/main/docs/variation-strategies.md"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-gray-500 hover:text-[#FF3838] transition-colors"
                title="What does each strategy / angle / style mode do?"
                aria-label="Open variation strategies reference doc on GitHub"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </a>
            </summary>
            <div className="mt-3 bg-white/5 rounded-lg p-6">
              <div className="flex gap-2 mb-6">
                <button onClick={() => setUsePerVariationMode(false)} className={`flex-1 px-4 py-3 rounded-sm text-sm font-medium transition-all ${!usePerVariationMode ? "bg-[#FF3838] text-white" : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"}`}>All Same Strategy</button>
                <button onClick={() => setUsePerVariationMode(true)} className={`flex-1 px-4 py-3 rounded-sm text-sm font-medium transition-all ${usePerVariationMode ? "bg-[#FF3838] text-white" : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"}`}>Custom Per Variation</button>
              </div>
              {!usePerVariationMode ? (
                <div className="space-y-2">
                  {([
                    { value: 'full_remix', label: 'Full Remix', desc: 'Test everything — headlines, backgrounds, layouts, benefits.' },
                    { value: 'headline_only', label: 'Headline Only', desc: 'Test different headlines only.' },
                    { value: 'background_only', label: 'Background Only', desc: 'Test different backgrounds only.' },
                    { value: 'layout_only', label: 'Layout Only', desc: 'Test product placement and positioning.' },
                    { value: 'benefit_callouts_only', label: 'Benefits Only', desc: 'Test different benefit copy.' },
                    { value: 'props_only', label: 'Props Only', desc: 'Test different visual metaphors.' },
                    { value: 'talent_swap', label: 'Talent Swap', desc: 'Test different people/models.' },
                  ] as const).map((type) => (
                    <button key={type.value} onClick={() => setVariationType(type.value)} className={`w-full px-4 py-3 rounded-sm text-left transition-all flex items-start gap-3 ${variationType === type.value ? "bg-[#FF3838]/10 border-2 border-[#FF3838] text-white" : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border-2 border-transparent"}`}>
                      <div className="flex-1">
                        <div className="font-semibold text-sm mb-1">{type.label}</div>
                        <div className="text-xs opacity-75">{type.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <>
                  <div className="flex gap-2 mb-4">
                    <button onClick={() => setPerVariationStrategies(Array(variationCount).fill('full_remix'))} className="px-3 py-2 rounded-sm text-xs font-medium bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition-all">All Full Remix</button>
                    <button onClick={() => setPerVariationStrategies(Array(variationCount).fill('headline_only'))} className="px-3 py-2 rounded-sm text-xs font-medium bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition-all">All Headlines</button>
                    <button onClick={() => setPerVariationStrategies(Array(variationCount).fill('background_only'))} className="px-3 py-2 rounded-sm text-xs font-medium bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition-all">All Backgrounds</button>
                  </div>
                  {peopleQuery.data && peopleQuery.data.length > 0 && (
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs text-gray-500">Each variation can use a different person — pick below.</span>
                      <button
                        onClick={() => setPerVariationPersonIds(Array(variationCount).fill(perVariationPersonIds[0] ?? null))}
                        className="px-2 py-1 rounded text-[11px] text-gray-400 hover:text-white hover:bg-white/5"
                      >
                        Apply first to all
                      </button>
                    </div>
                  )}
                  <div className="space-y-3">
                    {Array.from({ length: variationCount }).map((_, index) => (
                      <div key={index} className="bg-white/5 rounded-md p-4">
                        <label className="block text-xs font-medium text-gray-400 mb-2">Variation {index + 1} Strategy</label>
                        <select value={perVariationStrategies[index]} onChange={(e) => { const s = [...perVariationStrategies]; s[index] = e.target.value as VariationType; setPerVariationStrategies(s); }} className="w-full px-3 py-2 rounded-sm bg-white/10 text-white text-sm border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#FF3838]">
                          <option value="full_remix">Full Remix</option>
                          <option value="headline_only">Headline Only</option>
                          <option value="background_only">Background Only</option>
                          <option value="layout_only">Layout Only</option>
                          <option value="benefit_callouts_only">Benefits Only</option>
                          <option value="props_only">Props Only</option>
                          <option value="talent_swap">Talent Swap</option>
                        </select>
                        {peopleQuery.data && peopleQuery.data.length > 0 && (
                          <div className="mt-3">
                            <label className="block text-[11px] font-medium text-gray-500 mb-2">Person (optional)</label>
                            <div className="flex gap-2 overflow-x-auto pb-1" role="radiogroup" aria-label={`Person for variation ${index + 1}`}>
                              <button
                                onClick={() => {
                                  const next = [...perVariationPersonIds];
                                  next[index] = null;
                                  setPerVariationPersonIds(next);
                                }}
                                role="radio"
                                aria-checked={perVariationPersonIds[index] === null}
                                className={`flex-shrink-0 w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all ${
                                  perVariationPersonIds[index] === null ? "border-[#FF3838] bg-[#FF3838]/10" : "border-white/10 bg-white/5 hover:border-white/20"
                                }`}
                              >
                                <span className="text-[9px] text-gray-400">None</span>
                              </button>
                              {peopleQuery.data.map((person: any) => (
                                <button
                                  key={person.id}
                                  onClick={() => {
                                    const next = [...perVariationPersonIds];
                                    next[index] = person.id;
                                    setPerVariationPersonIds(next);
                                  }}
                                  role="radio"
                                  aria-checked={perVariationPersonIds[index] === person.id}
                                  className={`flex-shrink-0 w-10 h-10 rounded-full overflow-hidden border-2 transition-all ${
                                    perVariationPersonIds[index] === person.id ? "border-[#FF3838] shadow-lg shadow-red-500/20" : "border-white/10 hover:border-white/20"
                                  }`}
                                  title={person.name}
                                >
                                  <img src={person.url} alt={person.name} className="w-full h-full object-cover" />
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </details>

          {/* ─── Section: Creative direction ─── */}
          <div className="mt-10 pt-8 border-t border-white/5">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500 mb-4">Creative direction</h2>
            <p className="text-xs text-gray-500">Pain points are picked after analysis on the next screen — once we've reverse-engineered the winner, you'll choose which pain points each variation should attack.</p>
          </div>

          {/* Ad Angle and Style Fidelity removed — pain-point picker now lives
              on the Stage 1b approval gate, grounded in the reverse-engineered
              candidates from the actual winning ad. styleMode hard-coded to
              EVOLVE_REFERENCE in the submit payload. */}

          {/* People Selector — creative decision, lives with Ad Angle / Audience.
              Hidden entirely when per-variation mode is active: per-variation
              pickers inside the Strategy section own person selection there. */}
          {!usePerVariationMode && (
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
                      selectedPersonId === person.id ? "border-[#FF3838]" : "border-white/10 hover:border-white/20"
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
          )}

          {/* Audience Type */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
              <Target className="w-4 h-4" />
              Target Audience (Optional)
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              <button
                onClick={() => { setSelectedAudience(""); setCustomAudience(false); }}
                className={`px-4 py-2 rounded-sm text-xs font-medium transition-all ${
                  !selectedAudience && !customAudience ? "bg-[#FF3838] text-white" : "bg-white/5 text-gray-400 hover:bg-white/10"
                }`}
              >
                Auto
              </button>
              {AUDIENCE_PRESETS.map((a) => (
                <button
                  key={a}
                  onClick={() => { setSelectedAudience(a); setCustomAudience(false); }}
                  className={`px-4 py-2 rounded-sm text-xs font-medium transition-all ${
                    selectedAudience === a && !customAudience ? "bg-[#FF3838] text-white" : "bg-white/5 text-gray-400 hover:bg-white/10"
                  }`}
                >
                  {a}
                </button>
              ))}
              <button
                onClick={() => { setCustomAudience(true); setSelectedAudience(""); }}
                className={`px-4 py-2 rounded-sm text-xs font-medium transition-all ${
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
                className="w-full bg-[#0A0B0D] border border-white/10 rounded-sm px-3 py-2 text-sm text-white placeholder-gray-600"
              />
            )}
          </div>

          {/* ─── Section: Output ─── */}
          <div className="mt-10 pt-8 border-t border-white/5">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500 mb-4">Output</h2>
          </div>

          {/* Image Model Selector — picked first so the cost/speed context
              flows into Resolution and Aspect Ratio below. */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-300 mb-3">Image Generation Model</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                onClick={() => setImageModel('nano_banana_pro')}
                role="radio"
                aria-checked={imageModel === 'nano_banana_pro'}
                className={`relative p-4 rounded-md text-left transition-all border-2 focus:outline-none focus:ring-2 focus:ring-[#FF3838] ${
                  imageModel === 'nano_banana_pro'
                    ? 'bg-[#FF3838]/10 border-[#FF3838]'
                    : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/8'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-[#FF3838]" />
                  <span className="font-semibold text-sm text-white">Nano Banana Pro</span>
                  {imageModel === 'nano_banana_pro' && (
                    <CheckCircle className="w-4 h-4 text-[#FF3838] ml-auto" />
                  )}
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">Highest quality. Advanced reasoning, perfect text rendering. ~$0.12/image, 2–3 min per variation.</p>
                <div className="mt-2 flex gap-2 flex-wrap">
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-sm">Recommended</span>
                  <span className="text-[10px] bg-white/5 text-gray-400 px-2 py-0.5 rounded-sm">Best quality</span>
                </div>
              </button>

              <button
                onClick={() => setImageModel('nano_banana_2')}
                role="radio"
                aria-checked={imageModel === 'nano_banana_2'}
                className={`relative p-4 rounded-md text-left transition-all border-2 focus:outline-none focus:ring-2 focus:ring-[#FF3838] ${
                  imageModel === 'nano_banana_2'
                    ? 'bg-[#FF3838]/10 border-[#FF3838]'
                    : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/8'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-gray-300" />
                  <span className="font-semibold text-sm text-white">Nano Banana 2</span>
                  {imageModel === 'nano_banana_2' && (
                    <CheckCircle className="w-4 h-4 text-[#FF3838] ml-auto" />
                  )}
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">4× faster, ~3× cheaper. Ranked #1 in Image Arena. ~$0.04/image, 30–60 sec per variation.</p>
                <div className="mt-2 flex gap-2 flex-wrap">
                  <span className="text-[10px] bg-white/5 text-gray-400 px-2 py-0.5 rounded-sm">4× faster</span>
                </div>
              </button>

              <button
                onClick={() => setImageModel('openai_gpt_image')}
                role="radio"
                aria-checked={imageModel === 'openai_gpt_image'}
                className={`relative p-4 rounded-md text-left transition-all border-2 focus:outline-none focus:ring-2 focus:ring-[#FF3838] ${
                  imageModel === 'openai_gpt_image'
                    ? 'bg-[#FF3838]/10 border-[#FF3838]'
                    : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/8'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <FlaskConical className="w-4 h-4 text-gray-300" />
                  <span className="font-semibold text-sm text-white">OpenAI Image</span>
                  {imageModel === 'openai_gpt_image' && (
                    <CheckCircle className="w-4 h-4 text-[#FF3838] ml-auto" />
                  )}
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">gpt-image-1 edits with multiple reference images. ~$0.15/image, 30–90 sec per variation.</p>
                <div className="mt-2 flex gap-2 flex-wrap">
                  <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-sm">Experimental</span>
                  <span className="text-[10px] bg-white/5 text-gray-400 px-2 py-0.5 rounded-sm">A/B bakeoff</span>
                </div>
              </button>
            </div>
          </div>

          {/* Resolution */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-300 mb-3">Resolution</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setResolution("2K")}
                className={`px-4 py-3 rounded-sm text-sm font-medium transition-all ${
                  resolution === "2K"
                    ? "bg-[#FF3838] text-white"
                    : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                }`}
              >
                2K (Default)
              </button>
              <button
                onClick={() => setResolution("4K")}
                className={`px-4 py-3 rounded-sm text-sm font-medium transition-all ${
                  resolution === "4K"
                    ? "bg-[#FF3838] text-white"
                    : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                }`}
              >
                4K (Higher Detail)
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2 font-mono tabular-nums">
              {resolution === "2K"
                ? `${aspectRatio === '1:1' ? '2048x2048' : aspectRatio === '4:5' ? '2048x2560' : aspectRatio === '9:16' ? '2304x4096' : '4096x2304'} px`
                : `${aspectRatio === '1:1' ? '4096x4096' : aspectRatio === '4:5' ? '4096x5120' : aspectRatio === '9:16' ? '4608x8192' : '8192x4608'} px — larger file, longer generation`}
            </p>
          </div>

          {/* Aspect Ratio Selector — picked after Model so cost context is set */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-300 mb-3">Aspect Ratio</label>
            <div className="grid grid-cols-4 gap-2">
              {(['1:1', '4:5', '9:16', '16:9'] as AspectRatio[]).map((ratio) => (
                <button
                  key={ratio}
                  onClick={() => setAspectRatio(ratio)}
                  className={`px-4 py-3 rounded-sm text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#15171B] ${
                    aspectRatio === ratio
                      ? "bg-[#FF3838] text-white focus:ring-[#FF3838]"
                      : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white focus:ring-white/20"
                  }`}
                >
                  {ratio}
                </button>
              ))}
            </div>
          </div>

          {/* Cost Summary */}
          <div className="mb-8">
            <div className="bg-[#1E2126] border border-white/10 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-400 mb-1">Estimated Cost</div>
                  <div className="text-3xl font-bold text-[#FF3838] font-mono tabular-nums">${estimatedCost.toFixed(2)}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {variationCount} variation{variationCount === 1 ? '' : 's'} x ${perImageCost.toFixed(2)} per image ({imageModel === 'nano_banana_2' ? 'Nano Banana 2' : imageModel === 'openai_gpt_image' ? 'OpenAI Image' : 'Nano Banana Pro'})
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-400 mb-2">Estimated Time</div>
                  <div className="px-3 py-2 rounded-sm text-sm font-semibold bg-white/5 border border-white/10 text-gray-200 font-mono tabular-nums">
                    {imageModel === 'nano_banana_2' ? `${Math.ceil(variationCount * 0.5)}-${variationCount} min` : imageModel === 'openai_gpt_image' ? `${Math.ceil(variationCount * 0.5)}-${Math.ceil(variationCount * 1.5)} min` : `${variationCount * 2}-${variationCount * 3} min`}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleStartPipeline}
            disabled={!hasSource || triggerIteration.isPending}
            className={`w-full py-4 rounded-sm font-semibold text-base transition-all flex items-center justify-center gap-3 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#15171B] ${
              hasSource && !triggerIteration.isPending
                ? "bg-[#FF3838] text-white hover:bg-[#FF5555] focus:ring-[#FF3838]"
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
          <div className="bg-[#15171B] border border-white/10 rounded-xl p-8 max-w-md w-full">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-md bg-[#FF3838]/10 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-6 h-6 text-[#FF3838]" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Confirm Generation</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  You're about to generate <span className="text-white font-semibold">{variationCount} variation{variationCount === 1 ? '' : 's'}</span> at <span className="text-white font-semibold">${estimatedCost.toFixed(2)}</span>. This will start the pipeline immediately.
                </p>
              </div>
            </div>
            <div className="bg-white/5 rounded-md p-4 mb-6 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Product:</span>
                <span className="text-white font-medium">{product}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Variation Strategy:</span>
                <span className="text-white font-medium capitalize">{variationType.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Pain Points:</span>
                <span className="text-white font-medium text-right">Picked after analysis</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Image Model:</span>
                <span className="text-white font-medium">{imageModel === 'nano_banana_2' ? 'Nano Banana 2' : imageModel === 'openai_gpt_image' ? 'OpenAI Image (experimental)' : 'Nano Banana Pro'}</span>
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
                className="flex-1 px-4 py-3 rounded-sm bg-white/5 text-gray-300 hover:bg-white/10 transition-all font-medium focus:outline-none focus:ring-2 focus:ring-white/20"
              >
                Cancel
              </button>
              <button
                onClick={confirmAndStart}
                disabled={triggerIteration.isPending}
                className="flex-1 px-4 py-3 rounded-sm bg-[#FF3838] text-white hover:bg-[#FF5555] transition-all font-semibold focus:outline-none focus:ring-2 focus:ring-[#FF3838] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
      <div className="mt-8 bg-[#15171B] border border-white/5 rounded-lg p-8">
        <h2 className="text-lg font-semibold text-white mb-4">Recent Iterations</h2>
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
    <div className="mt-8 bg-[#15171B] border border-white/5 rounded-lg p-8">
      <h2 className="text-lg font-semibold text-white mb-4">Recent Iterations</h2>
      <div className="space-y-2">
        {runs.slice(0, 10).map((run: any) => (
          <button
            key={run.id}
            onClick={() => setLocation(`/results/${run.id}`)}
            className="w-full flex items-center gap-4 p-4 rounded-md bg-white/[0.02] hover:bg-white/5 border border-white/5 transition-all text-left focus:outline-none focus:ring-2 focus:ring-[#FF3838] focus:ring-offset-2 focus:ring-offset-[#15171B]"
          >
            <div className="w-16 h-16 rounded-md overflow-hidden bg-black/50 shrink-0">
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
