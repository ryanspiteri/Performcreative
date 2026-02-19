import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Upload, Trash2, Image as ImageIcon, Loader2, Package, X } from "lucide-react";

const ACTIVE_PRODUCTS = ["Hyperburn", "Thermosleep", "Hyperload", "Thermoburn", "Carb Control"];

export default function ProductRenders() {
  const [selectedProduct, setSelectedProduct] = useState<string>(ACTIVE_PRODUCTS[0]);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();

  // Fetch renders for selected product
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

    // Read file as base64
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

    // Reset file input
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

  // Count renders per product
  const renderCounts = (allRendersQuery.data || []).reduce((acc, r) => {
    acc[r.product] = (acc[r.product] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Product Renders</h1>
        <p className="text-gray-400 text-sm">
          Upload and manage product render images. The pipeline uses these renders for static ad compositing.
        </p>
      </div>

      {/* Product Tabs */}
      <div className="flex gap-2 flex-wrap">
        {ACTIVE_PRODUCTS.map((p) => (
          <button
            key={p}
            onClick={() => setSelectedProduct(p)}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              selectedProduct === p
                ? "bg-[#FF3838] text-white shadow-lg shadow-[#FF3838]/20"
                : "bg-[#191B1F] text-gray-400 hover:text-white border border-white/10 hover:border-white/20"
            }`}
          >
            <Package className="w-4 h-4 inline mr-2" />
            {p}
            {renderCounts[p] ? (
              <span className="ml-2 bg-white/20 text-xs px-1.5 py-0.5 rounded-full">{renderCounts[p]}</span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Zone */}
        <div className="lg:col-span-1">
          <div className="bg-[#191B1F] border border-white/5 rounded-xl p-6 sticky top-6">
            <h3 className="text-lg font-bold text-white mb-4">Upload Render</h3>
            <p className="text-xs text-gray-400 mb-4">
              Upload product render images for <span className="text-[#FF3838] font-semibold">{selectedProduct}</span>. 
              PNG with transparent background recommended.
            </p>

            {/* Drop Zone */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-white/10 hover:border-[#FF3838]/50 rounded-xl p-8 text-center cursor-pointer transition-all hover:bg-[#FF3838]/5"
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

            {/* Stats */}
            <div className="mt-6 pt-4 border-t border-white/5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Renders for {selectedProduct}</span>
                <span className="text-white font-bold">{rendersQuery.data?.length || 0}</span>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-gray-400">Total renders</span>
                <span className="text-white font-bold">{allRendersQuery.data?.length || 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Render Gallery */}
        <div className="lg:col-span-2">
          <div className="bg-[#191B1F] border border-white/5 rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">
              {selectedProduct} Renders
            </h3>

            {rendersQuery.isLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-[#FF3838]" />
              </div>
            ) : !rendersQuery.data || rendersQuery.data.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <ImageIcon className="w-12 h-12 mb-3" />
                <p className="text-sm">No renders uploaded for {selectedProduct}</p>
                <p className="text-xs mt-1">Upload product render images to use in the pipeline</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {rendersQuery.data.map((render) => (
                  <div
                    key={render.id}
                    className="group relative bg-[#0F1117] rounded-lg overflow-hidden border border-white/5 hover:border-white/20 transition-all"
                  >
                    {/* Image */}
                    <div className="aspect-square bg-[#01040A] flex items-center justify-center p-4">
                      <img
                        src={render.url}
                        alt={render.fileName}
                        className="w-full h-full object-contain"
                      />
                    </div>

                    {/* Info */}
                    <div className="p-3">
                      <p className="text-xs text-white truncate font-medium">{render.fileName}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {render.fileSize ? `${(render.fileSize / 1024).toFixed(0)} KB` : "—"}
                      </p>
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm("Delete this render?")) {
                          deleteMutation.mutate({ id: render.id });
                        }
                      }}
                      className="absolute top-2 right-2 p-1.5 bg-red-500/80 hover:bg-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
