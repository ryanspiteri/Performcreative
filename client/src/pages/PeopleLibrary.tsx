import { useState, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Users, Upload, Trash2, Loader2, Plus, X, Sparkles, Wand2, Camera, Smartphone, Sun, Dumbbell, Package } from "lucide-react";

const TAG_OPTIONS = ["male", "female", "athletic", "casual", "young", "mature", "professional"];

type GenerationStyle = "professional" | "ugc" | "lifestyle" | "gym-selfie";

const STYLE_OPTIONS: { value: GenerationStyle; label: string; description: string; icon: typeof Camera }[] = [
  { value: "professional", label: "Professional", description: "Studio lighting, DSLR quality, magazine look", icon: Camera },
  { value: "ugc", label: "UGC", description: "iPhone selfie, imperfect lighting, casual angle", icon: Smartphone },
  { value: "lifestyle", label: "Lifestyle", description: "Candid, natural light, shot by a friend", icon: Sun },
  { value: "gym-selfie", label: "Gym Selfie", description: "Mirror selfie, harsh gym lighting, sweaty", icon: Dumbbell },
];

const STYLE_PRESETS: Record<GenerationStyle, string[]> = {
  professional: [
    "Athletic female, mid-20s, toned physique, gym setting, confident expression",
    "Professional male, early 30s, fit build, studio portrait, natural lighting",
    "Fit mother, late 20s, casual activewear, bright natural light, warm smile",
    "Young male athlete, early 20s, intense expression, dark dramatic background",
    "Mature fitness enthusiast, 40s, confident pose, outdoor setting",
    "Female bodybuilder, strong physique, gym environment, powerful stance",
    "Male model, chiseled jawline, athletic wear, minimalist studio backdrop",
    "Active young woman, running gear, outdoor trail, energetic pose",
  ],
  ugc: [
    "Girl filming herself mid-workout, messy bun, gym clothes, holding shaker bottle",
    "Guy recording a quick testimonial video, casual t-shirt, kitchen background",
    "Young woman taking a mirror selfie with supplement tub, bathroom lighting",
    "Fitness girl talking to camera, slightly out of breath, post-workout glow",
    "Man in his 30s doing an unboxing video at his desk, natural window light",
    "College-age girl showing off her gym bag contents, dorm room background",
    "Athletic guy filming himself making a protein shake, messy kitchen counter",
    "Woman in her 20s doing a product review, couch background, ring light glow",
  ],
  lifestyle: [
    "Woman walking with coffee and gym bag, morning golden hour light, city sidewalk",
    "Man stretching outdoors at sunrise, park setting, candid mid-motion",
    "Friends laughing after a workout, outdoor cafe, natural warm tones",
    "Woman preparing a smoothie in a bright kitchen, morning light through window",
    "Athletic guy hiking on a trail, backpack, natural mountain backdrop",
    "Young woman doing yoga on a balcony, soft overcast light, peaceful expression",
    "Couple jogging together on a beach path, sunset lighting, candid shot",
    "Man sitting with a shaker bottle post-gym, park bench, relaxed expression",
  ],
  "gym-selfie": [
    "Guy flexing in gym mirror, tank top, sweaty, post-workout pump",
    "Girl mid-set on cable machine, gym mirror reflection, focused expression",
    "Athletic man taking a progress selfie, gym locker room, overhead lighting",
    "Woman posing with dumbbells, gym floor, fluorescent lighting, confident stance",
    "Guy doing a front double bicep, gym mirror, harsh overhead lights, veiny arms",
    "Girl post-cardio, red-faced, holding water bottle, gym background",
    "Man filming a set of deadlifts, phone on ground angle, chalk on hands",
    "Athletic woman flexing in sports bra, gym mirror, phone flash visible",
  ],
};

