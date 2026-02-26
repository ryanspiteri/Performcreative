import { SettingsIcon, ExternalLink } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useEffect } from "react";

export default function Settings() {
  const { data: canvaStatus, refetch } = trpc.canva.isConnected.useQuery();
  const disconnectMutation = trpc.canva.disconnect.useMutation({
    onSuccess: () => {
      toast.success("Canva disconnected");
      refetch();
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("canva") === "connected") {
      toast.success("Canva connected successfully!");
      refetch();
      window.history.replaceState({}, "", "/settings");
    } else if (params.get("canva") === "error") {
      toast.error("Canva connection failed");
      window.history.replaceState({}, "", "/settings");
    }
  }, [refetch]);

  const getAuthUrl = trpc.canva.getAuthUrl.useQuery(undefined, {
    enabled: false, // Don't auto-fetch, only fetch on button click
  });

  const handleConnectCanva = async () => {
    try {
      const result = await getAuthUrl.refetch();
      if (result.data?.authUrl) {
        window.location.href = result.data.authUrl;
      } else {
        toast.error("Failed to generate Canva authorization URL");
      }
    } catch (err: any) {
      toast.error(`Connection failed: ${err.message}`);
    }
  };

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-white mb-6">Settings</h1>

      <div className="space-y-4">
        <div className="bg-[#191B1F] border border-white/5 rounded-xl p-6">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <SettingsIcon className="w-4 h-4" />
            Canva Integration
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-medium">Canva Account</p>
                <p className="text-sm text-gray-400">
                  {canvaStatus?.connected
                    ? "Connected - Generated variations will upload to Canva"
                    : "Not connected - Connect to enable automatic design creation"}
                </p>
              </div>
              {canvaStatus?.connected ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => disconnectMutation.mutate()}
                  disabled={disconnectMutation.isPending}
                >
                  Disconnect
                </Button>
              ) : (
                <Button
                  onClick={handleConnectCanva}
                  className="bg-[#7D2AE7] hover:bg-[#6B23C7] text-white"
                  size="sm"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Connect Canva
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="bg-[#191B1F] border border-white/5 rounded-xl p-6">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <SettingsIcon className="w-4 h-4" />
            API Configuration
          </h3>
          <div className="space-y-3">
            <SettingRow label="Foreplay API" status="Connected" />
            <SettingRow label="Anthropic Claude" status="Connected" />
            <SettingRow label="OpenAI Whisper" status="Connected" />
            <SettingRow label="ClickUp" status="Connected" />
          </div>
        </div>

        <div className="bg-[#191B1F] border border-white/5 rounded-xl p-6">
          <h3 className="text-white font-semibold mb-4">Pipeline Configuration</h3>
          <div className="space-y-3">
            <SettingRow label="Expert Review Threshold" status="90/100" />
            <SettingRow label="Max Review Rounds" status="3" />
            <SettingRow label="Scripts per Run" status="4 (2 DR + 2 UGC)" />
            <SettingRow label="Expert Panel Size" status="10 Experts" />
            <SettingRow label="Psychology Dimensions" status="25" />
          </div>
        </div>

        <div className="bg-[#191B1F] border border-white/5 rounded-xl p-6">
          <h3 className="text-white font-semibold mb-4">Foreplay Boards</h3>
          <div className="space-y-3">
            <SettingRow label="Video Board" status="#inspo" />
            <SettingRow label="Static Board" status="static_inspo (Competitor_inspo)" />
          </div>
        </div>

        <div className="bg-[#191B1F] border border-white/5 rounded-xl p-6">
          <h3 className="text-white font-semibold mb-4">ClickUp Integration</h3>
          <div className="space-y-3">
            <SettingRow label="Target Board" status="VIDEO AD BOARD" />
            <SettingRow label="Task Status" status="SCRIPT REVIEW" />
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingRow({ label, status }: { label: string; status: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
      <span className="text-gray-400 text-sm">{label}</span>
      <span className="text-emerald-400 text-sm font-medium">{status}</span>
    </div>
  );
}
