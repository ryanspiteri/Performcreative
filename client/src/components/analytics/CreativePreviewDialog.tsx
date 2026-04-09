/**
 * Creative preview dialog.
 *
 * Why no inline iframe: Meta's ad preview URLs
 * (business.facebook.com/ads/api/preview_iframe.php + fb.me shareable links)
 * both require a Facebook Business login session cookie. Modern browsers
 * block third-party cookies in cross-origin iframes, so an inline iframe
 * loads Meta's auth-check page instead of the ad and renders as a broken
 * document icon inside the dialog.
 *
 * The pragmatic fix: show a large thumbnail inside the dialog (which IS the
 * actual ad creative for image ads and the video poster for videos) and
 * provide a prominent "Open on Meta" button that opens the preview in a
 * NEW TAB. A new tab is a top-level navigation → cookies work → the user's
 * Facebook Business login context applies → the preview renders correctly.
 *
 * This is how Motion, Foreplay, and every other third-party ad analytics
 * tool handles the same problem. Meta does not allow embedding ad previews
 * in third-party iframes.
 */
import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, ExternalLink, BarChart3 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creativeAssetId: number | null;
  creativeName: string;
  thumbnailUrl?: string | null;
}

export function CreativePreviewDialog({
  open,
  onOpenChange,
  creativeAssetId,
  creativeName,
  thumbnailUrl,
}: Props) {
  const enabled = open && creativeAssetId != null;
  const previewQuery = trpc.analytics.getAdPreview.useQuery(
    { creativeAssetId: creativeAssetId ?? 0, format: "MOBILE_FEED_STANDARD" },
    { enabled, staleTime: 15 * 60 * 1000, retry: false },
  );

  const adName = previewQuery.data?.adName ?? null;
  const shareableLink = previewQuery.data?.previewShareableLink ?? null;
  const iframeSrc = previewQuery.data?.iframeSrc ?? null;
  const adPermalink = previewQuery.data?.adPermalinkUrl ?? null;

  // Pick the best open-in-new-tab URL in priority order.
  const openOnMetaUrl = useMemo(() => {
    return shareableLink ?? adPermalink ?? iframeSrc ?? null;
  }, [shareableLink, adPermalink, iframeSrc]);

  const errorText = useMemo(() => {
    if (!previewQuery.error) return null;
    const msg = (previewQuery.error as any)?.message ?? "Unknown error";
    return String(msg);
  }, [previewQuery.error]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-[#0A0B0D] border-[rgba(255,255,255,0.10)] text-white max-w-[560px] p-0"
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

        <div className="px-6 py-6 flex flex-col items-center gap-4">
          {/* Large thumbnail — for image ads this IS the creative. For videos
              it's the first-frame poster. */}
          <div className="w-full flex justify-center">
            {thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt={creativeName}
                className="max-w-full max-h-[480px] rounded-md object-contain bg-[#15171B]"
              />
            ) : (
              <div className="w-[320px] h-[320px] rounded-md bg-[#15171B] flex items-center justify-center">
                <BarChart3 className="w-12 h-12 text-[#71717A]" />
              </div>
            )}
          </div>

          {/* Loading → skeleton under the thumbnail for the button area */}
          {previewQuery.isLoading && (
            <Skeleton className="h-10 w-[220px] bg-[rgba(255,255,255,0.06)] rounded-sm" />
          )}

          {/* Success → Open on Meta button */}
          {!previewQuery.isLoading && openOnMetaUrl && (
            <div className="flex flex-col items-center gap-2 w-full">
              <a
                href={openOnMetaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-[#FF3838] hover:bg-[#FF5555] text-white px-5 py-2.5 rounded-sm text-sm font-medium transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Open preview on Meta
              </a>
              <p className="text-[11px] text-[#71717A] text-center max-w-[380px]">
                Opens in a new tab. Meta previews require a Facebook Business login — if you're not signed in, you'll see the login page first.
              </p>
            </div>
          )}

          {/* Error → red-bordered alert with any fallback link we have */}
          {!previewQuery.isLoading && errorText && (
            <div
              className="w-full bg-[rgba(239,68,68,0.08)] border-l-4 border-[#EF4444] p-4 rounded-md"
              role="alert"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-[#EF4444] flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-white">Preview link unavailable</div>
                  <p className="text-xs text-[#A1A1AA] mt-1">{errorText}</p>
                  {adPermalink && (
                    <a
                      href={adPermalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-[#FF3838] hover:text-[#FF5555] mt-2"
                    >
                      <ExternalLink className="w-3 h-3" />
                      View ad on Facebook
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
