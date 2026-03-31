import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Loader2,
  Copy,
  CheckCircle,
  XCircle,
  ImagePlus,
  Upload,
  Sparkles,
  Minus,
  Plus,
  BookmarkPlus,
} from "lucide-react";

const PILLARS = [
  "PTC Value",
  "Story",
  "Edutaining",
  "Trends",
  "Sale",
  "Motivation",
  "Life Dump",
  "Workout",
];

const PURPOSES = ["Educate", "Inspire", "Entertain", "Sell", "Connect"];

const PRODUCTS = [
  "Hyperburn",
  "Thermosleep",
  "Hyperload",
  "Thermoburn",
  "Carb Control",
  "Protein + Collagen",
  "Creatine",
  "HyperPump",
  "AminoLoad",
  "Marine Collagen",
  "SuperGreens",
  "Whey ISO Pro",
];

type SlideSource = "ai" | "upload";

type Slide = {
  id: number;
  source: SlideSource;
  headline: string;
  body: string;
  imagePreview: string | null;
  uploadedFile: File | null;
  status: "draft" | "generating" | "generated" | "approved" | "rejected";
};

type PlatformTab = "instagram" | "tiktok" | "linkedin";

function createSlide(id: number): Slide {
  return {
    id,
    source: "ai",
    headline: "",
    body: "",
    imagePreview: null,
    uploadedFile: null,
    status: "draft",
  };
}

