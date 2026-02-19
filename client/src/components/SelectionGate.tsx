import { useState } from "react";
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
  onSubmitted: () => void;
}

/**
 * Selection Gate UI — Stage 3b
 *
 * User picks:
 * - 3 headlines (one per image) from 6 options OR writes custom
 * - 3 subheadlines (one per image) from 6 options OR writes custom OR picks NONE
 * - 1 background per image from 3 options
 * - Benefits are shared across all 3 images (editable)
 */
export default function SelectionGate({ runId, options, onSubmitted }: SelectionGateProps) {
  // Per-image selections
  const [headlines, setHeadlines] = useState<(string | null)[]>([null, null, null]);
  const [customHeadlines, setCustomHeadlines] = useState<string[]>(["", "", ""]);
  const [useCustomHeadline, setUseCustomHeadline] = useState<boolean[]>([false, false, false]);

  const [subheadlines, setSubheadlines] = useState<(string | null)[]>([null, null, null]);
  const [customSubheadlines, setCustomSubheadlines] = useState<string[]>(["", "", ""]);
  const [useCustomSubheadline, setUseCustomSubheadline] = useState<boolean[]>([false, false, false]);
  const [noSubheadline, setNoSubheadline] = useState<boolean[]>([false, false, false]);

  // Per-image background selection
  const [backgrounds, setBackgrounds] = useState<(number | null)[]>([null, null, null]);

  // Shared benefits
  const [benefits, setBenefits] = useState(options.benefits || "");
  const [useCustomBenefits, setUseCustomBenefits] = useState(false);
  const [customBenefits, setCustomBenefits] = useState("");

  const utils = trpc.useUtils();
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

  function handleSubmit() {
    // Validate
    for (let i = 0; i < 3; i++) {
      const h = getHeadline(i);
      if (!h) {
        toast.error(`Please select or write a headline for ${imageLabels[i]}`);
        return;
      }
      if (backgrounds[i] === null) {
        toast.error(`Please select a background for ${imageLabels[i]}`);
        return;
      }
    }

    const finalBenefits = useCustomBenefits ? customBenefits.trim() : benefits;
    if (!finalBenefits) {
      toast.error("Please provide a benefit callout");
      return;
    }

    const selections = {
      images: [0, 1, 2].map(i => ({
        headline: getHeadline(i)!,
        subheadline: getSubheadline(i),
        background: options.backgrounds[backgrounds[i]!],
      })),
      benefits: finalBenefits,
    };

    submitMutation.mutate({ runId, selections });
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
          Choose headlines, subheadlines, backgrounds, and benefits for your 3 ad variations. You can also write your own.
        </p>
      </div>

      <div className="p-6 space-y-8">
        {/* ============================================================ */}
        {/* SECTION 1: HEADLINES — one per image */}
        {/* ============================================================ */}
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

              {/* AI suggestions */}
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

              {/* Custom toggle */}
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

        {/* ============================================================ */}
        {/* SECTION 2: SUBHEADLINES — one per image, OPTIONAL */}
        {/* ============================================================ */}
        <div>
          <h3 className="text-white font-semibold text-base mb-1 flex items-center gap-2">
            <Type className="w-4 h-4 text-[#0347ED]" />
            Subheadlines <span className="text-gray-500 text-xs font-normal">(optional — pick one per image or none)</span>
          </h3>
          <p className="text-gray-500 text-xs mb-4">Subheadlines are optional. You can select from suggestions, write your own, or choose "No subheadline".</p>

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

              {/* No subheadline toggle */}
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

              {/* AI suggestions */}
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

              {/* Custom input */}
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

        {/* ============================================================ */}
        {/* SECTION 3: BACKGROUNDS — one per image */}
        {/* ============================================================ */}
        <div>
          <h3 className="text-white font-semibold text-base mb-1 flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-[#FF3838]" />
            Background Concepts <span className="text-gray-500 text-xs font-normal">(pick one per image — can vary)</span>
          </h3>
          <p className="text-gray-500 text-xs mb-4">Each image can have a different background. Select one concept per image.</p>

          {[0, 1, 2].map(imgIdx => (
            <div key={imgIdx} className="mb-5 bg-[#01040A] rounded-lg p-4 border border-white/5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-300">{imageLabels[imgIdx]}</span>
                {backgrounds[imgIdx] !== null && (
                  <span className="text-xs text-emerald-400 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Selected
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {options.backgrounds.map((bg, bgIdx) => (
                  <button
                    key={bgIdx}
                    onClick={() => {
                      const next = [...backgrounds];
                      next[imgIdx] = bgIdx;
                      setBackgrounds(next);
                    }}
                    className={`text-left p-4 rounded-lg border transition-all ${
                      backgrounds[imgIdx] === bgIdx
                        ? "border-[#FF3838] bg-[#FF3838]/10"
                        : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
                    }`}
                  >
                    <div className="text-white text-sm font-semibold mb-1">{bg.title}</div>
                    <div className="text-gray-400 text-xs leading-relaxed">{bg.description}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ============================================================ */}
        {/* SECTION 4: BENEFITS — shared across all 3 images */}
        {/* ============================================================ */}
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
                  <span className="text-white text-sm font-medium">★ {benefits} ★</span>
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
                  ← Use AI suggestion instead
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ============================================================ */}
        {/* PREVIEW & SUBMIT */}
        {/* ============================================================ */}
        <div className="bg-[#01040A] rounded-lg p-5 border border-white/10">
          <h3 className="text-white font-semibold text-base mb-4">Preview Your Selections</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {[0, 1, 2].map(i => {
              const h = getHeadline(i);
              const s = getSubheadline(i);
              const bg = backgrounds[i] !== null ? options.backgrounds[backgrounds[i]!] : null;
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
                        {bg?.title || "Not selected"}
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
      </div>
    </div>
  );
}
