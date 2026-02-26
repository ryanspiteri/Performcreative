import { useState } from "react";
import { Edit2, RefreshCw, CheckCircle, Trash2, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface VariationBrief {
  headline: string;
  subheadline: string;
  benefits: string[];
  cta: string;
  visualPrompt: string;
  strategy: string;
  angle: string;
}

interface BriefApprovalProps {
  briefs: VariationBrief[];
  onApprove: (editedBriefs: VariationBrief[]) => void;
  onRegenerate: () => void;
  onCancel: () => void;
  isRegenerating?: boolean;
}

export default function BriefApproval({ briefs, onApprove, onRegenerate, onCancel, isRegenerating }: BriefApprovalProps) {
  const [editedBriefs, setEditedBriefs] = useState<VariationBrief[]>(briefs);
  const [removedIndices, setRemovedIndices] = useState<Set<number>>(new Set());

  const updateBrief = (index: number, field: keyof VariationBrief, value: string | string[]) => {
    setEditedBriefs(prev => {
      const newBriefs = [...prev];
      newBriefs[index] = { ...newBriefs[index], [field]: value };
      return newBriefs;
    });
  };

  const updateBenefit = (briefIndex: number, benefitIndex: number, value: string) => {
    setEditedBriefs(prev => {
      const newBriefs = [...prev];
      const newBenefits = [...newBriefs[briefIndex].benefits];
      newBenefits[benefitIndex] = value;
      newBriefs[briefIndex] = { ...newBriefs[briefIndex], benefits: newBenefits };
      return newBriefs;
    });
  };

  const toggleRemove = (index: number) => {
    setRemovedIndices(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const handleApprove = () => {
    const selectedBriefs = editedBriefs.filter((_, i) => !removedIndices.has(i));
    if (selectedBriefs.length === 0) {
      toast.error("Please select at least one variation to generate");
      return;
    }
    onApprove(selectedBriefs);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Sparkles className="w-8 h-8 text-blue-400" />
            Review & Edit Briefs
          </h1>
          <p className="text-slate-400">
            Review the AI-generated briefs below. Edit headlines, visuals, and benefits before generating images.
          </p>
        </div>

        {/* Brief Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
          {editedBriefs.map((brief, i) => {
            const isRemoved = removedIndices.has(i);
            return (
              <div
                key={i}
                className={`relative border rounded-xl p-6 transition-all ${
                  isRemoved
                    ? "border-red-500/30 bg-red-500/5 opacity-50"
                    : "border-white/10 bg-white/5 hover:border-white/20"
                }`}
              >
                {/* Remove Toggle */}
                <button
                  onClick={() => toggleRemove(i)}
                  className={`absolute top-4 right-4 p-2 rounded-lg transition-colors ${
                    isRemoved
                      ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                      : "bg-white/5 text-slate-400 hover:bg-white/10"
                  }`}
                  title={isRemoved ? "Include this variation" : "Remove this variation"}
                >
                  {isRemoved ? <CheckCircle className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                </button>

                {/* Variation Number */}
                <div className="flex items-center gap-2 mb-4">
                  <div className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-sm font-medium">
                    V{i + 1}
                  </div>
                  <div className="text-xs text-slate-400">{brief.angle}</div>
                </div>

                {/* Headline */}
                <div className="mb-4">
                  <label className="text-xs text-slate-400 mb-1 block">Headline</label>
                  <input
                    type="text"
                    value={brief.headline}
                    onChange={(e) => updateBrief(i, "headline", e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500/50"
                    disabled={isRemoved}
                  />
                </div>

                {/* Subheadline */}
                <div className="mb-4">
                  <label className="text-xs text-slate-400 mb-1 block">Subheadline</label>
                  <input
                    type="text"
                    value={brief.subheadline}
                    onChange={(e) => updateBrief(i, "subheadline", e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500/50"
                    disabled={isRemoved}
                  />
                </div>

                {/* Benefits */}
                <div className="mb-4">
                  <label className="text-xs text-slate-400 mb-1 block">Benefits</label>
                  {brief.benefits.map((benefit, bi) => (
                    <input
                      key={bi}
                      type="text"
                      value={benefit}
                      onChange={(e) => updateBenefit(i, bi, e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs mb-2 focus:outline-none focus:border-blue-500/50"
                      placeholder={`Benefit ${bi + 1}`}
                      disabled={isRemoved}
                    />
                  ))}
                </div>

                {/* Visual Prompt */}
                <div className="mb-4">
                  <label className="text-xs text-slate-400 mb-1 block">Visual Prompt</label>
                  <textarea
                    value={brief.visualPrompt}
                    onChange={(e) => updateBrief(i, "visualPrompt", e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs h-20 focus:outline-none focus:border-blue-500/50 resize-none"
                    disabled={isRemoved}
                  />
                </div>

                {/* Strategy */}
                <div className="text-xs text-slate-500 italic">
                  {brief.strategy}
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-4 bg-white/5 border border-white/10 rounded-xl p-6">
          <div className="flex items-center gap-4">
            <button
              onClick={onCancel}
              className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onRegenerate}
              disabled={isRegenerating}
              className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {isRegenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Regenerating...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Regenerate Briefs
                </>
              )}
            </button>
          </div>

          <button
            onClick={handleApprove}
            className="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
          >
            <CheckCircle className="w-4 h-4" />
            Approve & Generate ({editedBriefs.length - removedIndices.size} variations)
          </button>
        </div>
      </div>
    </div>
  );
}
