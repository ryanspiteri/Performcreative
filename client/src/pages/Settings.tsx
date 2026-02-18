import { Settings as SettingsIcon } from "lucide-react";

export default function Settings() {
  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-white mb-6">Settings</h1>

      <div className="space-y-4">
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
