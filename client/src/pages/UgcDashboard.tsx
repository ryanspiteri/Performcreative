import { useState } from "react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, Clock, Play, Send } from "lucide-react";

export default function UgcDashboard() {
  const [, params] = useRoute("/ugc/:id");
  const uploadId = parseInt(params?.id || "0");
  
  const [selectedVariants, setSelectedVariants] = useState<number[]>([]);

  const { data, isLoading, refetch } = trpc.ugc.get.useQuery({ id: uploadId }, {
    enabled: uploadId > 0,
    refetchInterval: (queryData) => {
      // Poll every 3s if status is transcribing, extracting, or generating
      const status = (queryData as any)?.upload?.status;
      if (status === "transcribing" || status === "structure_extracted" || status === "generating_variants") {
        return 3000;
      }
      return false;
    },
  });

  const approveBlueprint = trpc.ugc.approveBlueprint.useMutation({
    onSuccess: () => {
      toast.success("Blueprint approved! Generating variants...");
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to approve blueprint: ${error.message}`);
    },
  });

  const generateVariants = trpc.ugc.generateVariants.useMutation({
    onSuccess: () => {
      toast.success("Variant generation started!");
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to generate variants: ${error.message}`);
    },
  });

  const approveVariants = trpc.ugc.approveVariants.useMutation({
    onSuccess: (result) => {
      toast.success(`${result.count} variants approved!`);
      setSelectedVariants([]);
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to approve variants: ${error.message}`);
    },
  });

  const rejectVariants = trpc.ugc.rejectVariants.useMutation({
    onSuccess: (result) => {
      toast.success(`${result.count} variants rejected`);
      setSelectedVariants([]);
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to reject variants: ${error.message}`);
    },
  });

  const pushToClickup = trpc.ugc.pushToClickup.useMutation({
    onSuccess: (result) => {
      toast.success(`${result.count} variants pushed to ClickUp!`);
      setSelectedVariants([]);
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to push to ClickUp: ${error.message}`);
    },
  });

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!data?.upload) {
    return (
      <div className="p-8">
        <div className="text-center text-gray-400">Upload not found</div>
      </div>
    );
  }

  const { upload, variants } = data;
  const blueprint = upload.structureBlueprint as any;

  const toggleVariant = (id: number) => {
    setSelectedVariants((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedVariants(variants.map((v: any) => v.id));
  };

  const deselectAll = () => {
    setSelectedVariants([]);
  };

  const approvedVariants = variants.filter((v: any) => v.status === "approved");
  const awaitingApproval = variants.filter((v: any) => v.status === "generated" || v.status === "awaiting_approval");

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">UGC Clone Dashboard</h1>
        <p className="text-gray-400">Upload #{uploadId} — {upload.product}</p>
      </div>

      {/* Upload Status Card */}
      <Card className="bg-[#0D0F12] border-white/10 mb-6">
        <CardHeader>
          <CardTitle className="text-white">Upload Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-gray-500 mb-1">Status</div>
              <Badge variant={upload.status === "completed" ? "default" : "secondary"}>
                {upload.status}
              </Badge>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Product</div>
              <div className="text-white">{upload.product}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Audience</div>
              <div className="text-white">{upload.audienceTag || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Desired Volume</div>
              <div className="text-white">{upload.desiredOutputVolume}</div>
            </div>
          </div>

          {upload.videoUrl && (
            <div>
              <div className="text-xs text-gray-500 mb-2">Video</div>
              <video
                src={upload.videoUrl}
                controls
                className="w-full max-w-md rounded-lg border border-white/10"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Structure Blueprint Card */}
      {blueprint && (
        <Card className="bg-[#0D0F12] border-white/10 mb-6">
          <CardHeader>
            <CardTitle className="text-white">Structure Blueprint</CardTitle>
            <CardDescription className="text-gray-400">
              Extracted winning structure from the original video
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm font-semibold text-white mb-1">Hook ({blueprint.hook?.strength})</div>
              <div className="text-gray-300 text-sm bg-[#01040A] p-3 rounded border border-white/5">
                {blueprint.hook?.text}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {blueprint.hook?.startTime}s - {blueprint.hook?.endTime}s
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold text-white mb-1">Body</div>
              <div className="text-gray-300 text-sm bg-[#01040A] p-3 rounded border border-white/5">
                {blueprint.body?.text}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Key Points: {blueprint.body?.keyPoints?.join(", ")}
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold text-white mb-1">CTA ({blueprint.cta?.urgency} urgency)</div>
              <div className="text-gray-300 text-sm bg-[#01040A] p-3 rounded border border-white/5">
                {blueprint.cta?.text}
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold text-white mb-1">Pacing</div>
              <div className="text-gray-300 text-sm">
                {blueprint.pacing?.wordsPerMinute} WPM • {blueprint.pacing?.energyLevel} energy • {blueprint.pacing?.pauseCount} pauses
              </div>
            </div>

            {!upload.blueprintApprovedAt && (
              <Button
                onClick={() => approveBlueprint.mutate({ uploadId })}
                disabled={approveBlueprint.isPending}
                className="bg-[#FF3838] hover:bg-[#FF3838]/90 text-white"
              >
                {approveBlueprint.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Approving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Approve Blueprint & Generate Variants
                  </>
                )}
              </Button>
            )}

            {upload.blueprintApprovedAt && upload.status === "blueprint_approved" && (
              <Button
                onClick={() => generateVariants.mutate({ uploadId })}
                disabled={generateVariants.isPending}
                className="bg-[#0347ED] hover:bg-[#0347ED]/90 text-white"
              >
                {generateVariants.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Start Variant Generation
                  </>
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Variants Card */}
      {variants.length > 0 && (
        <Card className="bg-[#0D0F12] border-white/10">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white">Generated Variants</CardTitle>
                <CardDescription className="text-gray-400">
                  {variants.length} variants • {approvedVariants.length} approved • {awaitingApproval.length} awaiting approval
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectAll}
                  className="border-white/10 text-white hover:bg-white/5"
                >
                  Select All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={deselectAll}
                  className="border-white/10 text-white hover:bg-white/5"
                >
                  Deselect All
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Bulk Actions */}
            {selectedVariants.length > 0 && (
              <div className="mb-4 p-4 bg-[#01040A] rounded border border-white/10 flex items-center justify-between">
                <div className="text-white">{selectedVariants.length} variants selected</div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => approveVariants.mutate({ variantIds: selectedVariants })}
                    disabled={approveVariants.isPending}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Approve Selected
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => rejectVariants.mutate({ variantIds: selectedVariants })}
                    disabled={rejectVariants.isPending}
                    className="border-red-600 text-red-600 hover:bg-red-600/10"
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    Reject Selected
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => pushToClickup.mutate({ variantIds: selectedVariants })}
                    disabled={pushToClickup.isPending}
                    className="bg-[#0347ED] hover:bg-[#0347ED]/90 text-white"
                  >
                    <Send className="w-4 h-4 mr-1" />
                    Push to ClickUp
                  </Button>
                </div>
              </div>
            )}

            {/* Variants List */}
            <div className="space-y-3">
              {variants.map((variant: any) => (
                <div
                  key={variant.id}
                  className="p-4 bg-[#01040A] rounded border border-white/10 hover:border-white/20 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selectedVariants.includes(variant.id)}
                      onCheckedChange={() => toggleVariant(variant.id)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="text-white font-semibold">Variant #{variant.variantNumber}</div>
                        <Badge variant="outline" className="text-xs">
                          {variant.actorArchetype}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {variant.voiceTone}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {variant.energyLevel} energy
                        </Badge>
                        <Badge
                          variant={
                            variant.status === "approved"
                              ? "default"
                              : variant.status === "rejected"
                              ? "destructive"
                              : "secondary"
                          }
                          className="text-xs"
                        >
                          {variant.status}
                        </Badge>
                      </div>
                      <div className="text-gray-300 text-sm mb-2 whitespace-pre-wrap">
                        {variant.scriptText}
                      </div>
                      <div className="text-xs text-gray-500">
                        Runtime: ~{variant.runtime}s
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {upload.status === "generating_variants" && variants.length === 0 && (
        <Card className="bg-[#0D0F12] border-white/10">
          <CardContent className="py-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-4" />
            <div className="text-white font-semibold mb-2">Generating Variants...</div>
            <div className="text-gray-400 text-sm">
              This may take a few minutes depending on the desired output volume
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
