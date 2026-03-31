import { SettingsIcon, ExternalLink, Users, MoreHorizontal, Plus, KeyRound } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";

export default function Settings() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
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
    enabled: false,
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
        {isAdmin && <TeamSection />}

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

function TeamSection() {
  const utils = trpc.useUtils();
  const { data: members = [] } = trpc.team.list.useQuery();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState<number | null>(null);
  const [resetUserId, setResetUserId] = useState<number | null>(null);

  // Invite form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");

  // Reset password state
  const [newPassword, setNewPassword] = useState("");

  const inviteMutation = trpc.team.invite.useMutation({
    onSuccess: () => {
      toast.success("Team member added");
      utils.team.list.invalidate();
      setInviteOpen(false);
      setName("");
      setEmail("");
      setPassword("");
      setRole("user");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateRoleMutation = trpc.team.updateRole.useMutation({
    onSuccess: () => {
      toast.success("Role updated");
      utils.team.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const removeMutation = trpc.team.remove.useMutation({
    onSuccess: () => {
      toast.success("Team member removed");
      utils.team.list.invalidate();
      setRemoveConfirm(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const resetPasswordMutation = trpc.team.resetPassword.useMutation({
    onSuccess: () => {
      toast.success("Password reset");
      setResetOpen(false);
      setResetUserId(null);
      setNewPassword("");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    inviteMutation.mutate({ name, email, password, role });
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (resetUserId) {
      resetPasswordMutation.mutate({ userId: resetUserId, newPassword });
    }
  };

  return (
    <>
      <div className="bg-[#191B1F] border border-white/5 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Users className="w-4 h-4" />
            Team
          </h3>
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <Plus className="w-4 h-4 mr-1" />
                Add Member
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#191B1F] border-white/10">
              <DialogHeader>
                <DialogTitle className="text-white">Add Team Member</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleInvite} className="space-y-4">
                <div>
                  <label className="text-sm text-gray-300 mb-1.5 block">Name</label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Full name"
                    required
                    className="bg-[#01040A] border-white/10 text-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-300 mb-1.5 block">Email</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@example.com"
                    required
                    className="bg-[#01040A] border-white/10 text-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-300 mb-1.5 block">Password</label>
                  <Input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    required
                    minLength={8}
                    className="bg-[#01040A] border-white/10 text-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-300 mb-1.5 block">Role</label>
                  <Select value={role} onValueChange={(v) => setRole(v as "user" | "admin")}>
                    <SelectTrigger className="bg-[#01040A] border-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={inviteMutation.isPending}
                >
                  {inviteMutation.isPending ? "Adding..." : "Add Member"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-2">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-white/[0.03]"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white text-sm font-medium shrink-0">
                  {(member.name || member.email || "?")[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-white text-sm font-medium truncate">
                    {member.name || "Unnamed"}
                  </p>
                  <p className="text-gray-500 text-xs truncate">{member.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge
                  variant={member.role === "admin" ? "default" : "secondary"}
                  className={
                    member.role === "admin"
                      ? "bg-emerald-600/20 text-emerald-400 border-0"
                      : "bg-white/5 text-gray-400 border-0"
                  }
                >
                  {member.role}
                </Badge>
                {member.openId !== "onest-admin-user" && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-400 hover:text-white">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-[#191B1F] border-white/10">
                      <DropdownMenuItem
                        onClick={() =>
                          updateRoleMutation.mutate({
                            userId: member.id,
                            role: member.role === "admin" ? "user" : "admin",
                          })
                        }
                        className="text-gray-300 focus:text-white focus:bg-white/10"
                      >
                        Make {member.role === "admin" ? "User" : "Admin"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setResetUserId(member.id);
                          setResetOpen(true);
                        }}
                        className="text-gray-300 focus:text-white focus:bg-white/10"
                      >
                        <KeyRound className="w-3.5 h-3.5 mr-2" />
                        Reset Password
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setRemoveConfirm(member.id)}
                        className="text-red-400 focus:text-red-300 focus:bg-red-500/10"
                      >
                        Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          ))}
          {members.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-4">No team members yet</p>
          )}
        </div>
      </div>

      {/* Reset Password Dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="bg-[#191B1F] border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">Reset Password</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="text-sm text-gray-300 mb-1.5 block">New Password</label>
              <Input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 8 characters"
                required
                minLength={8}
                className="bg-[#01040A] border-white/10 text-white"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={resetPasswordMutation.isPending}
            >
              {resetPasswordMutation.isPending ? "Resetting..." : "Reset Password"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Remove Confirmation */}
      <AlertDialog open={removeConfirm !== null} onOpenChange={(open) => !open && setRemoveConfirm(null)}>
        <AlertDialogContent className="bg-[#191B1F] border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Remove team member?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              They will lose access immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 text-gray-300">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => removeConfirm && removeMutation.mutate({ userId: removeConfirm })}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
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
