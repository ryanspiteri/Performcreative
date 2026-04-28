import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Upload, Loader2, Trash2, Star, ImageIcon, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

/**
 * Brand Logo Library
 *
 * Upload + manage ONEST brand-logo PNGs. The default logo gets passed as a
 * reference image to the iteration pipeline so Gemini stops picking up
 * logos from competitor reference ads ("the old logo from the examples").
 */
export default function BrandLogos() {
  const utils = trpc.useUtils();
  const logosQuery = trpc.brandLogos.list.useQuery();
  const upload = trpc.brandLogos.upload.useMutation({
    onSuccess: () => {
      utils.brandLogos.list.invalidate();
      toast.success("Logo uploaded");
    },
    onError: (err) => toast.error(`Upload failed: ${err.message}`),
  });
  const setDefault = trpc.brandLogos.setDefault.useMutation({
    onSuccess: () => {
      utils.brandLogos.list.invalidate();
      toast.success("Default logo updated");
    },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });
  const deleteLogo = trpc.brandLogos.delete.useMutation({
    onSuccess: () => {
      utils.brandLogos.list.invalidate();
      toast.success("Logo deleted");
    },
    onError: (err) => toast.error(`Delete failed: ${err.message}`),
  });

  const [uploadName, setUploadName] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const [uploadAsDefault, setUploadAsDefault] = useState(false);

  const handleFileSelect = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Upload an image file (PNG/JPG/SVG)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Logo must be under 5 MB");
      return;
    }
    setUploadingFile(file);
    if (!uploadName) {
      setUploadName(file.name.replace(/\.[^.]+$/, ""));
    }
  }, [uploadName]);

  const handleSubmit = useCallback(async () => {
    if (!uploadingFile || !uploadName.trim()) {
      toast.error("Pick a file and give it a name first");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const result = reader.result as string;
      const base64Data = result.split(",")[1];
      try {
        await upload.mutateAsync({
          name: uploadName.trim(),
          description: uploadDescription.trim() || undefined,
          mimeType: uploadingFile.type,
          base64Data,
          isDefault: uploadAsDefault,
        });
        setUploadingFile(null);
        setUploadName("");
        setUploadDescription("");
        setUploadAsDefault(false);
        const fileInput = document.getElementById("logo-file-input") as HTMLInputElement | null;
        if (fileInput) fileInput.value = "";
      } catch {
        // toast handled in onError
      }
    };
    reader.readAsDataURL(uploadingFile);
  }, [uploadingFile, uploadName, uploadDescription, uploadAsDefault, upload]);

  const logos = logosQuery.data || [];
  const hasDefault = logos.some((l: any) => l.isDefault === 1);

  return (
    <div className="min-h-screen bg-[#0A0B0D] p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-md bg-[#FF3838] flex items-center justify-center">
              <ImageIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Brand Logos</h1>
              <p className="text-gray-400 text-sm">
                ONEST logo PNGs. The default logo gets passed to the iteration pipeline so generated ads use the right brand mark instead of one from the reference ad.
              </p>
            </div>
          </div>
          {!logosQuery.isLoading && !hasDefault && (
            <div className="mt-4 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-start gap-2 text-sm">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span className="text-amber-200">
                No default logo set. Upload one and mark it default so /iterate uses it.
              </span>
            </div>
          )}
        </div>

        {/* Upload form */}
        <div className="bg-[#15171B] border border-white/5 rounded-lg p-6 mb-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-4">
            Upload new logo
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Name</label>
              <input
                type="text"
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                placeholder="e.g. ONEST Z mark white"
                className="w-full bg-[#0A0B0D] border border-white/10 rounded-sm px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#FF3838]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Description (optional)
              </label>
              <input
                type="text"
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                placeholder="When to use this variant"
                className="w-full bg-[#0A0B0D] border border-white/10 rounded-sm px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#FF3838]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Logo file</label>
              <input
                id="logo-file-input"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={(e) => handleFileSelect(e.target.files?.[0])}
                className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-sm file:border-0 file:text-sm file:font-medium file:bg-[#FF3838]/10 file:text-[#FF3838] hover:file:bg-[#FF3838]/20"
              />
              {uploadingFile && (
                <p className="text-xs text-gray-500 mt-2">
                  {uploadingFile.name} — {Math.round(uploadingFile.size / 1024)} KB
                </p>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={uploadAsDefault}
                onChange={(e) => setUploadAsDefault(e.target.checked)}
                className="accent-[#FF3838]"
              />
              Make this the default logo
            </label>
            <button
              onClick={handleSubmit}
              disabled={!uploadingFile || !uploadName.trim() || upload.isPending}
              className={`w-full py-3 rounded-sm font-semibold text-sm transition-all flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#FF3838] focus:ring-offset-2 focus:ring-offset-[#15171B] ${
                uploadingFile && uploadName.trim() && !upload.isPending
                  ? "bg-[#FF3838] text-white hover:bg-[#FF5555]"
                  : "bg-white/5 text-gray-600 cursor-not-allowed"
              }`}
            >
              {upload.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Upload logo
                </>
              )}
            </button>
          </div>
        </div>

        {/* Existing logos */}
        <div className="bg-[#15171B] border border-white/5 rounded-lg p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-4">
            Library ({logos.length})
          </h2>
          {logosQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-gray-500 animate-spin" />
            </div>
          ) : logos.length === 0 ? (
            <div className="text-center py-12">
              <ImageIcon className="w-12 h-12 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No logos uploaded yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {logos.map((logo: any) => (
                <div
                  key={logo.id}
                  className={`relative bg-[#0A0B0D] border ${
                    logo.isDefault === 1 ? "border-[#FF3838]" : "border-white/10"
                  } rounded-md p-4 group`}
                >
                  <div className="aspect-square rounded-sm bg-white/5 flex items-center justify-center mb-3 overflow-hidden">
                    <img
                      src={logo.url}
                      alt={logo.name}
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                  <p className="text-sm text-white font-medium truncate" title={logo.name}>
                    {logo.name}
                  </p>
                  {logo.description && (
                    <p className="text-[11px] text-gray-500 truncate mt-0.5" title={logo.description}>
                      {logo.description}
                    </p>
                  )}
                  {logo.isDefault === 1 && (
                    <div className="flex items-center gap-1 mt-2 text-[10px] text-[#FF3838]">
                      <CheckCircle className="w-3 h-3" />
                      Default
                    </div>
                  )}
                  <div className="flex gap-2 mt-3">
                    {logo.isDefault !== 1 && (
                      <button
                        onClick={() => setDefault.mutate({ id: logo.id })}
                        disabled={setDefault.isPending}
                        className="flex-1 px-2 py-1.5 rounded-sm bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-medium transition-all flex items-center justify-center gap-1"
                        title="Make this the default logo"
                      >
                        <Star className="w-3 h-3" />
                        Set default
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (confirm(`Delete "${logo.name}"?`)) {
                          deleteLogo.mutate({ id: logo.id });
                        }
                      }}
                      disabled={deleteLogo.isPending}
                      className="px-2 py-1.5 rounded-sm bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 text-xs transition-all"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
