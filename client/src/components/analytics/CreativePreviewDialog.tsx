/**
 * Creative preview dialog.
 *
 * Render priority (picks the first available):
 *   1. sourceUrl present → native HTML5 <video> playing the ad inline. This
 *      only works when an admin has connected their Facebook account via
 *      /settings and the creative is a video (see server/routers/meta.ts).
 *   2. Creative is an image → large <img> showing the thumbnail at full size.
 *   3. Fallback → "Open preview on Meta" button that opens the shareable link
 *      (or iframe src / ad permalink) in a new tab.
 *
 * Why native video when possible: opening in a new tab requires a FB Business
 * login on the user's machine and loses context. Native playback keeps the
 * review flow inside Perform. For non-admins or when the token is missing,
 * the fallback still works.
 *
 * Why no iframe: Meta's preview iframe and fb.me shareable links both require
 * a Facebook login session cookie that third-party iframes don't get. Past
 * attempts resulted in a broken-doc icon rendering inside the dialog. See
 * PR #5 for the full diagnosis.
 */
import { useMemo, useState, useEffect } from "react";
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
  const sourceUrl = previewQuery.data?.sourceUrl ?? null;
  const shareableLink = previewQuery.data?.previewShareableLink ?? null;
  const iframeSrc = previewQuery.data?.iframeSrc ?? null;
  const adPermalink = previewQuery.data?.adPermalinkUrl ?? null;
  const creativeType = previewQuery.data?.creativeType ?? null;

  const openOnMetaUrl = useMemo(() => {
    return shareableLink ?? adPermalink ?? iframeSrc ?? null;
  }, [shareableLink, adPermalink, iframeSrc]);

  // Reset video error state each time the dialog opens for a different creative
  // so a previous failure doesn't stick after the user clicks on another ad.
  const [videoFailed, setVideoFailed] = useState(false);
  useEffect(() => {
    if (open) setVideoFailed(false);
  }, [open, creativeAssetId]);

  const errorText = useMemo(() => {
    if (!previewQuery.error) return null;
    const msg = (previewQuery.error as any)?.message ?? "Unknown error";
    return String(msg);
  }, [previewQuery.error]);

  // Decide which render branch to show. Video path wins if available AND the
  // video element hasn't failed. Image path wins for image creatives WITH a
  // thumbnail URL. If the creative is labeled "image" but has no thumbnail
  // (e.g. Meta creative backfill errored for this ad), fall through to the
  // "Open on Meta" fallback which renders a placeholder + link rather than
  // rendering literally nothing.
  const canPlayInline = !!sourceUrl && !videoFailed;
  const canRenderImage = creativeType === "image" && !!thumbnailUrl;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-[#0A0B0D] border-[rgba(255,255,255,0.10)] text-white max-w-[600px] p-0"
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
          {/* Loading → skeleton matching the video aspect ratio */}
          {previewQuery.isLoading && (
            <div
              className="bg-[#15171B] rounded-md"
              style={{ width: 540, height: 540 }}
              aria-busy="true"
            >
              <Skeleton className="w-full h-full bg-[rgba(255,255,255,0.04)] rounded-md" />
            </div>
          )}

          {/* Path 1: native video playback (preferred — requires connected Meta admin token) */}
          {!previewQuery.isLoading && canPlayInline && sourceUrl && (
            <div className="w-full flex flex-col items-center gap-2">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video
                key={sourceUrl}
                src={sourceUrl}
                poster={thumbnailUrl ?? undefined}
                controls
                autoPlay
                playsInline
                className="max-w-full max-h-[600px] rounded-md bg-[#15171B]"
                style={{ maxWidth: 540 }}
                onError={() => {
                  // Signed source URL may have expired. Refetch once; if the
                  // refetched URL also fails, fall through to the open-on-Meta
                  // button.
                  setVideoFailed(true);
                  void previewQuery.refetch();
                }}
              />
              <p className="text-[11px] text-[#71717A] text-center">
                Playing via Meta user-scope token · the ad renders exactly as it does on Facebook
              </p>
            </div>
          )}

          {/* Path 2: image creative rendered full-size (requires thumbnailUrl) */}
          {!previewQuery.isLoading && !canPlayInline && canRenderImage && (
            <img
              src={thumbnailUrl!}
              alt={creativeName}
              className="max-w-full max-h-[540px] rounded-md object-contain bg-[#15171B]"
            />
          )}

          {/* Path 3: fallback thumbnail + Open on Meta button.
              Fires when: not playing a video, not rendering a full-size image
              (either not an image creative, or an image creative whose thumbnail
              didn't get backfilled by Meta). Shows a thumbnail placeholder + a
              permalink so the user still has SOMETHING to interact with. */}
          {!previewQuery.isLoading && !canPlayInline && !canRenderImage && (
            <>
              <div className="w-full flex justify-center">
                {thumbnailUrl ? (
                  <img
                    src={thumbnailUrl}
                    alt={creativeName}
                    className="max-w-full max-h-[420px] rounded-md object-contain bg-[#15171B]"
                  />
                ) : (
                  <div className="w-[320px] h-[320px] rounded-md bg-[#15171B] flex items-center justify-center">
                    <BarChart3 className="w-12 h-12 text-[#71717A]" />
                  </div>
                )}
              </div>
              {openOnMetaUrl && (
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
                  <p className="text-[11px] text-[#71717A] text-center max-w-[420px]">
                    {videoFailed
                      ? "Video source expired — opening on Meta in a new tab"
                      : "Opens in a new tab. Connect Facebook in Settings to enable inline playback."}
                  </p>
                </div>
              )}
            </>
          )}

          {/* Always show an "Open on Meta" secondary link when inline playback is active */}
          {!previewQuery.isLoading && canPlayInline && openOnMetaUrl && (
            <a
              href={openOnMetaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-[#71717A] hover:text-[#A1A1AA]"
            >
              <ExternalLink className="w-3 h-3" />
              Open on Meta
            </a>
          )}

          {/* Error state */}
          {!previewQuery.isLoading && errorText && (
            <div
              className="w-full bg-[rgba(239,68,68,0.08)] border-l-4 border-[#EF4444] p-4 rounded-md"
              role="alert"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-[#EF4444] flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-white">Preview unavailable</div>
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
