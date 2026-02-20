import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Type,
  Image as ImageIcon,
  Sparkles,
  CheckCircle,
  PenLine,
  X,
  Package,
  ArrowRight,
  ArrowLeft,
  Palette,
} from "lucide-react";

interface BriefOptions {
  backgrounds: Array<{ title: string; description: string; prompt: string }>;
  headlines: string[];
  subheadlines: string[];
  benefits: string;
}

interface SelectionGateProps {
  runId: number;
  options: BriefOptions;
  product: string;
  onSubmitted: () => void;
}

// CSS preset backgrounds — professional gradient/solid options
const CSS_PRESETS = [
  {
    id: "dark-energy",
    title: "Dark Energy",
    css: "background: radial-gradient(ellipse at 50% 80%, #2a0a0a 0%, #01040A 70%);",
    preview: "radial-gradient(ellipse at 50% 80%, #2a0a0a 0%, #01040A 70%)",
  },
  {
    id: "warm-amber",
    title: "Warm Amber",
    css: "background: radial-gradient(ellipse at 50% 60%, #4a2c0a 0%, #1a0f04 50%, #01040A 100%);",
    preview: "radial-gradient(ellipse at 50% 60%, #4a2c0a 0%, #1a0f04 50%, #01040A 100%)",
  },
  {
    id: "electric-blue",
    title: "Electric Blue",
    css: "background: radial-gradient(ellipse at 50% 70%, #0a1a3a 0%, #01040A 70%);",
    preview: "radial-gradient(ellipse at 50% 70%, #0a1a3a 0%, #01040A 70%)",
  },
  {
    id: "crimson-glow",
    title: "Crimson Glow",
    css: "background: radial-gradient(ellipse at 50% 50%, #3a0a0a 0%, #1a0505 40%, #01040A 80%);",
    preview: "radial-gradient(ellipse at 50% 50%, #3a0a0a 0%, #1a0505 40%, #01040A 80%)",
  },
  {
    id: "clean-pink",
    title: "Clean Pink",
    css: "background: linear-gradient(180deg, #f5d5d5 0%, #e8b4b4 50%, #d4a0a0 100%);",
    preview: "linear-gradient(180deg, #f5d5d5 0%, #e8b4b4 50%, #d4a0a0 100%)",
  },
  {
    id: "studio-white",
    title: "Studio White",
    css: "background: linear-gradient(180deg, #f8f8f8 0%, #e8e8e8 60%, #d0d0d0 100%);",
    preview: "linear-gradient(180deg, #f8f8f8 0%, #e8e8e8 60%, #d0d0d0 100%)",
  },
  {
    id: "midnight-purple",
    title: "Midnight Purple",
    css: "background: radial-gradient(ellipse at 50% 60%, #1a0a2e 0%, #0a0515 50%, #01040A 100%);",
    preview: "radial-gradient(ellipse at 50% 60%, #1a0a2e 0%, #0a0515 50%, #01040A 100%)",
  },
  {
    id: "forest-dark",
    title: "Forest Dark",
    css: "background: radial-gradient(ellipse at 50% 70%, #0a1a0a 0%, #050f05 50%, #01040A 100%);",
    preview: "radial-gradient(ellipse at 50% 70%, #0a1a0a 0%, #050f05 50%, #01040A 100%)",
  },
  {
    id: "sunset-gradient",
    title: "Sunset Gradient",
    css: "background: linear-gradient(135deg, #1a0505 0%, #3a1505 30%, #4a2005 60%, #1a0a02 100%);",
    preview: "linear-gradient(135deg, #1a0505 0%, #3a1505 30%, #4a2005 60%, #1a0a02 100%)",
  },
  {
    id: "solid-black",
    title: "Solid Black",
    css: "background: #01040A;",
    preview: "#01040A",
  },
];

type BackgroundSelection = 
  | { type: "uploaded"; url: string; title: string }
  | { type: "preset"; presetId: string; css: string; title: string }
  | { type: "flux"; title: string; description?: string; prompt: string }
  | null;

