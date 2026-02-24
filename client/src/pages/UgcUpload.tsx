import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";
import { useLocation } from "wouter";

const PRODUCTS = ["Hyperburn", "Thermosleep", "Hyperload", "Thermoburn", "Carb Control"];

export default function UgcUpload() {
  const [, setLocation] = useLocation();
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [product, setProduct] = useState<string>("");
  const [audienceTag, setAudienceTag] = useState<string>("");
  const [desiredOutputVolume, setDesiredOutputVolume] = useState<number>(10);
  const [uploading, setUploading] = useState(false);

  // No longer using tRPC mutation - using direct multipart upload instead

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("video/")) {
        toast.error("Please select a video file");
        return;
      }
      if (file.size > 500 * 1024 * 1024) {
        toast.error("Video file must be under 500MB");
        return;
      }
      setVideoFile(file);
    }
  };

  const handleUpload = async () => {
    if (!videoFile) {
      toast.error("Please select a video file");
      return;
    }
    if (!product) {
      toast.error("Please select a product");
      return;
    }
    if (desiredOutputVolume < 1 || desiredOutputVolume > 200) {
      toast.error("Output volume must be between 1 and 200");
      return;
    }

    setUploading(true);

    try {
      // Use FormData for multipart upload (bypasses tRPC)
      const formData = new FormData();
      formData.append("video", videoFile);
      formData.append("product", product);
      if (audienceTag) formData.append("audienceTag", audienceTag);
      formData.append("desiredOutputVolume", desiredOutputVolume.toString());
      
      console.log(`[UGC Upload] Uploading ${videoFile.name} (${(videoFile.size / 1024 / 1024).toFixed(2)}MB)...`);
      
      const response = await fetch("/api/ugc/upload", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }
      
      const data = await response.json();
      console.log(`[UGC Upload] Success! Upload ID: ${data.id}`);
      
      toast.success(`Video uploaded successfully! Upload ID: ${data.id}`);
      setLocation(`/ugc/${data.id}`);
    } catch (error: any) {
      console.error(`[UGC Upload] Error:`, error);
      toast.error(`Upload failed: ${error.message}`);
      setUploading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">UGC Clone Engine</h1>
        <p className="text-gray-400">
          Upload a winning UGC video to generate controlled script variants
        </p>
      </div>

      <Card className="bg-[#0D0F12] border-white/10">
        <CardHeader>
          <CardTitle className="text-white">Upload & Configure</CardTitle>
          <CardDescription className="text-gray-400">
            Select a video file, product, and desired output volume to start the cloning pipeline
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Video Upload */}
          <div className="space-y-2">
            <Label htmlFor="video" className="text-white">
              Video File
            </Label>
            <div className="flex items-center gap-4">
              <Input
                id="video"
                type="file"
                accept="video/*"
                onChange={handleFileChange}
                className="bg-[#01040A] border-white/10 text-white file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-[#FF3838] file:text-white hover:file:bg-[#FF3838]/90"
                disabled={uploading}
              />
              {videoFile && (
                <div className="text-sm text-gray-400">
                  {videoFile.name} ({(videoFile.size / 1024 / 1024).toFixed(2)} MB)
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500">Max file size: 500MB. Supported formats: MP4, MOV, WEBM</p>
          </div>

          {/* Product Selection */}
          <div className="space-y-2">
            <Label htmlFor="product" className="text-white">
              Product
            </Label>
            <Select value={product} onValueChange={setProduct} disabled={uploading}>
              <SelectTrigger className="bg-[#01040A] border-white/10 text-white">
                <SelectValue placeholder="Select product" />
              </SelectTrigger>
              <SelectContent>
                {PRODUCTS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Audience Tag */}
          <div className="space-y-2">
            <Label htmlFor="audience" className="text-white">
              Audience Tag (Optional)
            </Label>
            <Input
              id="audience"
              type="text"
              placeholder="e.g., fitness enthusiasts, busy mums, athletes"
              value={audienceTag}
              onChange={(e) => setAudienceTag(e.target.value)}
              className="bg-[#01040A] border-white/10 text-white placeholder:text-gray-600"
              disabled={uploading}
            />
            <p className="text-xs text-gray-500">
              Helps guide variant generation toward specific audience archetypes
            </p>
          </div>

          {/* Desired Output Volume */}
          <div className="space-y-2">
            <Label htmlFor="volume" className="text-white">
              Desired Output Volume
            </Label>
            <Input
              id="volume"
              type="number"
              min={1}
              max={200}
              value={desiredOutputVolume}
              onChange={(e) => setDesiredOutputVolume(parseInt(e.target.value) || 10)}
              className="bg-[#01040A] border-white/10 text-white"
              disabled={uploading}
            />
            <p className="text-xs text-gray-500">
              Number of script variants to generate (1-200). Recommended: 10-40 for testing, 100+ for scale.
            </p>
          </div>

          {/* Upload Button */}
          <Button
            onClick={handleUpload}
            disabled={!videoFile || !product || uploading}
            className="w-full bg-[#FF3838] hover:bg-[#FF3838]/90 text-white"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Start Clone Pipeline
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
