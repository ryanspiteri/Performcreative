import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  AlertCircle,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
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

type PlatformTab = "instagram" | "tiktok" | "linkedin";

type BatchRow = {
  topic: string;
  pillar: string;
  purpose: string;
};

type BatchResult = {
  status: "pending" | "running" | "done" | "error";
  captions?: Record<string, string>;
  error?: string;
};

export default function CaptionGenerator() {
  // Mode
  const [batchMode, setBatchMode] = useState(false);

  // Single mode state
  const [pillar, setPillar] = useState("");
  const [purpose, setPurpose] = useState("");
  const [topic, setTopic] = useState("");
  const [context, setContext] = useState("");
  const [captionTab, setCaptionTab] = useState<PlatformTab>("instagram");
  const [captions, setCaptions] = useState<Record<string, string> | null>(null);

  // Batch mode state
  const [batchRows, setBatchRows] = useState<BatchRow[]>([
    { topic: "", pillar: "", purpose: "" },
  ]);
  const [batchResults, setBatchResults] = useState<BatchResult[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 });

  // Single caption mutation
  const generateCaption = trpc.organic.generateCaption.useMutation({
    onSuccess: (data: any) => {
      setCaptions(data.captions as Record<string, string>);
      toast.success("Captions generated");
    },
    onError: (err: any) => {
      toast.error(`Failed to generate: ${err.message}`);
    },
  });

  // Batch mutation
  const generateBatchCaptions = trpc.organic.generateBatchCaptions.useMutation();

  const handleGenerateSingle = () => {
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

    generateCaption.mutate({
      pillar,
      purpose,
      topic: topic.trim(),
      context: context.trim() || undefined,
    });
  };

  const handleGenerateBatch = async () => {
    const validRows = batchRows.filter(
      (r) => r.topic.trim() && r.pillar && r.purpose
    );
    if (validRows.length === 0) {
      toast.error("Please fill in at least one complete row");
      return;
    }

    setBatchRunning(true);
    setBatchProgress({ done: 0, total: validRows.length });
    setBatchResults(validRows.map(() => ({ status: "pending" })));

    for (let i = 0; i < validRows.length; i++) {
      setBatchResults((prev) => {
        const next = [...prev];
        next[i] = { status: "running" };
        return next;
      });

      try {
        const result = await generateBatchCaptions.mutateAsync({
          items: [validRows[i]],
        });
        setBatchResults((prev) => {
          const next = [...prev];
          next[i] = {
            status: "done",
            captions: ((result as any)?.[0] as Record<string, string>) || {},
          };
          return next;
        });
      } catch (err: any) {
        setBatchResults((prev) => {
          const next = [...prev];
          next[i] = { status: "error", error: err.message };
          return next;
        });
      }

      setBatchProgress((prev) => ({ ...prev, done: i + 1 }));
    }

    setBatchRunning(false);
    toast.success(`Batch complete: ${validRows.length} captions generated`);
  };

  const addBatchRow = () => {
    setBatchRows((prev) => [...prev, { topic: "", pillar: "", purpose: "" }]);
  };

  const removeBatchRow = (idx: number) => {
    if (batchRows.length <= 1) return;
    setBatchRows((prev) => prev.filter((_, i) => i !== idx));
    setBatchResults((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateBatchRow = (idx: number, field: keyof BatchRow, value: string) => {
    setBatchRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} caption copied`);
  };

  return (
    <div className="min-h-screen bg-[#01040A]">
      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Caption Generator</h1>
            <p className="text-gray-400 text-sm">
              Generate platform-optimized captions for organic content
            </p>
          </div>
          <button
            onClick={() => setBatchMode(!batchMode)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              batchMode
                ? "bg-[#FF3838]/20 text-[#FF3838] border border-[#FF3838]/30"
                : "bg-white/5 text-gray-400 border border-white/10 hover:text-white hover:bg-white/10"
            }`}
          >
            {batchMode ? (
              <ToggleRight className="w-4 h-4" />
            ) : (
              <ToggleLeft className="w-4 h-4" />
            )}
            Batch Mode
          </button>
        </div>

        {!batchMode ? (
          /* ── SINGLE MODE ── */
          <div className="space-y-5">
            <div className="bg-[#0D0F12] rounded-xl border border-white/5 p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
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

              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">
                  Context <span className="text-gray-600">(optional)</span>
                </label>
                <Textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="Any additional context, talking points, or angle..."
                  rows={3}
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 text-sm"
                />
              </div>

              <Button
                onClick={handleGenerateSingle}
                disabled={generateCaption.isPending}
                className="w-full h-11 bg-[#FF3838] hover:bg-[#FF3838]/90 text-white font-semibold"
              >
                {generateCaption.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate Caption"
                )}
              </Button>
            </div>

            {/* Output */}
            {captions && (
              <div className="bg-[#0D0F12] rounded-xl border border-white/5 p-5 space-y-4">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Generated Captions
                </p>

                <div className="flex gap-1 mb-3">
                  {(["instagram", "tiktok", "linkedin"] as PlatformTab[]).map((platform) => (
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
                  ))}
                </div>

                <div className="bg-white/5 rounded-lg p-4">
                  <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                    {captions[captionTab] || "No caption for this platform"}
                  </p>
                  <div className="mt-3 flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCopy(captions[captionTab] || "", captionTab)}
                      className="text-gray-400 hover:text-white"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Copy
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-gray-400 hover:text-white"
                    >
                      <BookmarkPlus className="w-3.5 h-3.5" />
                      Save to Library
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ── BATCH MODE ── */
          <div className="space-y-5">
            <div className="bg-[#0D0F12] rounded-xl border border-white/5 p-5 space-y-4">
              {/* Table Header */}
              <div className="grid grid-cols-[40px_1fr_160px_140px_40px] gap-3 px-1">
                <span className="text-xs font-medium text-gray-600">#</span>
                <span className="text-xs font-medium text-gray-600">Topic</span>
                <span className="text-xs font-medium text-gray-600">Pillar</span>
                <span className="text-xs font-medium text-gray-600">Purpose</span>
                <span />
              </div>

              {/* Rows */}
              {batchRows.map((row, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-[40px_1fr_160px_140px_40px] gap-3 items-center"
                >
                  <span className="text-xs text-gray-600 text-center">{idx + 1}</span>
                  <Input
                    value={row.topic}
                    onChange={(e) => updateBatchRow(idx, "topic", e.target.value)}
                    placeholder="Topic..."
                    className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 text-sm"
                  />
                  <Select
                    value={row.pillar}
                    onValueChange={(v) => updateBatchRow(idx, "pillar", v)}
                  >
                    <SelectTrigger className="w-full bg-white/5 border-white/10 text-white text-sm">
                      <SelectValue placeholder="Pillar" />
                    </SelectTrigger>
                    <SelectContent>
                      {PILLARS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={row.purpose}
                    onValueChange={(v) => updateBatchRow(idx, "purpose", v)}
                  >
                    <SelectTrigger className="w-full bg-white/5 border-white/10 text-white text-sm">
                      <SelectValue placeholder="Purpose" />
                    </SelectTrigger>
                    <SelectContent>
                      {PURPOSES.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button
                    onClick={() => removeBatchRow(idx)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    disabled={batchRows.length <= 1}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              <div className="flex items-center gap-3 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={addBatchRow}
                  className="border-white/10 text-gray-400 hover:text-white hover:bg-white/5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Row
                </Button>
              </div>

              <Button
                onClick={handleGenerateBatch}
                disabled={batchRunning}
                className="w-full h-11 bg-[#FF3838] hover:bg-[#FF3838]/90 text-white font-semibold"
              >
                {batchRunning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating {batchProgress.done}/{batchProgress.total}...
                  </>
                ) : (
                  "Generate All"
                )}
              </Button>
            </div>

            {/* Batch Results */}
            {batchResults.length > 0 && (
              <div className="space-y-3">
                {batchResults.map((result, idx) => (
                  <div
                    key={idx}
                    className="bg-[#0D0F12] rounded-xl border border-white/5 p-4"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs text-gray-600 w-6">{idx + 1}</span>
                      <span className="text-sm text-white flex-1 truncate">
                        {batchRows[idx]?.topic || "Untitled"}
                      </span>
                      {result.status === "running" && (
                        <Loader2 className="w-4 h-4 text-[#FF3838] animate-spin" />
                      )}
                      {result.status === "done" && (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      )}
                      {result.status === "error" && (
                        <AlertCircle className="w-4 h-4 text-red-400" />
                      )}
                      {result.status === "pending" && (
                        <span className="w-2 h-2 rounded-full bg-gray-600" />
                      )}
                    </div>

                    {result.status === "error" && (
                      <p className="text-xs text-red-400 mt-1 ml-9">{result.error}</p>
                    )}

                    {result.status === "done" && result.captions && (
                      <div className="ml-9 mt-2 space-y-2">
                        {(["instagram", "tiktok", "linkedin"] as PlatformTab[]).map(
                          (platform) => (
                            <div
                              key={platform}
                              className="flex items-start gap-2"
                            >
                              <span className="text-[10px] uppercase font-medium text-gray-600 w-16 pt-1 shrink-0">
                                {platform}
                              </span>
                              <p className="text-xs text-gray-400 flex-1 line-clamp-2">
                                {result.captions![platform] || "-"}
                              </p>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  handleCopy(
                                    result.captions![platform] || "",
                                    platform
                                  )
                                }
                                className="shrink-0 text-gray-600 hover:text-white h-6 w-6 p-0"
                              >
                                <Copy className="w-3 h-3" />
                              </Button>
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
