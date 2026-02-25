import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";

interface ChildGenerationControlsProps {
  parentRunId: number;
}

export function ChildGenerationControls({ parentRunId }: ChildGenerationControlsProps) {
  const [childCount, setChildCount] = useState(5);
  const utils = trpc.useUtils();

  const generateChildren = trpc.pipeline.generateChildren.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      utils.pipeline.list.invalidate();
    },
    onError: (err) => {
      toast.error(`Failed to generate children: ${err.message}`);
    },
  });

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-400">Children per parent:</label>
        <select
          value={childCount}
          onChange={(e) => setChildCount(Number(e.target.value))}
          disabled={generateChildren.isPending}
          className="bg-[#01040A] border border-white/10 rounded-lg px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          <option value={5}>5 variations</option>
          <option value={10}>10 variations</option>
        </select>
      </div>

      <button
        onClick={() => generateChildren.mutate({ parentRunIds: [parentRunId], childCount })}
        disabled={generateChildren.isPending}
        className="flex items-center gap-2 bg-[#FF3838] hover:bg-[#FF3838]/80 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
      >
        {generateChildren.isPending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Generating {childCount} children...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            Generate {childCount} Children
          </>
        )}
      </button>
    </div>
  );
}
