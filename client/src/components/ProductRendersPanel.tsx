import { useState, useRef, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Upload, Trash2, Image as ImageIcon, Loader2, Pencil, Check, X } from "lucide-react";

interface ProductRendersPanelProps {
  selectedProduct: string;
}

export default function ProductRendersPanel({ selectedProduct }: ProductRendersPanelProps) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();

  const rendersQuery = trpc.renders.list.useQuery({ product: selectedProduct });
  const allRendersQuery = trpc.renders.list.useQuery();

  const uploadMutation = trpc.renders.upload.useMutation({
    onSuccess: () => {
      toast.success("Render uploaded successfully!");
      utils.renders.list.invalidate();
      setPreviewUrl(null);
    },
    onError: (err) => {
      toast.error("Upload failed: " + err.message);
    },
    onSettled: () => setUploading(false),
  });

  const deleteMutation = trpc.renders.delete.useMutation({
    onSuccess: () => {
      toast.success("Render deleted");
      utils.renders.list.invalidate();
    },
    onError: (err) => {
      toast.error("Delete failed: " + err.message);
    },
  });

  const updateMutation = trpc.renders.update.useMutation({
    onSuccess: () => {
      toast.success("Render updated");
      utils.renders.list.invalidate();
      setEditingId(null);
    },
    onError: (err) => {
      toast.error("Update failed: " + err.message);
    },
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editTags, setEditTags] = useState("");

  useEffect(() => {
    setEditingId(null);
  }, [selectedProduct]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file (PNG, JPG, WebP)");
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      toast.error("File too large. Maximum size is 20MB.");
      return;
    }

    setUploading(true);

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      setPreviewUrl(reader.result as string);

      uploadMutation.mutate({
        product: selectedProduct,
        fileName: file.name,
        mimeType: file.type,
        base64Data: base64,
      });
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [selectedProduct, uploadMutation]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      const input = fileInputRef.current;
      if (input) {
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
  }, []);

  return (
    <div className="bg-[#191B1F] border border-white/5 rounded-xl p-6">
      <h3 className="text-lg font-bold text-white mb-4">
        {selectedProduct} Renders
      </h3>
      <p className="text-xs text-gray-400 mb-6">
        Upload product render images for <span className="text-[#FF3838] font-semibold">{selectedProduct}</span>.
        PNG with transparent background recommended. The pipeline uses these for static ad compositing.
      </p>

      {/* Upload Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-white/10 hover:border-[#FF3838]/50 rounded-xl p-8 text-center cursor-pointer transition-all hover:bg-[#FF3838]/5 mb-6"
      >
        {uploading ? (
          <div className="flex flex-col items-center">
            <Loader2 className="w-10 h-10 text-[#FF3838] animate-spin mb-3" />
            <p className="text-sm text-gray-300">Uploading...</p>
          </div>
        ) : previewUrl ? (
          <div className="flex flex-col items-center">
            <img src={previewUrl} alt="Preview" className="w-24 h-24 object-contain mb-3 rounded" />
            <p className="text-sm text-emerald-400">Upload complete!</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <Upload className="w-10 h-10 text-gray-500 mb-3" />
            <p className="text-sm text-gray-300 mb-1">Drop image here or click to browse</p>
            <p className="text-xs text-gray-500">PNG, JPG, WebP — Max 20MB</p>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Render Gallery */}
      {rendersQuery.isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 animate-spin text-[#FF3838]" />
        </div>
      ) : !rendersQuery.data || rendersQuery.data.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-gray-500">
          <ImageIcon className="w-12 h-12 mb-3" />
          <p className="text-sm">No renders uploaded for {selectedProduct}</p>
          <p className="text-xs mt-1">Upload product render images to use in the pipeline</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {rendersQuery.data.map((render) => {
            const isEditing = editingId === render.id;
            const tagList = (render.tags || "")
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean);
            return (
              <div
                key={render.id}
                className="group relative bg-[#0F1117] rounded-lg overflow-hidden border border-white/5 hover:border-white/20 transition-all"
              >
                <div className="aspect-square bg-[#01040A] flex items-center justify-center p-4">
                  <img
                    src={render.url}
                    alt={render.fileName}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="p-3">
                  {isEditing ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Name"
                        className="w-full bg-[#01040A] border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-[#FF3838]/50"
                      />
                      <input
                        type="text"
                        value={editTags}
                        onChange={(e) => setEditTags(e.target.value)}
                        placeholder="Tags (comma separated)"
                        className="w-full bg-[#01040A] border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-[#FF3838]/50"
                      />
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const trimmedName = editName.trim();
                            if (!trimmedName) {
                              toast.error("Name can't be empty");
                              return;
                            }
                            updateMutation.mutate({
                              id: render.id,
                              fileName: trimmedName,
                              tags: editTags.trim() ? editTags.trim() : null,
                            });
                          }}
                          disabled={updateMutation.isPending}
                          className="flex-1 flex items-center justify-center gap-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-xs py-1 rounded disabled:opacity-50"
                        >
                          <Check className="w-3 h-3" /> Save
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingId(null);
                          }}
                          className="flex-1 flex items-center justify-center gap-1 bg-white/5 hover:bg-white/10 text-gray-400 text-xs py-1 rounded"
                        >
                          <X className="w-3 h-3" /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-white truncate font-medium">{render.fileName}</p>
                      {tagList.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {tagList.map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] bg-[#FF3838]/15 text-[#FF6B6B] px-1.5 py-0.5 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        {render.fileSize ? `${(render.fileSize / 1024).toFixed(0)} KB` : "—"}
                      </p>
                    </>
                  )}
                </div>
                {!isEditing && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(render.id);
                        setEditName(render.fileName);
                        setEditTags(render.tags || "");
                      }}
                      className="absolute top-2 right-10 p-1.5 bg-blue-500/80 hover:bg-blue-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Edit name & tags"
                    >
                      <Pencil className="w-3.5 h-3.5 text-white" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm("Delete this render?")) {
                          deleteMutation.mutate({ id: render.id });
                        }
                      }}
                      className="absolute top-2 right-2 p-1.5 bg-red-500/80 hover:bg-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-white" />
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Stats */}
      <div className="mt-6 pt-4 border-t border-white/5 flex gap-6">
        <div className="flex justify-between text-sm gap-2">
          <span className="text-gray-400">Renders for {selectedProduct}</span>
          <span className="text-white font-bold">{rendersQuery.data?.length || 0}</span>
        </div>
        <div className="flex justify-between text-sm gap-2">
          <span className="text-gray-400">Total renders</span>
          <span className="text-white font-bold">{allRendersQuery.data?.length || 0}</span>
        </div>
      </div>
    </div>
  );
}
