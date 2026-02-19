import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Upload,
  Trash2,
  Loader2,
  Palette,
  Image as ImageIcon,
  Filter,
  X,
  Plus,
} from "lucide-react";

const CATEGORIES = ["Dark", "Gradient", "Studio", "Colourful", "Abstract", "Texture", "Minimal"];

export default function Backgrounds() {
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [uploadCategory, setUploadCategory] = useState("Dark");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const backgroundsQuery = trpc.backgrounds.list.useQuery(
    selectedCategory ? { category: selectedCategory } : undefined
  );
  const backgrounds = backgroundsQuery.data || [];

  const uploadMutation = trpc.backgrounds.upload.useMutation({
    onSuccess: () => {
      utils.backgrounds.list.invalidate();
      toast.success("Background uploaded!");
    },
    onError: (err) => toast.error("Upload failed: " + err.message),
  });

  const deleteMutation = trpc.backgrounds.delete.useMutation({
    onMutate: async ({ id }) => {
      await utils.backgrounds.list.cancel();
      const prev = utils.backgrounds.list.getData();
      utils.backgrounds.list.setData(selectedCategory ? { category: selectedCategory } : undefined, (old) =>
        old ? old.filter((bg: any) => bg.id !== id) : []
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) utils.backgrounds.list.setData(selectedCategory ? { category: selectedCategory } : undefined, ctx.prev);
      toast.error("Failed to delete background");
    },
    onSettled: () => utils.backgrounds.list.invalidate(),
  });

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name} is not an image`);
          continue;
        }
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name} exceeds 10MB limit`);
          continue;
        }

        const base64 = await fileToBase64(file);
        const name = file.name.replace(/\.[^/.]+$/, ""); // strip extension
        await uploadMutation.mutateAsync({
          name,
          category: uploadCategory,
          mimeType: file.type,
          base64Data: base64,
        });
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Palette className="w-6 h-6 text-[#FF3838]" />
            Backgrounds
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Upload background images for static ad compositing. These replace AI-generated backgrounds.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Category selector for upload */}
          <select
            value={uploadCategory}
            onChange={(e) => setUploadCategory(e.target.value)}
            className="bg-[#191B1F] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#FF3838]/50"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="bg-[#FF3838] hover:bg-[#FF3838]/90 text-white"
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-2" />
            )}
            Upload Backgrounds
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <Filter className="w-4 h-4 text-gray-500" />
        <button
          onClick={() => setSelectedCategory(undefined)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            !selectedCategory
              ? "bg-[#FF3838] text-white"
              : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
          }`}
        >
          All ({backgrounds.length})
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(selectedCategory === cat ? undefined : cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              selectedCategory === cat
                ? "bg-[#FF3838] text-white"
                : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Gallery Grid */}
      {backgroundsQuery.isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      ) : backgrounds.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <ImageIcon className="w-12 h-12 mb-4 opacity-30" />
          <p className="text-lg font-medium">No backgrounds uploaded yet</p>
          <p className="text-sm mt-1">Upload background images to use in your static ad pipeline.</p>
          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            className="mt-4 border-white/10 text-white hover:bg-white/5"
          >
            <Plus className="w-4 h-4 mr-2" />
            Upload Your First Background
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {backgrounds.map((bg: any) => (
            <div
              key={bg.id}
              className="group relative rounded-xl overflow-hidden border border-white/10 hover:border-white/20 transition-all bg-[#191B1F]"
            >
              <div className="aspect-square">
                <img
                  src={bg.url}
                  alt={bg.name}
                  className="w-full h-full object-cover"
                />
              </div>
              {/* Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              {/* Info */}
              <div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-white text-xs font-medium truncate">{bg.name}</p>
                <span className="inline-block mt-1 text-[10px] font-medium px-2 py-0.5 rounded bg-white/10 text-gray-300">
                  {bg.category}
                </span>
              </div>
              {/* Category badge (always visible) */}
              <div className="absolute top-2 left-2">
                <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-black/60 text-gray-300 backdrop-blur-sm">
                  {bg.category}
                </span>
              </div>
              {/* Delete button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm("Delete this background?")) {
                    deleteMutation.mutate({ id: bg.id });
                  }
                }}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500/80 hover:bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]); // strip data:...;base64, prefix
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