export default function VisualContent() {
  // Content Info
  const [pillar, setPillar] = useState("");
  const [purpose, setPurpose] = useState("");
  const [topic, setTopic] = useState("");

  // Format
  const [format, setFormat] = useState<"single" | "carousel">("single");
  const [slideCount, setSlideCount] = useState(3);

  // Product
  const [product, setProduct] = useState("");
  const [overlayProduct, setOverlayProduct] = useState(false);

  // Slide state
  const [slides, setSlides] = useState<Slide[]>([createSlide(1)]);
  const [activeSlideIdx, setActiveSlideIdx] = useState(0);

  // Caption state
  const [captions, setCaptions] = useState<Record<string, string> | null>(null);
  const [captionTab, setCaptionTab] = useState<PlatformTab>("instagram");

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [runId, setRunId] = useState<number | null>(null);

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Visual content trigger mutation
  const triggerVisualContent = trpc.organic.triggerVisualContent.useMutation({
    onSuccess: (data: { runId: number }) => {
      setRunId(data.runId);
      toast.success("Generation started");
    },
    onError: (err: any) => {
      setIsGenerating(false);
      toast.error(`Generation failed: ${err.message}`);
    },
  });

  // Upload slide image mutation (for upload-source slides)
  const uploadSlideImage = trpc.organic.uploadSlideImage.useMutation();

  // Poll run status
  const runQuery = trpc.organic.getRun.useQuery(
    { id: runId! },
    {
      enabled: !!runId,
      refetchInterval: (query: any) => {
        const status = query.state.data?.status;
        return status === "running" || status === "pending" ? 2000 : false;
      },
    },
  );

  // Sync polled slidesJson back into local slide state
  useEffect(() => {
    if (!runQuery.data?.slidesJson) return;
    try {
      const serverSlides = typeof runQuery.data.slidesJson === "string"
        ? JSON.parse(runQuery.data.slidesJson)
        : runQuery.data.slidesJson;
      if (!Array.isArray(serverSlides)) return;

      setSlides((prev) =>
        prev.map((s, i) => {
          const server = serverSlides[i];
          if (!server) return s;
          return {
            ...s,
            imagePreview: server.imageUrl || s.imagePreview,
            status:
              server.status === "generated" ? "generated" :
              server.status === "uploaded" ? "generated" :
              server.status === "failed" ? "rejected" :
              s.status,
            headline: server.headline || s.headline,
            body: server.body || s.body,
          };
        }),
      );

      if (runQuery.data.status === "completed" || runQuery.data.status === "failed") {
        setIsGenerating(false);
        if (runQuery.data.status === "completed") {
          toast.success("Images generated");
        } else if (runQuery.data.status === "failed") {
          toast.error(runQuery.data.errorMessage || "Generation failed");
        }
      }
    } catch {
      // Ignore parse errors
    }
  }, [runQuery.data]);

  // Caption mutation (uses existing organic.generateCaption endpoint)
  const generateCaption = trpc.organic.generateCaption.useMutation({
    onSuccess: (data: any) => {
      setCaptions(data.captions as Record<string, string>);
      toast.success("Captions generated");
    },
    onError: (err: any) => {
      toast.error(`Caption generation failed: ${err.message}`);
    },
  });

  // Sync slides when format/slideCount changes
  const handleFormatChange = (newFormat: "single" | "carousel") => {
    setFormat(newFormat);
    if (newFormat === "single") {
      setSlides([createSlide(1)]);
      setActiveSlideIdx(0);
    } else {
      const newSlides = Array.from({ length: slideCount }, (_, i) => createSlide(i + 1));
      setSlides(newSlides);
      setActiveSlideIdx(0);
    }
    setCaptions(null);
  };

  const handleSlideCountChange = (delta: number) => {
    const newCount = Math.max(3, Math.min(8, slideCount + delta));
    setSlideCount(newCount);
    const newSlides = Array.from({ length: newCount }, (_, i) =>
      slides[i] || createSlide(i + 1)
    );
    setSlides(newSlides);
    if (activeSlideIdx >= newCount) {
      setActiveSlideIdx(newCount - 1);
    }
    setCaptions(null);
  };

  const updateSlide = (idx: number, updates: Partial<Slide>) => {
    setSlides((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...updates };
      return next;
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Only PNG, JPG, and WebP images are allowed");
      e.target.value = "";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be under 10MB");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      updateSlide(activeSlideIdx, {
        imagePreview: ev.target?.result as string,
        uploadedFile: file,
        status: "draft",
      });
    };
    reader.readAsDataURL(file);
    // Reset file input so re-uploading same file works
    e.target.value = "";
  };

  const handleGenerateAll = async () => {
    if (!pillar) {
      toast.error("Please select a content pillar");
      return;
    }
    if (!purpose) {
      toast.error("Please select a content purpose");
      return;
    }
    if (!topic.trim()) {
      toast.error("Please enter a topic");
      return;
    }

    setIsGenerating(true);

    // Mark all slides as generating
    setSlides((prev) => prev.map((s) => ({ ...s, status: "generating" as const })));

    try {
      // Upload any upload-source slides to S3 first
      const slidesForServer = await Promise.all(
        slides.map(async (s) => {
          if (s.source === "upload" && s.uploadedFile) {
            const base64 = await fileToBase64(s.uploadedFile);
            const result = await uploadSlideImage.mutateAsync({
              base64Data: base64,
              mimeType: s.uploadedFile.type as "image/png" | "image/jpeg" | "image/webp",
              fileName: s.uploadedFile.name,
            });
            return {
              source: "upload" as const,
              headline: s.headline,
              body: s.body,
              uploadedImageUrl: result.imageUrl,
            };
          }
          return {
            source: s.source,
            headline: s.headline,
            body: s.body,
          };
        }),
      );

      // Trigger the pipeline
      triggerVisualContent.mutate({
        pillar,
        purpose,
        topic: topic.trim(),
        format,
        slideCount: slides.length,
        slides: slidesForServer,
        product: product && product !== "none" ? product : undefined,
        overlayProduct,
        aspectRatio: "1:1",
      });
    } catch (err: any) {
      setIsGenerating(false);
      toast.error(`Upload failed: ${err.message}`);
    }
  };

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  const allSlidesApproved = slides.every((s) => s.status === "approved");

  const handleGenerateCaptions = () => {
    if (!pillar || !purpose || !topic.trim()) {
      toast.error("Missing content info for caption generation");
      return;
    }
    const slideContext = slides
      .map((s, i) => `Slide ${i + 1}: Headline: "${s.headline}" Body: "${s.body}"`)
      .join("\n");

    generateCaption.mutate({
      pillar,
      purpose,
      topic: topic.trim(),
      context: `Visual content (${format === "single" ? "single image" : `carousel with ${slides.length} slides`})${product ? `, featuring ${product}` : ""}.\n\nSlide content:\n${slideContext}`,
    });
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} caption copied`);
  };

  const activeSlide = slides[activeSlideIdx];

  return (
    <div className="min-h-screen bg-[#01040A]">
      <div className="p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Visual Content</h1>
          <p className="text-gray-400 text-sm">
            Create AI-powered photos and carousel posts for organic content
          </p>
        </div>

        <div className="flex gap-6">
          {/* LEFT PANEL - Controls */}
          <div className="w-[400px] shrink-0 space-y-5">
            {/* Content Info */}
            <div className="bg-[#0D0F12] rounded-xl border border-white/5 p-5 space-y-4">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                Content Info
              </p>

              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">Pillar</label>
                <Select value={pillar} onValueChange={setPillar}>
                  <SelectTrigger className="w-full bg-white/5 border-white/10 text-white">
                    <SelectValue placeholder="Select pillar" />
                  </SelectTrigger>
                  <SelectContent>
                    {PILLARS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">Purpose</label>
                <Select value={purpose} onValueChange={setPurpose}>
                  <SelectTrigger className="w-full bg-white/5 border-white/10 text-white">
                    <SelectValue placeholder="Select purpose" />
                  </SelectTrigger>
                  <SelectContent>
                    {PURPOSES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">Topic</label>
                <Input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Morning routine with Hyperburn"
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-600"
                />
              </div>
            </div>

            {/* Format */}
            <div className="bg-[#0D0F12] rounded-xl border border-white/5 p-5 space-y-4">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                Format
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => handleFormatChange("single")}
                  className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium border transition-colors ${
                    format === "single"
                      ? "bg-[#FF3838]/10 border-[#FF3838]/30 text-[#FF3838]"
                      : "bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10"
                  }`}
                >
                  Single Image
                </button>
                <button
                  onClick={() => handleFormatChange("carousel")}
                  className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium border transition-colors ${
                    format === "carousel"
                      ? "bg-[#FF3838]/10 border-[#FF3838]/30 text-[#FF3838]"
                      : "bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10"
                  }`}
                >
                  Carousel (3-8)
                </button>
              </div>

              {format === "carousel" && (
                <div>
                  <label className="text-xs text-gray-500 mb-2 block">Slide Count</label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleSlideCountChange(-1)}
                      disabled={slideCount <= 3}
                      className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-white font-semibold text-lg w-8 text-center">
                      {slideCount}
                    </span>
                    <button
                      onClick={() => handleSlideCountChange(1)}
                      disabled={slideCount >= 8}
                      className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Product (optional) */}
            <div className="bg-[#0D0F12] rounded-xl border border-white/5 p-5 space-y-4">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                Product <span className="text-gray-600 normal-case">(optional)</span>
              </p>

              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">Product</label>
                <Select value={product} onValueChange={setProduct}>
                  <SelectTrigger className="w-full bg-white/5 border-white/10 text-white">
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {PRODUCTS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {product && product !== "none" && (
                <label className="flex items-center gap-3 cursor-pointer">
                  <div
                    className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                      overlayProduct
                        ? "bg-[#FF3838] border-[#FF3838]"
                        : "bg-white/5 border-white/10"
                    }`}
                    onClick={() => setOverlayProduct(!overlayProduct)}
                  >
                    {overlayProduct && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <span className="text-sm text-gray-300">Overlay product</span>
                </label>
              )}
            </div>

            {/* Generate All */}
            <Button
              onClick={handleGenerateAll}
              disabled={isGenerating}
              className="w-full h-11 bg-[#FF3838] hover:bg-[#FF3838]/90 text-white font-semibold"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate All
                </>
              )}
            </Button>
          </div>

          {/* RIGHT PANEL - Slide Builder & Output */}
          <div className="flex-1 min-w-0 space-y-5">
            {/* Slide Thumbnails */}
            <div className="bg-[#0D0F12] rounded-xl border border-white/5 p-5">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-4">
                Slide Builder
              </p>

              <div className="flex gap-2 overflow-x-auto pb-2">
                {slides.map((slide, idx) => (
                  <button
                    key={slide.id}
                    onClick={() => setActiveSlideIdx(idx)}
                    className={`shrink-0 w-16 h-16 rounded-lg border-2 flex flex-col items-center justify-center gap-1 transition-all ${
                      idx === activeSlideIdx
                        ? "border-[#FF3838] bg-[#FF3838]/10"
                        : "border-white/10 bg-white/5 hover:border-white/20"
                    }`}
                  >
                    {slide.imagePreview ? (
                      <img
                        src={slide.imagePreview}
                        alt={`Slide ${idx + 1}`}
                        className="w-full h-full object-cover rounded-md"
                      />
                    ) : (
                      <>
                        <span className="text-xs font-semibold text-gray-400">
                          S{idx + 1}
                        </span>
                        {slide.status === "generating" && (
                          <Loader2 className="w-3 h-3 text-[#FF3838] animate-spin" />
                        )}
                        {slide.status === "approved" && (
                          <CheckCircle className="w-3 h-3 text-green-400" />
                        )}
                        {slide.status === "rejected" && (
                          <XCircle className="w-3 h-3 text-red-400" />
                        )}
                      </>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Active Slide Editor */}
            {activeSlide && (
              <div className="bg-[#0D0F12] rounded-xl border border-white/5 p-5 space-y-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Slide {activeSlideIdx + 1}
                  </p>
                  {activeSlide.status === "generated" && (
                    <span className="text-[10px] font-medium text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-full">
                      Awaiting Review
                    </span>
                  )}
                  {activeSlide.status === "approved" && (
                    <span className="text-[10px] font-medium text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">
                      Approved
                    </span>
                  )}
                  {activeSlide.status === "rejected" && (
                    <span className="text-[10px] font-medium text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full">
                      Rejected
                    </span>
                  )}
                </div>

                {/* Source Toggle */}
                <div>
                  <label className="text-xs text-gray-500 mb-2 block">Source</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateSlide(activeSlideIdx, { source: "ai" })}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                        activeSlide.source === "ai"
                          ? "bg-[#FF3838]/10 border-[#FF3838]/30 text-[#FF3838]"
                          : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      AI Generate
                    </button>
                    <button
                      onClick={() => updateSlide(activeSlideIdx, { source: "upload" })}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                        activeSlide.source === "upload"
                          ? "bg-[#FF3838]/10 border-[#FF3838]/30 text-[#FF3838]"
                          : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                      }`}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Upload Image
                    </button>
                  </div>
                </div>

                {/* Image Preview / Upload */}
                <div>
                  {activeSlide.source === "ai" ? (
                    <div className="w-full aspect-square rounded-lg border border-white/10 bg-white/5 flex items-center justify-center overflow-hidden">
                      {activeSlide.imagePreview ? (
                        <img
                          src={activeSlide.imagePreview}
                          alt={`Slide ${activeSlideIdx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      ) : activeSlide.status === "generating" ? (
                        <div className="text-center">
                          <Loader2 className="w-8 h-8 text-[#FF3838] animate-spin mx-auto mb-2" />
                          <p className="text-xs text-gray-500">Generating image...</p>
                        </div>
                      ) : (
                        <div className="text-center">
                          <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-3">
                            <ImagePlus className="w-5 h-5 text-gray-600" />
                          </div>
                          <p className="text-xs text-gray-500 mb-1">AI-generated image</p>
                          <span className="inline-block text-[10px] font-medium text-[#FF3838] bg-[#FF3838]/10 px-2 py-0.5 rounded-full">
                            Coming Soon
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full aspect-square rounded-lg border border-dashed border-white/10 bg-white/5 flex items-center justify-center cursor-pointer hover:border-white/20 hover:bg-white/[0.07] transition-colors overflow-hidden"
                    >
                      {activeSlide.imagePreview ? (
                        <img
                          src={activeSlide.imagePreview}
                          alt={`Slide ${activeSlideIdx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-center">
                          <Upload className="w-6 h-6 text-gray-600 mx-auto mb-2" />
                          <p className="text-xs text-gray-500">Click to upload image</p>
                          <p className="text-[10px] text-gray-600 mt-1">PNG, JPG up to 10MB</p>
                        </div>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </div>
                  )}
                </div>

                {/* Headline & Body */}
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1.5 block">Headline</label>
                    <Input
                      value={activeSlide.headline}
                      onChange={(e) =>
                        updateSlide(activeSlideIdx, { headline: e.target.value })
                      }
                      placeholder="Slide headline text..."
                      className="bg-white/5 border-white/10 text-white placeholder:text-gray-600"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1.5 block">Body</label>
                    <Input
                      value={activeSlide.body}
                      onChange={(e) =>
                        updateSlide(activeSlideIdx, { body: e.target.value })
                      }
                      placeholder="Slide body text..."
                      className="bg-white/5 border-white/10 text-white placeholder:text-gray-600"
                    />
                  </div>
                </div>

                {/* Per-slide Approve / Reject */}
                {(activeSlide.status === "generated" || activeSlide.status === "approved" || activeSlide.status === "rejected") && (
                  <div className="flex gap-3">
                    <Button
                      onClick={() => updateSlide(activeSlideIdx, { status: "approved" })}
                      disabled={activeSlide.status === "approved"}
                      className="bg-green-600 hover:bg-green-600/90 text-white"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Approve
                    </Button>
                    <Button
                      onClick={() => updateSlide(activeSlideIdx, { status: "rejected" })}
                      disabled={activeSlide.status === "rejected"}
                      variant="outline"
                      className="border-white/10 text-gray-300 hover:bg-white/5"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Caption Output - shown after all slides approved */}
            {allSlidesApproved && slides[0]?.status === "approved" && (
              <div className="bg-[#0D0F12] rounded-xl border border-white/5 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Captions
                  </p>
                  <Button
                    onClick={handleGenerateCaptions}
                    disabled={generateCaption.isPending}
                    size="sm"
                    className="bg-[#FF3838] hover:bg-[#FF3838]/90 text-white text-xs"
                  >
                    {generateCaption.isPending ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        {captions ? "Regenerate Captions" : "Generate Captions"}
                      </>
                    )}
                  </Button>
                </div>

                {captions ? (
                  <>
                    <div className="flex gap-1">
                      {(["instagram", "tiktok", "linkedin"] as PlatformTab[]).map(
                        (platform) => (
                          <button
                            key={platform}
                            onClick={() => setCaptionTab(platform)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              captionTab === platform
                                ? "bg-white/10 text-white"
                                : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                            }`}
                          >
                            {platform.charAt(0).toUpperCase() + platform.slice(1)}
                          </button>
                        )
                      )}
                    </div>
                    <div className="bg-white/5 rounded-lg p-4">
                      <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                        {captions[captionTab] || "No caption for this platform"}
                      </p>
                      <div className="mt-3 flex justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            handleCopy(captions[captionTab] || "", captionTab)
                          }
                          className="text-gray-400 hover:text-white"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          Copy
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-gray-600">
                    All slides approved. Generate captions for your visual content.
                  </p>
                )}
              </div>
            )}

            {/* Save to Library */}
            {captions && (
              <Button
                variant="outline"
                className="w-full border-white/10 text-gray-300 hover:bg-white/5"
                onClick={() => toast.success("Saved to library (coming soon)")}
              >
                <BookmarkPlus className="w-4 h-4" />
                Save to Library
              </Button>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
