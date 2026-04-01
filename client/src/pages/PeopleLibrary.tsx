import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Users, Upload, Trash2, Loader2, Plus, X, Sparkles, Wand2 } from "lucide-react";

const TAG_OPTIONS = ["male", "female", "athletic", "casual", "young", "mature", "professional"];

const AI_PRESETS = [
  "Athletic female, mid-20s, toned physique, gym setting, confident expression",
  "Professional male, early 30s, fit build, studio portrait, natural lighting",
  "Fit mother, late 20s, casual activewear, bright natural light, warm smile",
  "Young male athlete, early 20s, intense expression, dark dramatic background",
  "Mature fitness enthusiast, 40s, confident pose, outdoor setting",
  "Female bodybuilder, strong physique, gym environment, powerful stance",
  "Male model, chiseled jawline, athletic wear, minimalist studio backdrop",
  "Active young woman, running gear, outdoor trail, energetic pose",
];

export default function PeopleLibrary() {
  const { data: people, isLoading } = trpc.people.list.useQuery();
  const utils = trpc.useUtils();

  const [showUpload, setShowUpload] = useState(false);
  const [createMode, setCreateMode] = useState<"upload" | "ai">("upload");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileData, setFileData] = useState<{ base64: string; mimeType: string } | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiPreview, setAiPreview] = useState<string | null>(null);

  const uploadPerson = trpc.people.upload.useMutation({
    onSuccess: () => {
      toast.success("Person added to library");
      utils.people.list.invalidate();
      resetForm();
    },
    onError: (err) => toast.error(err.message),
  });

  const generatePerson = trpc.people.generate.useMutation({
    onSuccess: (data) => {
      toast.success("Person generated and saved to library");
      utils.people.list.invalidate();
      resetForm();
    },
    onError: (err) => toast.error(`Generation failed: ${err.message}`),
  });

  const deletePerson = trpc.people.delete.useMutation({
    onSuccess: () => {
      toast.success("Person removed");
      utils.people.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const resetForm = () => {
    setShowUpload(false);
    setCreateMode("upload");
    setName("");
    setDescription("");
    setSelectedTags([]);
    setPreview(null);
    setFileData(null);
    setAiPrompt("");
    setAiGenerating(false);
    setAiPreview(null);
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) { toast.error("Describe the person to generate"); return; }
    if (!name.trim()) { toast.error("Name is required"); return; }
    setAiGenerating(true);
    try {
      await generatePerson.mutateAsync({
        name: name.trim(),
        description: aiPrompt.trim(),
        tags: selectedTags.length > 0 ? selectedTags.join(",") : undefined,
      });
    } finally {
      setAiGenerating(false);
    }
  };

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Only image files are accepted");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Max file size is 20MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      setFileData({ base64, mimeType: file.type });
      setPreview(result);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!fileData) {
      toast.error("Please upload a photo");
      return;
    }
    setUploading(true);
    try {
      await uploadPerson.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        tags: selectedTags.length > 0 ? selectedTags.join(",") : undefined,
        mimeType: fileData.mimeType,
        base64Data: fileData.base64,
      });
    } finally {
      setUploading(false);
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  return (
    <div className="min-h-screen bg-[#01040A] p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">People Library</h1>
              <p className="text-gray-400 text-sm">Upload reference photos of people types to use in generated statics</p>
            </div>
          </div>
          {!showUpload && (
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-2 bg-[#FF3838] hover:bg-[#FF3838]/80 text-white px-5 py-3 rounded-lg text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Add Person
            </button>
          )}
        </div>

        {/* Upload Form */}
        {showUpload && (
          <div className="bg-[#0D0F12] border border-white/5 rounded-2xl p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold">Add Person Type Reference</h2>
              <button onClick={resetForm} className="text-gray-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Toggle */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setCreateMode("upload")}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                  createMode === "upload" ? "bg-[#FF3838] text-white" : "bg-white/5 text-gray-400 hover:bg-white/10"
                }`}
              >
                <Upload className="w-4 h-4" />
                Upload Photo
              </button>
              <button
                onClick={() => setCreateMode("ai")}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                  createMode === "ai" ? "bg-[#FF3838] text-white" : "bg-white/5 text-gray-400 hover:bg-white/10"
                }`}
              >
                <Wand2 className="w-4 h-4" />
                Create with AI
              </button>
            </div>

            <p className="text-gray-400 text-xs mb-4">
              {createMode === "upload"
                ? "Upload a reference photo. AI will generate a new realistic person matching the general look, age, and style."
                : "Describe the person you want and AI will generate a hyper-realistic portrait using Nano Banana Pro."}
            </p>

            {createMode === "ai" ? (
              <div className="space-y-4">
                {/* AI Preset Prompts */}
                <div>
                  <label className="block text-gray-400 text-xs font-medium mb-2">Quick Presets</label>
                  <div className="grid grid-cols-2 gap-2">
                    {AI_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        onClick={() => setAiPrompt(preset)}
                        className={`px-3 py-2 rounded-lg text-xs text-left transition-all ${
                          aiPrompt === preset
                            ? "bg-[#FF3838]/10 border border-[#FF3838] text-white"
                            : "bg-white/5 text-gray-400 hover:bg-white/10 border border-transparent"
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-gray-400 text-xs font-medium mb-1">Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Athletic Female Model"
                    className="w-full bg-[#01040A] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-xs font-medium mb-1">Description / Prompt *</label>
                  <textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="Describe the person in detail: age, gender, build, expression, setting, clothing, lighting..."
                    className="w-full bg-[#01040A] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 resize-none"
                    rows={4}
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-xs font-medium mb-1">Tags</label>
                  <div className="flex flex-wrap gap-2">
                    {TAG_OPTIONS.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                          selectedTags.includes(tag) ? "bg-[#FF3838] text-white" : "bg-white/5 text-gray-400 hover:bg-white/10"
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={handleAiGenerate}
                  disabled={aiGenerating || !name.trim() || !aiPrompt.trim()}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-4 py-3 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {aiGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating with Nano Banana Pro (2-3 min)...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generate Person
                    </>
                  )}
                </button>
                <p className="text-gray-600 text-[10px]">Uses Nano Banana Pro for highest quality. Cost: ~$0.12 per generation.</p>
              </div>
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Photo Upload */}
              <div>
                {preview ? (
                  <div className="relative">
                    <img src={preview} alt="Preview" className="w-full aspect-square object-cover rounded-xl border border-white/10" />
                    <button
                      onClick={() => { setPreview(null); setFileData(null); }}
                      className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label
                    className="flex flex-col items-center justify-center w-full aspect-square border-2 border-dashed border-white/10 rounded-xl cursor-pointer hover:border-white/20 transition-colors bg-[#01040A]"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files?.[0];
                      if (file) handleFile(file);
                    }}
                  >
                    <Upload className="w-8 h-8 text-gray-600 mb-2" />
                    <span className="text-gray-400 text-sm">Drop photo or click to upload</span>
                    <span className="text-gray-600 text-xs mt-1">PNG, JPG, WebP (max 20MB)</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFile(file);
                      }}
                    />
                  </label>
                )}
              </div>

              {/* Details */}
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-400 text-xs font-medium mb-1">Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Athletic Female Model"
                    className="w-full bg-[#01040A] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-xs font-medium mb-1">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g., Mid-20s, brunette, fitness aesthetic, gym setting"
                    className="w-full bg-[#01040A] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 resize-none"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-xs font-medium mb-1">Tags</label>
                  <div className="flex flex-wrap gap-2">
                    {TAG_OPTIONS.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                          selectedTags.includes(tag)
                            ? "bg-[#FF3838] text-white"
                            : "bg-white/5 text-gray-400 hover:bg-white/10"
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={uploading || !name.trim() || !fileData}
                  className="w-full flex items-center justify-center gap-2 bg-[#FF3838] hover:bg-[#FF3838]/80 text-white px-4 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {uploading ? "Uploading..." : "Add to Library"}
                </button>
              </div>
            </div>
            )}
          </div>
        )}

        {/* People Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-gray-500 animate-spin" />
          </div>
        ) : !people || people.length === 0 ? (
          <div className="bg-[#0D0F12] border border-white/5 rounded-2xl p-12 text-center">
            <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-sm mb-1">No people in your library yet</p>
            <p className="text-gray-600 text-xs">Add reference photos to include realistic people in your ad generations</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {people.map((person: any) => (
              <div
                key={person.id}
                className="bg-[#0D0F12] border border-white/5 rounded-xl overflow-hidden group"
              >
                <div className="aspect-square overflow-hidden">
                  <img src={person.url} alt={person.name} className="w-full h-full object-cover" />
                </div>
                <div className="p-3">
                  <p className="text-white text-sm font-medium truncate">{person.name}</p>
                  {person.description && (
                    <p className="text-gray-500 text-xs mt-0.5 line-clamp-2">{person.description}</p>
                  )}
                  {person.tags && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {person.tags.split(",").map((tag: string) => (
                        <span key={tag} className="px-2 py-0.5 bg-white/5 text-gray-400 text-[10px] rounded-full">
                          {tag.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => {
                      if (confirm(`Remove "${person.name}" from the library?`)) {
                        deletePerson.mutate({ id: person.id });
                      }
                    }}
                    className="mt-2 flex items-center gap-1 text-red-400/60 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3 h-3" />
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