/**
 * Selection Gate UI — Stage 3b (Two-Step Flow)
 *
 * Step 1: User picks product render, headlines, subheadlines, benefits
 * Step 2: User picks backgrounds from uploads or CSS presets
 */
export default function SelectionGate({ runId, options, product, onSubmitted }: SelectionGateProps) {
  // Step management
  const [step, setStep] = useState<1 | 2>(1);

  // Product render selection
  const [selectedRenderUrl, setSelectedRenderUrl] = useState<string | null>(null);

  // Fetch available renders for this product
  const rendersQuery = trpc.renders.list.useQuery(
    product ? { product } : undefined
  );
  const renders = rendersQuery.data || [];

  // Fetch uploaded backgrounds
  const backgroundsQuery = trpc.backgrounds.list.useQuery();
  const uploadedBackgrounds = backgroundsQuery.data || [];

  // Per-image selections
  const [headlines, setHeadlines] = useState<(string | null)[]>([null, null, null]);
  const [customHeadlines, setCustomHeadlines] = useState<string[]>(["", "", ""]);
  const [useCustomHeadline, setUseCustomHeadline] = useState<boolean[]>([false, false, false]);

  const [subheadlines, setSubheadlines] = useState<(string | null)[]>([null, null, null]);
  const [customSubheadlines, setCustomSubheadlines] = useState<string[]>(["", "", ""]);
  const [useCustomSubheadline, setUseCustomSubheadline] = useState<boolean[]>([false, false, false]);
  const [noSubheadline, setNoSubheadline] = useState<boolean[]>([false, false, false]);

  // Shared benefits
  const [benefits, setBenefits] = useState(options.benefits || "");
  const [useCustomBenefits, setUseCustomBenefits] = useState(false);
  const [customBenefits, setCustomBenefits] = useState("");

  // Step 2: Background selections (uploaded or preset)
  const [selectedBackgrounds, setSelectedBackgrounds] = useState<BackgroundSelection[]>([null, null, null]);

  const utils = trpc.useUtils();

  // Submit final selections mutation
  const submitMutation = trpc.pipeline.submitSelections.useMutation({
    onSuccess: () => {
      toast.success("Selections submitted! Generating ad creatives...");
      utils.pipeline.get.invalidate({ id: runId });
      onSubmitted();
    },
    onError: (err) => {
      toast.error("Failed: " + err.message);
    },
  });

  const imageLabels = ["Image 1 (Control)", "Image 2 (Variation)", "Image 3 (Variation)"];

  function getHeadline(i: number): string | null {
    if (useCustomHeadline[i]) return customHeadlines[i].trim() || null;
    return headlines[i];
  }

  function getSubheadline(i: number): string | null {
    if (noSubheadline[i]) return null;
    if (useCustomSubheadline[i]) return customSubheadlines[i].trim() || null;
    return subheadlines[i];
  }

  // Validate Step 1 and proceed to Step 2
  function handleProceedToBackgrounds() {
    for (let i = 0; i < 3; i++) {
      const h = getHeadline(i);
      if (!h) {
        toast.error(`Please select or write a headline for ${imageLabels[i]}`);
        return;
      }
    }

    const finalBenefits = useCustomBenefits ? customBenefits.trim() : benefits;
    if (!finalBenefits) {
      toast.error("Please provide a benefit callout");
      return;
    }

    setStep(2);
  }

  function handleSubmit() {
    // Validate backgrounds
    for (let i = 0; i < 3; i++) {
      if (!selectedBackgrounds[i]) {
        toast.error(`Please select a background for ${imageLabels[i]}`);
        return;
      }
    }

    const finalBenefits = useCustomBenefits ? customBenefits.trim() : benefits;

    const selections: any = {
      images: [0, 1, 2].map(i => {
        const bg = selectedBackgrounds[i]!;
        let background: any;
        if (bg.type === "uploaded") {
          background = { type: "uploaded" as const, url: bg.url, title: bg.title };
        } else if (bg.type === "flux") {
          background = { type: "flux" as const, title: bg.title, description: bg.description, prompt: bg.prompt };
        } else {
          background = { type: "preset" as const, presetId: bg.presetId, css: bg.css, title: bg.title };
        }
        return {
          headline: getHeadline(i)!,
          subheadline: getSubheadline(i),
          background,
        };
      }),
      benefits: finalBenefits,
    };

    if (selectedRenderUrl) {
      selections.productRenderUrl = selectedRenderUrl;
    }

    submitMutation.mutate({ runId, selections });
  }

  function selectBackground(imgIdx: number, bg: BackgroundSelection) {
    const next = [...selectedBackgrounds];
    next[imgIdx] = bg;
    setSelectedBackgrounds(next);
  }

  return (
    <div className="bg-[#191B1F] border border-[#FF3838]/30 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#FF3838]/20 to-[#0347ED]/20 px-6 py-4 border-b border-white/10">
        <h2 className="text-white font-bold text-lg flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[#FF3838]" />
          Stage 3b: Select Your Creative Direction
        </h2>
        <p className="text-gray-400 text-sm mt-1">
          {step === 1
            ? "Step 1 of 2 — Choose your product render, headlines, subheadlines, and benefits."
            : "Step 2 of 2 — Pick a background for each image from your uploads or presets."}
        </p>
        {/* Step indicator */}
        <div className="flex items-center gap-3 mt-3">
          <div className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-full ${
            step === 1 ? "bg-[#FF3838] text-white" : "bg-[#FF3838]/20 text-[#FF3838]"
          }`}>
            {step > 1 ? <CheckCircle className="w-3 h-3" /> : <span className="font-bold">1</span>}
            Copy & Benefits
          </div>
          <ArrowRight className="w-3 h-3 text-gray-500" />
          <div className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-full ${
            step === 2 ? "bg-[#0347ED] text-white" : "bg-white/5 text-gray-500"
          }`}>
            <span className="font-bold">2</span>
            Backgrounds
          </div>
        </div>
      </div>

      <div className="p-6 space-y-8">
        {/* ============================================================ */}
        {/* STEP 1: Product Render + Headlines + Subheadlines + Benefits */}
        {/* ============================================================ */}
        {step === 1 && (
          <>
            {/* PRODUCT RENDER */}
            <div>
              <h3 className="text-white font-semibold text-base mb-1 flex items-center gap-2">
                <Package className="w-4 h-4 text-[#0347ED]" />
                Product Render <span className="text-gray-500 text-xs font-normal">(used across all 3 images)</span>
              </h3>
              <p className="text-gray-500 text-xs mb-4">
                Select which product render to use. If none selected, the system will pick one automatically.
              </p>
              <div className="bg-[#01040A] rounded-lg p-4 border border-white/5">
                {rendersQuery.isLoading ? (
                  <div className="flex items-center gap-2 text-gray-400 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading product renders...
                  </div>
                ) : renders.length === 0 ? (
                  <div className="text-gray-500 text-sm">
                    No renders uploaded for <span className="text-white font-medium">{product}</span>.
                    Upload renders in the Product Render Manager for better results.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {renders.map((render: any) => (
                      <button
                        key={render.id}
                        onClick={() => setSelectedRenderUrl(
                          selectedRenderUrl === render.url ? null : render.url
                        )}
                        className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                          selectedRenderUrl === render.url
                            ? "border-[#0347ED] ring-2 ring-[#0347ED]/30"
                            : "border-white/10 hover:border-white/20"
                        }`}
                      >
                        <img
                          src={render.url}
                          alt={render.fileName}
                          className="w-full aspect-square object-contain bg-[#191B1F]"
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-2 py-1.5">
                          <p className="text-white text-xs truncate">{render.fileName}</p>
                        </div>
                        {selectedRenderUrl === render.url && (
                          <div className="absolute top-2 right-2 bg-[#0347ED] rounded-full p-1">
                            <CheckCircle className="w-3.5 h-3.5 text-white" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* HEADLINES */}
            <div>
              <h3 className="text-white font-semibold text-base mb-1 flex items-center gap-2">
                <Type className="w-4 h-4 text-[#FF3838]" />
                Headlines <span className="text-gray-500 text-xs font-normal">(pick one per image)</span>
              </h3>
              <p className="text-gray-500 text-xs mb-4">Select from AI suggestions or write your own for each image.</p>

              {[0, 1, 2].map(imgIdx => (
                <div key={imgIdx} className="mb-5 bg-[#01040A] rounded-lg p-4 border border-white/5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-300">{imageLabels[imgIdx]}</span>
                    {getHeadline(imgIdx) && (
                      <span className="text-xs text-emerald-400 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Selected
                      </span>
                    )}
                  </div>

                  {!useCustomHeadline[imgIdx] && (
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {options.headlines.map((h, hIdx) => (
                        <button
                          key={hIdx}
                          onClick={() => {
                            const next = [...headlines];
                            next[imgIdx] = h;
                            setHeadlines(next);
                          }}
                          className={`text-left text-sm px-3 py-2.5 rounded-lg border transition-all ${
                            headlines[imgIdx] === h
                              ? "border-[#FF3838] bg-[#FF3838]/10 text-white"
                              : "border-white/10 bg-white/5 text-gray-300 hover:border-white/20 hover:bg-white/10"
                          }`}
                        >
                          {h}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const next = [...useCustomHeadline];
                        next[imgIdx] = !next[imgIdx];
                        setUseCustomHeadline(next);
                        if (!next[imgIdx]) {
                          const nextH = [...headlines];
                          nextH[imgIdx] = null;
                          setHeadlines(nextH);
                        }
                      }}
                      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all ${
                        useCustomHeadline[imgIdx]
                          ? "border-[#0347ED] bg-[#0347ED]/10 text-[#0347ED]"
                          : "border-white/10 text-gray-500 hover:text-gray-300"
                      }`}
                    >
                      <PenLine className="w-3 h-3" />
                      {useCustomHeadline[imgIdx] ? "Writing custom" : "Write your own"}
                    </button>
                  </div>

                  {useCustomHeadline[imgIdx] && (
                    <input
                      type="text"
                      value={customHeadlines[imgIdx]}
                      onChange={(e) => {
                        const next = [...customHeadlines];
                        next[imgIdx] = e.target.value;
                        setCustomHeadlines(next);
                      }}
                      placeholder="Type your custom headline..."
                      className="mt-2 w-full bg-[#191B1F] border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#FF3838]/50"
                    />
                  )}
                </div>
              ))}
            </div>

            {/* SUBHEADLINES */}
            <div>
              <h3 className="text-white font-semibold text-base mb-1 flex items-center gap-2">
                <Type className="w-4 h-4 text-[#0347ED]" />
                Subheadlines <span className="text-gray-500 text-xs font-normal">(optional — pick one per image or none)</span>
              </h3>
              <p className="text-gray-500 text-xs mb-4">Subheadlines are optional. Select, write your own, or skip.</p>

              {[0, 1, 2].map(imgIdx => (
                <div key={imgIdx} className="mb-5 bg-[#01040A] rounded-lg p-4 border border-white/5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-300">{imageLabels[imgIdx]}</span>
                    <div className="flex items-center gap-2">
                      {noSubheadline[imgIdx] && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <X className="w-3 h-3" /> None
                        </span>
                      )}
                      {!noSubheadline[imgIdx] && getSubheadline(imgIdx) && (
                        <span className="text-xs text-emerald-400 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Selected
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-3">
                    <button
                      onClick={() => {
                        const next = [...noSubheadline];
                        next[imgIdx] = !next[imgIdx];
                        setNoSubheadline(next);
                        if (next[imgIdx]) {
                          const nextS = [...subheadlines];
                          nextS[imgIdx] = null;
                          setSubheadlines(nextS);
                          const nextC = [...useCustomSubheadline];
                          nextC[imgIdx] = false;
                          setUseCustomSubheadline(nextC);
                        }
                      }}
                      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all ${
                        noSubheadline[imgIdx]
                          ? "border-gray-500 bg-gray-500/10 text-gray-400"
                          : "border-white/10 text-gray-500 hover:text-gray-300"
                      }`}
                    >
                      <X className="w-3 h-3" />
                      {noSubheadline[imgIdx] ? "No subheadline" : "Skip subheadline"}
                    </button>

                    {!noSubheadline[imgIdx] && (
                      <button
                        onClick={() => {
                          const next = [...useCustomSubheadline];
                          next[imgIdx] = !next[imgIdx];
                          setUseCustomSubheadline(next);
                        }}
                        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all ${
                          useCustomSubheadline[imgIdx]
                            ? "border-[#0347ED] bg-[#0347ED]/10 text-[#0347ED]"
                            : "border-white/10 text-gray-500 hover:text-gray-300"
                        }`}
                      >
                        <PenLine className="w-3 h-3" />
                        {useCustomSubheadline[imgIdx] ? "Writing custom" : "Write your own"}
                      </button>
                    )}
                  </div>

                  {!noSubheadline[imgIdx] && !useCustomSubheadline[imgIdx] && (
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      {options.subheadlines.map((s, sIdx) => (
                        <button
                          key={sIdx}
                          onClick={() => {
                            const next = [...subheadlines];
                            next[imgIdx] = s;
                            setSubheadlines(next);
                          }}
                          className={`text-left text-sm px-3 py-2.5 rounded-lg border transition-all ${
                            subheadlines[imgIdx] === s
                              ? "border-[#0347ED] bg-[#0347ED]/10 text-white"
                              : "border-white/10 bg-white/5 text-gray-300 hover:border-white/20 hover:bg-white/10"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}

                  {!noSubheadline[imgIdx] && useCustomSubheadline[imgIdx] && (
                    <input
                      type="text"
                      value={customSubheadlines[imgIdx]}
                      onChange={(e) => {
                        const next = [...customSubheadlines];
                        next[imgIdx] = e.target.value;
                        setCustomSubheadlines(next);
                      }}
                      placeholder="Type your custom subheadline..."
                      className="w-full bg-[#191B1F] border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#0347ED]/50"
                    />
                  )}
                </div>
              ))}
            </div>

            {/* BENEFITS */}
            <div>
              <h3 className="text-white font-semibold text-base mb-1 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-yellow-400" />
                Benefit Callout <span className="text-gray-500 text-xs font-normal">(shared across all 3 images)</span>
              </h3>
              <p className="text-gray-500 text-xs mb-4">This benefit text appears on all 3 generated images.</p>

              <div className="bg-[#01040A] rounded-lg p-4 border border-white/5">
                {!useCustomBenefits && (
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex-1 bg-[#191B1F] border border-[#FF3838]/30 rounded-lg px-4 py-3">
                      <span className="text-white text-sm font-medium">{benefits}</span>
                    </div>
                    <button
                      onClick={() => setUseCustomBenefits(true)}
                      className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-white/10 text-gray-500 hover:text-gray-300 hover:border-white/20 transition-all whitespace-nowrap"
                    >
                      <PenLine className="w-3 h-3" />
                      Write your own
                    </button>
                  </div>
                )}

                {useCustomBenefits && (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={customBenefits}
                      onChange={(e) => setCustomBenefits(e.target.value)}
                      placeholder="Type your custom benefit callout (2-5 words)..."
                      className="w-full bg-[#191B1F] border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-yellow-400/50"
                    />
                    <button
                      onClick={() => {
                        setUseCustomBenefits(false);
                        setCustomBenefits("");
                      }}
                      className="text-xs text-gray-500 hover:text-gray-300"
                    >
                      &larr; Use AI suggestion instead
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* STEP 1 → STEP 2 BUTTON */}
            <Button
              onClick={handleProceedToBackgrounds}
              className="w-full bg-[#0347ED] hover:bg-[#0347ED]/90 text-white py-3 text-base font-semibold"
            >
              Choose Backgrounds
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </>
        )}

        {/* ============================================================ */}
        {/* STEP 2: Background Selection (Uploads + CSS Presets) */}
        {/* ============================================================ */}
        {step === 2 && (
          <>
            {/* Back button */}
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Step 1 (Edit copy)
            </button>

            {/* Summary of Step 1 selections */}
            <div className="bg-[#01040A] rounded-lg p-4 border border-white/5">
              <h4 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">Your Copy Selections</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[0, 1, 2].map(i => (
                  <div key={i} className="bg-[#191B1F] rounded-lg p-3 border border-white/5">
                    <div className="text-xs font-bold text-gray-500 mb-1">{imageLabels[i]}</div>
                    <p className="text-white text-sm font-semibold">{getHeadline(i)}</p>
                    {getSubheadline(i) && (
                      <p className="text-gray-400 text-xs mt-0.5">{getSubheadline(i)}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Background selection per image */}
            {[0, 1, 2].map(imgIdx => (
              <div key={imgIdx}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white font-semibold text-base flex items-center gap-2">
                    <Palette className="w-4 h-4 text-[#FF3838]" />
                    {imageLabels[imgIdx]} Background
                  </h3>
                  {selectedBackgrounds[imgIdx] && (
                    <span className="text-xs text-emerald-400 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> {selectedBackgrounds[imgIdx]!.title}
                    </span>
                  )}
                </div>

                {/* Uploaded backgrounds */}
                {uploadedBackgrounds.length > 0 && (
                  <div className="mb-4">
                    <p className="text-gray-500 text-xs mb-2 font-medium uppercase tracking-wider">Your Uploads</p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                      {uploadedBackgrounds.map((bg: any) => {
                        const isSelected = selectedBackgrounds[imgIdx]?.type === "uploaded" && 
                          (selectedBackgrounds[imgIdx] as any)?.url === bg.url;
                        return (
                          <button
                            key={bg.id}
                            onClick={() => selectBackground(imgIdx, {
                              type: "uploaded",
                              url: bg.url,
                              title: bg.fileName || bg.category || "Uploaded",
                            })}
                            className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                              isSelected
                                ? "border-[#FF3838] ring-2 ring-[#FF3838]/30"
                                : "border-white/10 hover:border-white/30"
                            }`}
                          >
                            <img
                              src={bg.url}
                              alt={bg.fileName}
                              className="w-full h-full object-cover"
                            />
                            {isSelected && (
                              <div className="absolute inset-0 bg-[#FF3838]/20 flex items-center justify-center">
                                <CheckCircle className="w-6 h-6 text-white drop-shadow-lg" />
                              </div>
                            )}
                            {bg.category && (
                              <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-0.5">
                                <p className="text-white text-[10px] truncate">{bg.category}</p>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* AI-Generated Backgrounds (from Claude's analysis) */}
                {options.backgrounds && options.backgrounds.length > 0 && (
                  <div className="mb-4">
                    <p className="text-gray-500 text-xs mb-2 font-medium uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-[#FF3838]" /> AI-Generated Backgrounds (Flux Pro)
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {options.backgrounds.map((bg, bgIdx) => {
                        const isSelected = selectedBackgrounds[imgIdx]?.type === "flux" &&
                          (selectedBackgrounds[imgIdx] as any)?.prompt === bg.prompt;
                        return (
                          <button
                            key={bgIdx}
                            onClick={() => selectBackground(imgIdx, {
                              type: "flux",
                              title: bg.title,
                              description: bg.description,
                              prompt: bg.prompt,
                            })}
                            className={`relative text-left rounded-lg p-3 border-2 transition-all ${
                              isSelected
                                ? "border-[#FF3838] ring-2 ring-[#FF3838]/30 bg-[#FF3838]/5"
                                : "border-white/10 hover:border-white/30 bg-[#01040A]"
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              <Sparkles className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isSelected ? "text-[#FF3838]" : "text-gray-500"}`} />
                              <div>
                                <p className={`text-sm font-medium ${isSelected ? "text-white" : "text-gray-300"}`}>{bg.title}</p>
                                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{bg.description}</p>
                              </div>
                            </div>
                            {isSelected && (
                              <div className="absolute top-2 right-2">
                                <CheckCircle className="w-4 h-4 text-[#FF3838]" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* CSS Presets */}
                <div className="mb-4">
                  <p className="text-gray-500 text-xs mb-2 font-medium uppercase tracking-wider">Gradient Presets</p>
                  <div className="grid grid-cols-5 sm:grid-cols-5 md:grid-cols-10 gap-2">
                    {CSS_PRESETS.map(preset => {
                      const isSelected = selectedBackgrounds[imgIdx]?.type === "preset" &&
                        (selectedBackgrounds[imgIdx] as any)?.presetId === preset.id;
                      return (
                        <button
                          key={preset.id}
                          onClick={() => selectBackground(imgIdx, {
                            type: "preset",
                            presetId: preset.id,
                            css: preset.css,
                            title: preset.title,
                          })}
                          className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                            isSelected
                              ? "border-[#FF3838] ring-2 ring-[#FF3838]/30"
                              : "border-white/10 hover:border-white/30"
                          }`}
                          title={preset.title}
                        >
                          <div
                            className="w-full h-full"
                            style={{ background: preset.preview }}
                          />
                          {isSelected && (
                            <div className="absolute inset-0 bg-[#FF3838]/20 flex items-center justify-center">
                              <CheckCircle className="w-4 h-4 text-white drop-shadow-lg" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {imgIdx < 2 && <div className="border-b border-white/5 mb-6" />}
              </div>
            ))}

            {/* PREVIEW & SUBMIT */}
            <div className="bg-[#01040A] rounded-lg p-5 border border-white/10">
              <h3 className="text-white font-semibold text-base mb-4">Final Preview</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {[0, 1, 2].map(i => {
                  const h = getHeadline(i);
                  const s = getSubheadline(i);
                  const bg = selectedBackgrounds[i];
                  const b = useCustomBenefits ? customBenefits : benefits;
                  const isComplete = h && bg;

                  return (
                    <div
                      key={i}
                      className={`rounded-lg p-4 border ${
                        isComplete ? "border-emerald-500/30 bg-emerald-500/5" : "border-white/10 bg-white/5"
                      }`}
                    >
                      <div className="text-xs font-bold text-gray-400 mb-2">{imageLabels[i]}</div>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-gray-500 text-xs">Product Render:</span>
                          <p className="text-gray-300">{selectedRenderUrl ? "Selected" : "(auto)"}</p>
                        </div>
                        <div>
                          <span className="text-gray-500 text-xs">Headline:</span>
                          <p className={`font-semibold ${h ? "text-white" : "text-red-400"}`}>
                            {h || "Not selected"}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-500 text-xs">Subheadline:</span>
                          <p className="text-gray-300">{s || "(none)"}</p>
                        </div>
                        <div>
                          <span className="text-gray-500 text-xs">Background:</span>
                          <p className={bg ? "text-gray-300" : "text-red-400"}>
                            {bg ? (
                              <>
                                {bg.title}
                                {bg.type === "flux" && <span className="text-[#FF3838] text-[10px] ml-1">(AI)</span>}
                              </>
                            ) : "Not selected"}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-500 text-xs">Benefits:</span>
                          <p className="text-[#FF3838] font-medium">{b || "Not set"}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <Button
                onClick={handleSubmit}
                disabled={submitMutation.isPending}
                className="w-full bg-[#FF3838] hover:bg-[#FF3838]/90 text-white py-3 text-base font-semibold"
              >
                {submitMutation.isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Submitting selections...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Generate Ad Creatives with These Selections
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
