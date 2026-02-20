import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  TestTube2,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Info,
  Layers,
  Image as ImageIcon,
  Type,
  ExternalLink,
  Copy,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ArrowRight,
} from "lucide-react";

// Canonical layer names the pipeline uses internally
const CANONICAL_LAYERS = [
  { name: "background", type: "image", description: "Full-canvas background image (from Flux Pro or uploaded)" },
  { name: "product_image", type: "image", description: "Product render PNG with transparency" },
  { name: "logo", type: "image", description: "ONEST brand logo" },
  { name: "headline", type: "text", description: "Main headline text (e.g., 'BURN FAT FASTER')" },
  { name: "subheadline", type: "text", description: "Supporting text below headline (optional)" },
  { name: "benefit_callout", type: "text", description: "Benefit text (e.g., 'Energy & Focus | Suppress Appetite')" },
];

interface LayerMapping {
  headline?: string;
  subheadline?: string;
  benefit_callout?: string;
  background?: string;
  product_image?: string;
  logo?: string;
  [key: string]: string | undefined;
}

export default function TemplateTester() {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [showCustomInputs, setShowCustomInputs] = useState(false);
  const [customHeadline, setCustomHeadline] = useState("");
  const [customSubheadline, setCustomSubheadline] = useState("");
  const [customBenefits, setCustomBenefits] = useState("");
  const [previewResult, setPreviewResult] = useState<{
    imageUrl: string;
    validation: {
      valid: boolean;
      templateLayers: string[];
      matchedLayers: string[];
      missingFromTemplate: string[];
      extraInTemplate: string[];
      warnings: string[];
    };
  } | null>(null);

  const { data: templates, isLoading: loadingTemplates } = trpc.pipeline.getBannerbearTemplates.useQuery();

  const previewMutation = trpc.pipeline.previewBannerbearTemplate.useMutation({
    onSuccess: (result) => {
      setPreviewResult(result);
      if (result.validation.valid) {
        toast.success("Template test successful! All layers matched.");
      } else {
        toast.warning("Template generated but some layers are missing. Check the validation report below.");
      }
    },
    onError: (err) => {
      toast.error(`Preview failed: ${err.message}`);
    },
  });

  function handleTestTemplate(templateUid: string) {
    setSelectedTemplate(templateUid);
    setPreviewResult(null);

    previewMutation.mutate({
      templateUid,
      headline: customHeadline || undefined,
      subheadline: customSubheadline || undefined,
      benefitCallout: customBenefits || undefined,
    });
  }

  /**
   * Check if a canonical layer is satisfied by the template's actual layers,
   * using the layer mapping if available.
   */
  function isLayerMapped(
    canonicalName: string,
    templateLayers: string[],
    mapping: LayerMapping | null | undefined
  ): { mapped: boolean; actualName: string | null } {
    // First check if there's an explicit mapping
    if (mapping && mapping[canonicalName]) {
      const actualName = mapping[canonicalName]!;
      const found = templateLayers.some(l => l.toLowerCase() === actualName.toLowerCase());
      return { mapped: found, actualName: found ? actualName : null };
    }

    // Fall back to direct name match
    const directMatch = templateLayers.find(l => l.toLowerCase() === canonicalName.toLowerCase());
    if (directMatch) {
      return { mapped: true, actualName: directMatch };
    }

    return { mapped: false, actualName: null };
  }

  const selectedTemplateInfo = templates?.find(t => t.uid === selectedTemplate);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <TestTube2 className="w-7 h-7 text-[#FF3838]" />
          Bannerbear Template Tester
        </h1>
        <p className="text-gray-400 mt-2">
          Test your Bannerbear templates with dummy data before running a full pipeline.
          The system automatically maps your layer names to the pipeline's internal names.
        </p>
      </div>

      {/* Layer Mapping Reference */}
      <div className="bg-[#191B1F] border border-white/10 rounded-xl p-5 mb-6">
        <h2 className="text-white font-semibold text-sm flex items-center gap-2 mb-3">
          <Layers className="w-4 h-4 text-[#0347ED]" />
          Pipeline Layer Requirements
        </h2>
        <p className="text-gray-400 text-xs mb-3">
          The pipeline needs these layers. Your template can use different names — the system maps them automatically.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {CANONICAL_LAYERS.map((layer) => (
            <div key={layer.name} className="bg-[#0D0F12] rounded-lg p-3 border border-white/5">
              <div className="flex items-center gap-2 mb-1">
                {layer.type === "image" ? (
                  <ImageIcon className="w-3.5 h-3.5 text-[#FF3838]" />
                ) : (
                  <Type className="w-3.5 h-3.5 text-[#0347ED]" />
                )}
                <code className="text-white text-xs font-mono bg-white/5 px-1.5 py-0.5 rounded">{layer.name}</code>
                <span className="text-[10px] text-gray-500 uppercase">{layer.type}</span>
              </div>
              <p className="text-gray-500 text-[11px]">{layer.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Custom Test Inputs */}
      <div className="bg-[#191B1F] border border-white/10 rounded-xl p-5 mb-6">
        <button
          onClick={() => setShowCustomInputs(!showCustomInputs)}
          className="flex items-center gap-2 text-white font-semibold text-sm w-full"
        >
          <Type className="w-4 h-4 text-[#FF3838]" />
          Custom Test Content
          {showCustomInputs ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
        </button>
        <p className="text-gray-500 text-xs mt-1">Optional — leave blank to use default dummy text</p>

        {showCustomInputs && (
          <div className="mt-4 space-y-3">
            <div>
              <label className="text-gray-400 text-xs block mb-1">Headline</label>
              <input
                type="text"
                value={customHeadline}
                onChange={(e) => setCustomHeadline(e.target.value)}
                placeholder="BURN FAT FASTER"
                className="w-full bg-[#0D0F12] border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-gray-600"
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs block mb-1">Subheadline</label>
              <input
                type="text"
                value={customSubheadline}
                onChange={(e) => setCustomSubheadline(e.target.value)}
                placeholder="Premium Australian Formulation"
                className="w-full bg-[#0D0F12] border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-gray-600"
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs block mb-1">Benefit Callout</label>
              <input
                type="text"
                value={customBenefits}
                onChange={(e) => setCustomBenefits(e.target.value)}
                placeholder="Energy & Focus | Suppress Appetite | Boost Metabolism"
                className="w-full bg-[#0D0F12] border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-gray-600"
              />
            </div>
          </div>
        )}
      </div>

      {/* Templates List */}
      <div className="mb-6">
        <h2 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#FF3838]" />
          Your Bannerbear Templates
        </h2>

        {loadingTemplates ? (
          <div className="flex items-center gap-2 text-gray-400 py-8 justify-center">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading templates from Bannerbear...
          </div>
        ) : !templates || templates.length === 0 ? (
          <div className="bg-[#191B1F] border border-white/10 rounded-xl p-8 text-center">
            <p className="text-gray-400">No templates found in your Bannerbear project.</p>
            <p className="text-gray-500 text-sm mt-2">Create templates at bannerbear.com, then they'll appear here automatically.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map((template) => {
              const isSelected = selectedTemplate === template.uid;
              const mapping = (template.layerMapping || null) as LayerMapping | null;

              // Check each canonical layer using the mapping
              const layerStatus = CANONICAL_LAYERS.map(cl => ({
                ...cl,
                ...isLayerMapped(cl.name, template.layers, mapping),
              }));

              const requiredLayers = layerStatus.filter(l => l.name !== "subheadline"); // subheadline is optional
              const allRequiredMapped = requiredLayers.every(l => l.mapped);
              const missingRequired = requiredLayers.filter(l => !l.mapped);

              return (
                <div
                  key={template.uid}
                  className={`bg-[#191B1F] border rounded-xl p-4 transition-colors ${
                    isSelected ? "border-[#FF3838]/50" : "border-white/10 hover:border-white/20"
                  }`}
                >
                  {/* Template Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-white font-semibold text-sm">{template.name}</h3>
                      <p className="text-gray-500 text-xs mt-0.5">
                        {template.width}x{template.height} &middot; UID: {template.uid}
                      </p>
                    </div>
                    {allRequiredMapped ? (
                      <span className="flex items-center gap-1 text-green-400 text-xs bg-green-400/10 px-2 py-1 rounded-full">
                        <CheckCircle className="w-3 h-3" />
                        Ready
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-amber-400 text-xs bg-amber-400/10 px-2 py-1 rounded-full">
                        <AlertTriangle className="w-3 h-3" />
                        Missing layers
                      </span>
                    )}
                  </div>

                  {/* Preview Image */}
                  {template.previewUrl && (
                    <div className="mb-3 rounded-lg overflow-hidden bg-[#0D0F12] aspect-square max-h-48">
                      <img
                        src={template.previewUrl}
                        alt={template.name}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  )}

                  {/* Layer Mapping Status */}
                  <div className="mb-3">
                    <p className="text-gray-400 text-xs font-semibold mb-2">Layer Mapping:</p>
                    <div className="space-y-1">
                      {layerStatus.map((layer) => (
                        <div
                          key={layer.name}
                          className={`flex items-center gap-2 text-[11px] font-mono px-2 py-1 rounded ${
                            layer.mapped
                              ? "bg-green-400/5 border border-green-400/15"
                              : layer.name === "subheadline"
                              ? "bg-gray-500/5 border border-gray-500/15"
                              : "bg-red-400/5 border border-red-400/15"
                          }`}
                        >
                          {layer.mapped ? (
                            <CheckCircle className="w-3 h-3 text-green-400 shrink-0" />
                          ) : layer.name === "subheadline" ? (
                            <Info className="w-3 h-3 text-gray-500 shrink-0" />
                          ) : (
                            <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />
                          )}
                          <span className={layer.mapped ? "text-green-400" : layer.name === "subheadline" ? "text-gray-500" : "text-red-400"}>
                            {layer.name}
                          </span>
                          {layer.mapped && layer.actualName && layer.actualName !== layer.name && (
                            <>
                              <ArrowRight className="w-3 h-3 text-gray-600 shrink-0" />
                              <span className="text-gray-300">{layer.actualName}</span>
                            </>
                          )}
                          {layer.mapped && layer.actualName && layer.actualName === layer.name && (
                            <span className="text-gray-600 ml-auto">direct match</span>
                          )}
                          {!layer.mapped && layer.name === "subheadline" && (
                            <span className="text-gray-600 ml-auto">optional</span>
                          )}
                          {!layer.mapped && layer.name !== "subheadline" && (
                            <span className="text-red-400/60 ml-auto">not found</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Missing Layers Warning */}
                  {missingRequired.length > 0 && (
                    <div className="bg-amber-400/5 border border-amber-400/20 rounded-lg p-2.5 mb-3">
                      <p className="text-amber-400 text-xs font-semibold flex items-center gap-1 mb-1">
                        <AlertTriangle className="w-3 h-3" />
                        Missing required layers:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {missingRequired.map((layer) => (
                          <span key={layer.name} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-400/10 text-red-400 border border-red-400/20">
                            {layer.name} ({layer.type})
                          </span>
                        ))}
                      </div>
                      <p className="text-amber-400/70 text-[10px] mt-1.5">
                        Add matching layers in Bannerbear, or update the layer mapping in settings.
                      </p>
                    </div>
                  )}

                  {/* All Layers Info */}
                  <div className="bg-blue-400/5 border border-blue-400/20 rounded-lg p-2.5 mb-3">
                    <p className="text-blue-400 text-xs flex items-center gap-1 mb-1">
                      <Info className="w-3 h-3" />
                      Template layers ({template.layers.length}):
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {template.layers.map((l) => (
                        <span key={l} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-400/10 text-blue-300 border border-blue-400/20">
                          {l}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Test Button */}
                  <Button
                    onClick={() => handleTestTemplate(template.uid)}
                    disabled={previewMutation.isPending}
                    className="w-full bg-[#FF3838] hover:bg-[#FF3838]/80 text-white"
                    size="sm"
                  >
                    {previewMutation.isPending && selectedTemplate === template.uid ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Generating test image...
                      </>
                    ) : (
                      <>
                        <TestTube2 className="w-4 h-4 mr-2" />
                        Test This Template
                      </>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Preview Result */}
      {previewResult && (
        <div className="bg-[#191B1F] border border-white/10 rounded-xl p-5">
          <h2 className="text-white font-semibold text-sm flex items-center gap-2 mb-4">
            <ImageIcon className="w-4 h-4 text-[#FF3838]" />
            Test Result
            {selectedTemplateInfo && (
              <span className="text-gray-500 font-normal">— {selectedTemplateInfo.name}</span>
            )}
          </h2>

          {/* Validation Report */}
          <div className={`rounded-lg p-4 mb-4 border ${
            previewResult.validation.valid
              ? "bg-green-400/5 border-green-400/20"
              : "bg-amber-400/5 border-amber-400/20"
          }`}>
            <div className="flex items-center gap-2 mb-2">
              {previewResult.validation.valid ? (
                <>
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <span className="text-green-400 font-semibold text-sm">All layers matched!</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                  <span className="text-amber-400 font-semibold text-sm">Some layers are missing</span>
                </>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-gray-400 font-semibold mb-1">Matched Layers:</p>
                <div className="flex flex-wrap gap-1">
                  {previewResult.validation.matchedLayers.map(l => (
                    <span key={l} className="font-mono px-1.5 py-0.5 rounded bg-green-400/10 text-green-400">{l}</span>
                  ))}
                  {previewResult.validation.matchedLayers.length === 0 && (
                    <span className="text-gray-500">None</span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-gray-400 font-semibold mb-1">Missing from Template:</p>
                <div className="flex flex-wrap gap-1">
                  {previewResult.validation.missingFromTemplate.map(l => (
                    <span key={l} className="font-mono px-1.5 py-0.5 rounded bg-red-400/10 text-red-400">{l}</span>
                  ))}
                  {previewResult.validation.missingFromTemplate.length === 0 && (
                    <span className="text-green-400">None — all good!</span>
                  )}
                </div>
              </div>
            </div>

            {previewResult.validation.warnings.length > 0 && (
              <div className="mt-3 space-y-1">
                {previewResult.validation.warnings.map((w, i) => (
                  <p key={i} className="text-amber-400/80 text-xs">{w}</p>
                ))}
              </div>
            )}
          </div>

          {/* Generated Image */}
          <div className="rounded-lg overflow-hidden bg-[#0D0F12] mb-3">
            <img
              src={previewResult.imageUrl}
              alt="Template preview"
              className="w-full max-w-lg mx-auto"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-white/10 text-gray-300"
              onClick={() => {
                navigator.clipboard.writeText(previewResult.imageUrl);
                toast.success("Image URL copied!");
              }}
            >
              <Copy className="w-3.5 h-3.5 mr-1.5" />
              Copy URL
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-white/10 text-gray-300"
              onClick={() => window.open(previewResult.imageUrl, "_blank")}
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
              Open Full Size
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-white/10 text-gray-300"
              onClick={() => selectedTemplate && handleTestTemplate(selectedTemplate)}
              disabled={previewMutation.isPending}
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Re-test
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