export default function PeopleLibrary() {
  const { data: people, isLoading } = trpc.people.list.useQuery();
  const { data: allRenders } = trpc.renders.list.useQuery();
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
  const [selectedStyle, setSelectedStyle] = useState<GenerationStyle>("professional");
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [showProductPicker, setShowProductPicker] = useState(false);

  // Group renders by product, picking the default render (or first) for each product
  const productOptions = useMemo(() => {
    if (!allRenders) return [];
    const byProduct = new Map<string, { id: number; product: string; url: string }>();
    for (const r of allRenders) {
      if (!byProduct.has(r.product) || (r as any).isDefault === 1) {
        byProduct.set(r.product, { id: r.id, product: r.product, url: r.url });
      }
    }
    return Array.from(byProduct.values()).sort((a, b) => a.product.localeCompare(b.product));
  }, [allRenders]);

  const selectedProduct = productOptions.find((p) => p.id === selectedProductId);

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
    setSelectedStyle("professional");
    setSelectedProductId(null);
    setShowProductPicker(false);
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
        style: selectedStyle,
        productId: selectedProductId ?? undefined,
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

  const currentPresets = STYLE_PRESETS[selectedStyle];

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
                {/* Style Selector */}
                <div>
                  <label className="block text-gray-400 text-xs font-medium mb-2">Generation Style</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {STYLE_OPTIONS.map((style) => {
                      const Icon = style.icon;
                      return (
                        <button
                          key={style.value}
                          onClick={() => {
                            setSelectedStyle(style.value);
                            setAiPrompt("");
                          }}
                          className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-lg text-center transition-all ${
                            selectedStyle === style.value
                              ? "bg-[#FF3838]/10 border-2 border-[#FF3838] text-white"
                              : "bg-white/5 text-gray-400 hover:bg-white/10 border-2 border-transparent"
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                          <span className="text-xs font-medium">{style.label}</span>
                          <span className="text-[10px] text-gray-500 leading-tight">{style.description}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Product Picker */}
                <div>
                  <button
                    onClick={() => setShowProductPicker(!showProductPicker)}
                    className="flex items-center gap-2 text-gray-400 text-xs font-medium hover:text-white transition-colors"
                  >
                    <Package className="w-3.5 h-3.5" />
                    Include ONEST Product (optional)
                    <span className="text-[10px] text-gray-600">{showProductPicker ? "v" : ">"}</span>
                  </button>
                  {showProductPicker && (
                    <div className="mt-2 grid grid-cols-3 md:grid-cols-4 gap-2">
                      <button
                        onClick={() => setSelectedProductId(null)}
                        className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg text-xs transition-all ${
                          selectedProductId === null
                            ? "bg-white/10 border border-white/20 text-white"
                            : "bg-white/5 text-gray-500 hover:bg-white/10 border border-transparent"
                        }`}
                      >
                        <X className="w-4 h-4" />
                        None
                      </button>
                      {productOptions.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setSelectedProductId(p.id)}
                          className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg text-xs transition-all ${
                            selectedProductId === p.id
                              ? "bg-[#FF3838]/10 border border-[#FF3838] text-white"
                              : "bg-white/5 text-gray-400 hover:bg-white/10 border border-transparent"
                          }`}
                        >
                          <img src={p.url} alt={p.product} className="w-10 h-10 object-contain rounded" />
                          <span className="text-[10px] text-center leading-tight truncate w-full">{p.product}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedProduct && (
                    <p className="text-[10px] text-gray-500 mt-1">
                      Product: <span className="text-gray-300">{selectedProduct.product}</span> — will be included in the generated image
                    </p>
                  )}
                </div>

                {/* AI Preset Prompts */}
                <div>
                  <label className="block text-gray-400 text-xs font-medium mb-2">Quick Presets</label>
                  <div className="grid grid-cols-2 gap-2">
                    {currentPresets.map((preset) => (
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
                      Generating with Nano Banana Pro...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generate {selectedStyle === "professional" ? "Professional" : selectedStyle === "ugc" ? "UGC" : selectedStyle === "lifestyle" ? "Lifestyle" : "Gym Selfie"} Person
                      {selectedProduct ? ` with ${selectedProduct.product}` : ""}
                    </>
                  )}
                </button>
                <p className="text-gray-600 text-[10px]">Uses Nano Banana Pro for highest quality. Cost: ~$0.15 per generation.</p>
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
                  <div className="flex flex-wrap gap-1 mt-2">
                    {person.style && (
                      <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 text-[10px] rounded-full">
                        {person.style}
                      </span>
                    )}
                    {person.productName && (
                      <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-[10px] rounded-full">
                        {person.productName}
                      </span>
                    )}
                    {person.tags && person.tags.split(",").map((tag: string) => (
                      <span key={tag} className="px-2 py-0.5 bg-white/5 text-gray-400 text-[10px] rounded-full">
                        {tag.trim()}
                      </span>
                    ))}
                  </div>
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
