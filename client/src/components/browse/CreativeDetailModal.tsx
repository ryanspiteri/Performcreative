import { useEffect, useRef, useState } from "react";
import { X, Play, Image as ImageIcon, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Creative } from "../../../../shared/pipeline";

interface CreativeDetailModalProps {
  creative: Creative;
  onClose: () => void;
  onRunPipeline: () => void;
}

export function CreativeDetailModal({ creative, onClose, onRunPipeline }: CreativeDetailModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [showTranscription, setShowTranscription] = useState(false);
  const [showDescription, setShowDescription] = useState(false);

  // Focus trap + Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    dialogRef.current?.focus();
    // Prevent body scroll
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const scoreColor = creative.qualityScore != null
    ? creative.qualityScore >= 7 ? "text-emerald-400 border-emerald-500"
    : creative.qualityScore >= 4 ? "text-amber-400 border-amber-500"
    : "text-red-400 border-red-500"
    : "text-gray-500 border-gray-700";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${creative.type} ad detail: ${creative.title}`}
        tabIndex={-1}
        className="relative bg-[#191B1F] border border-white/10 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto mx-4 lg:mx-0 focus:outline-none"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/50 hover:bg-black/80 text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Media Area */}
        <div className="relative bg-[#01040A] aspect-video flex items-center justify-center overflow-hidden rounded-t-xl">
          {creative.type === "VIDEO" && creative.mediaUrl ? (
            <video
              src={creative.mediaUrl}
              controls
              className="w-full h-full object-contain"
              poster={creative.thumbnailUrl}
            />
          ) : creative.type === "VIDEO" && creative.thumbnailUrl ? (
            <>
              <img src={creative.thumbnailUrl} alt={creative.title} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                <Play className="w-12 h-12 text-white fill-white" />
              </div>
            </>
          ) : (creative.imageUrl || creative.thumbnailUrl) ? (
            <img src={creative.imageUrl || creative.thumbnailUrl} alt={creative.title} className="w-full h-full object-contain" />
          ) : (
            <div className="flex flex-col items-center text-gray-500">
              {creative.type === "VIDEO" ? <Play className="w-12 h-12 mb-2" /> : <ImageIcon className="w-12 h-12 mb-2" />}
              <p className="text-sm">No preview available</p>
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="p-6 space-y-4">
          {/* AI Insights + Metadata — two columns on desktop, stacked on mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* AI Insights */}
            <div className="space-y-3">
              {creative.qualityScore != null && (
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center text-lg font-bold ${scoreColor}`}>
                    {creative.qualityScore}
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Quality Score</p>
                    <p className="text-sm text-white font-medium">
                      {creative.qualityScore >= 7 ? "Strong" : creative.qualityScore >= 4 ? "Average" : "Weak"}
                    </p>
                  </div>
                </div>
              )}
              {creative.summary && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">AI Summary</p>
                  <p className="text-sm text-emerald-300 bg-emerald-500/10 rounded-lg px-3 py-2">{creative.summary}</p>
                </div>
              )}
            </div>

            {/* Metadata */}
            <div className="space-y-2">
              <div>
                <p className="text-xs text-gray-400">Brand</p>
                <p className="text-sm text-white font-medium">{creative.brandName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Type</p>
                <span className={`text-xs font-bold px-2 py-1 rounded ${
                  creative.type === "VIDEO" ? "bg-blue-900/50 text-blue-300" : "bg-purple-900/50 text-purple-300"
                }`}>
                  {creative.type}
                </span>
              </div>
              <div>
                <p className="text-xs text-gray-400">Title</p>
                <p className="text-sm text-white">{creative.title}</p>
              </div>
            </div>
          </div>

          {/* Expandable sections */}
          {creative.summary && (
            <>
              <button
                onClick={() => setShowTranscription(!showTranscription)}
                className="flex items-center gap-2 text-xs text-gray-400 hover:text-white transition-colors w-full"
              >
                {showTranscription ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                Transcription
              </button>
              {showTranscription && (
                <p className="text-xs text-gray-500 bg-[#0F1117] rounded-lg p-3 max-h-40 overflow-y-auto">
                  {/* Transcription would come from a separate fetch if needed */}
                  Transcription data available after pipeline analysis.
                </p>
              )}

              <button
                onClick={() => setShowDescription(!showDescription)}
                className="flex items-center gap-2 text-xs text-gray-400 hover:text-white transition-colors w-full"
              >
                {showDescription ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                Ad Description
              </button>
              {showDescription && (
                <p className="text-xs text-gray-500 bg-[#0F1117] rounded-lg p-3 max-h-40 overflow-y-auto">
                  Description available after pipeline analysis.
                </p>
              )}
            </>
          )}

          {/* Action Bar */}
          <div className="flex gap-3 pt-2 border-t border-white/5">
            <Button
              onClick={() => { onRunPipeline(); onClose(); }}
              className="flex-1 bg-[#FF3838] hover:bg-[#FF3838]/90 text-white"
            >
              Run Pipeline
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
