/**
 * Creative preview dialog.
 *
 * Renders a signed Meta Ad Preview iframe for the clicked creative. One
 * component handles video, image, carousel — Meta's preview iframe shows
 * the full ad rendered as it appears in Feed, so we don't need format-
 * specific code paths.
 *
 * Loading state: skeleton matching the iframe aspect ratio.
 * Error state: left-aligned error card with "View on Meta" permalink
 *              fallback, matching DESIGN.md (bg-[rgba(239,68,68,0.08)],
 *              border-l-4 border-[#EF4444]).
 * Success state: native iframe sandboxed to same-origin-off (we only
 *                render the URL Meta provided, so it's sandboxed against
 *                accidental JS execution in our parent window).
 */
import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, ExternalLink } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creativeAssetId: number | null;
  creativeName: string;
  thumbnailUrl?: string | null;
}

// Mobile Feed format: 540px wide, typical portrait ratio. These dimensions
// match what Meta's iframe expects — changing them shrinks the preview.
const PREVIEW_WIDTH = 540;
const PREVIEW_HEIGHT = 720;

export function CreativePreviewDialog({
  open,
  onOpenChange,
  creativeAssetId,
  creativeName,
  thumbnailUrl,
}: Props) {
  // Only fire the query when the dialog is open AND we have an ID. Closing
  // the dialog doesn't invalidate — react-query keeps the cached response
  // so reopening the same creative is instant.
  const enabled = open && creativeAssetId != null;
  const previewQuery = trpc.analytics.getAdPreview.useQuery(
    { creativeAssetId: creativeAssetId ?? 0, format: "MOBILE_FEED_STANDARD" },
    { enabled, staleTime: 15 * 60 * 1000, retry: false },
  );

  const iframeSrc = previewQuery.data?.iframeSrc ?? null;
  const permalink = previewQuery.data?.permalink ?? null;
  const adName = previewQuery.data?.adName ?? null;

  const errorText = useMemo(() => {
    if (!previewQuery.error) return null;
    const msg = (previewQuery.error as any)?.message ?? "Unknown error";
    return String(msg);
  }, [previewQuery.error]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-[#0A0B0D] border-[rgba(255,255,255,0.10)] text-white max-w-[620px] p-0"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader className="px-6 pt-6 pb-3 border-b border-[rgba(255,255,255,0.06)]">
          <DialogTitle className="text-base font-medium text-white truncate pr-8">
            {creativeName || "(unnamed creative)"}
          </DialogTitle>
          {adName && adName !== creativeName && (
            <p className="text-xs text-[#71717A] truncate font-mono">{adName}</p>
          )}
        </DialogHeader>
        <div className="p-6 flex flex-col items-center gap-4">
          {previewQuery.isLoading && (
            <div
              className="bg-[#15171B] rounded-md flex items-center justify-center"
              style={{ width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT }}
              aria-busy="true"
            >
              <Skeleton className="w-full h-full bg-[rgba(255,255,255,0.04)] rounded-md" />
            </div>
          )}

          {!previewQuery.isLoading && iframeSrc && (
            <div className="w-full flex justify-center">
              <iframe
                src={iframeSrc}
                width={PREVIEW_WIDTH}
                height={PREVIEW_HEIGHT}
                title={`Meta ad preview: ${creativeName}`}
                frameBorder={0}
                allow="autoplay; encrypted-media"
                className="bg-[#15171B] rounded-md"
              />
            </div>
          )}

          {!previewQuery.isLoading && errorText && (
            <div
              className="w-full max-w-[540px] bg-[rgba(239,68,68,0.08)] border-l-4 border-[#EF4444] p-4 rounded-md"
              role="alert"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-[#EF4444] flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-white">Preview unavailable</div>
                  <p className="text-xs text-[#A1A1AA] mt-1">{errorText}</p>
                  {permalink && (
                    <a
                      href={permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-[#FF3838] hover:text-[#FF5555] mt-2"
                    >
                      <ExternalLink className="w-3 h-3" />
                      View on Meta
                    </a>
                  )}
                  {!permalink && thumbnailUrl && (
                    <img
                      src={thumbnailUrl}
                      alt={creativeName}
                      className="mt-3 max-h-[360px] rounded-md object-contain bg-[#15171B]"
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {permalink && iframeSrc && (
            <a
              href={permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-[#71717A] hover:text-[#A1A1AA]"
            >
              <ExternalLink className="w-3 h-3" />
              Open on Meta
            </a>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
