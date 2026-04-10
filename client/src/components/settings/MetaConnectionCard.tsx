/**
 * Meta Facebook Login connection card for /settings.
 *
 * Mirrors the Canva integration card visual style. Shows:
 *   - Connection status + connected user name (fetched from tRPC isConnected)
 *   - Expiry countdown with color coding (green >14d, yellow 7-14d, red <7d)
 *   - Connect/Disconnect/Reconnect buttons
 *
 * The "Connect Facebook" button triggers a window.location.href redirect to
 * the Meta OAuth dialog. After consent, Meta redirects to /api/meta/callback
 * which in turn redirects to /settings?meta=connected|error. Settings.tsx
 * handles the query-param toast.
 */
import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { SettingsIcon, ExternalLink, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export function MetaConnectionCard() {
  const metaStatus = trpc.meta.isConnected.useQuery();
  const getAuthUrl = trpc.meta.getAuthUrl.useQuery(undefined, { enabled: false });
  const disconnectMutation = trpc.meta.disconnect.useMutation({
    onSuccess: () => {
      toast.success("Meta disconnected");
      metaStatus.refetch();
    },
    onError: (err) => toast.error(`Disconnect failed: ${err.message}`),
  });

  const handleConnect = async () => {
    try {
      const result = await getAuthUrl.refetch();
      if (result.data?.authUrl) {
        window.location.href = result.data.authUrl;
      } else {
        toast.error("Failed to generate Facebook authorization URL");
      }
    } catch (err: any) {
      toast.error(`Connection failed: ${err.message}`);
    }
  };

  const isConnected = metaStatus.data?.connected === true;
  const expiresAt = isConnected && metaStatus.data?.expiresAt ? new Date(metaStatus.data.expiresAt) : null;
  const connectedName = isConnected ? metaStatus.data?.name : null;

  const expiryInfo = useMemo(() => {
    if (!expiresAt) return null;
    const now = new Date();
    const ms = expiresAt.getTime() - now.getTime();
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    if (days < 0) return { text: "Token expired — reconnect", colorClass: "text-[#EF4444]" };
    if (days < 7) return { text: `Expires in ${days}d — reconnect soon`, colorClass: "text-[#EF4444]" };
    if (days < 14) return { text: `Expires in ${days}d`, colorClass: "text-[#F59E0B]" };
    return { text: `Expires in ${days}d`, colorClass: "text-[#A1A1AA]" };
  }, [expiresAt]);

  return (
    <div className="bg-[#191B1F] border border-white/5 rounded-xl p-6">
      <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
        <SettingsIcon className="w-4 h-4" />
        Facebook / Meta Integration
      </h3>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2">
              <p className="text-white font-medium">Meta Ads Account</p>
              {isConnected ? (
                <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
              ) : (
                <AlertCircle className="w-4 h-4 text-[#71717A]" />
              )}
            </div>
            <p className="text-sm text-gray-400 mt-1">
              {isConnected && connectedName
                ? `Connected as ${connectedName} — enables inline video playback in /analytics`
                : isConnected
                  ? "Connected — enables inline video playback in /analytics"
                  : "Not connected — /analytics previews will open on Meta in a new tab"}
            </p>
            {expiryInfo && (
              <p className={`text-xs font-mono mt-1 ${expiryInfo.colorClass}`}>{expiryInfo.text}</p>
            )}
          </div>
          {isConnected ? (
            <div className="flex gap-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleConnect}
                className="border-[rgba(255,255,255,0.10)] text-[#A1A1AA]"
              >
                Reconnect
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
              >
                Disconnect
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleConnect}
              className="bg-[#1877F2] hover:bg-[#0F65D4] text-white flex-shrink-0"
              size="sm"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Connect Facebook
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
