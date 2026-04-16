import { SettingsIcon, ExternalLink, Users, MoreHorizontal, Plus, KeyRound, PenTool, Pencil, Trash2, Database, ChevronUp, ChevronDown, X } from "lucide-react";
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
import { MetaConnectionCard } from "@/components/settings/MetaConnectionCard";

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
    } else if (params.get("meta") === "connected") {
      toast.success("Facebook connected — inline ad previews enabled");
      window.history.replaceState({}, "", "/settings");
    } else if (params.get("meta") === "error") {
      const message = params.get("message") ?? "Unknown error";
      toast.error(`Facebook connection failed: ${message}`);
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

        {isAdmin && <MetaConnectionCard />}

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

        {isAdmin && <ScriptGeneratorSection />}
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

// ─── Script Generator Settings ───────────────────────────────────────────────

function ScriptGeneratorSection() {
  const utils = trpc.useUtils();

  const { data: structures = [], isLoading: loadingStructures } = trpc.scriptGenerator.listStructures.useQuery();
  const { data: audiences = [], isLoading: loadingAudiences } = trpc.scriptGenerator.listAudiences.useQuery();

  const seedMutation = trpc.scriptGenerator.seedDefaults.useMutation({
    onSuccess: (data) => {
      toast.success(`Seeded ${data.structuresSeeded} structures, ${data.audiencesSeeded} audiences`);
      utils.scriptGenerator.listStructures.invalidate();
      utils.scriptGenerator.listAudiences.invalidate();
    },
    onError: (err: any) => toast.error(`Seed failed: ${err.message}`),
  });

  const deleteStructureMutation = trpc.scriptGenerator.deleteStructure.useMutation({
    onSuccess: () => { toast.success("Structure deleted"); utils.scriptGenerator.listStructures.invalidate(); },
    onError: (err: any) => toast.error(`Delete failed: ${err.message}`),
  });

  const deleteAudienceMutation = trpc.scriptGenerator.deleteAudience.useMutation({
    onSuccess: () => { toast.success("Audience deleted"); utils.scriptGenerator.listAudiences.invalidate(); },
    onError: (err: any) => toast.error(`Delete failed: ${err.message}`),
  });

  const [editStructure, setEditStructure] = useState<any | null>(null);
  const [editAudience, setEditAudience] = useState<any | null>(null);
  const [addStructureOpen, setAddStructureOpen] = useState(false);
  const [addAudienceOpen, setAddAudienceOpen] = useState(false);
  const [confirmDeleteStructure, setConfirmDeleteStructure] = useState<string | null>(null);
  const [confirmDeleteAudience, setConfirmDeleteAudience] = useState<string | null>(null);

  const isSeeded = structures.length > 0 || audiences.length > 0;

  return (
    <div className="bg-[#191B1F] border border-white/5 rounded-xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <PenTool className="w-4 h-4" />
          Script Generator
        </h3>
        {!isSeeded && (
          <Button
            size="sm"
            variant="outline"
            className="border-white/10 text-gray-300 hover:text-white hover:bg-white/5"
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
          >
            {seedMutation.isPending ? <><span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin mr-2 inline-block" />Seeding...</> : <><Database className="w-3.5 h-3.5 mr-1.5" />Seed Defaults</>}
          </Button>
        )}
      </div>

      {/* Structures */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-gray-400 text-sm font-medium">Script Structures</p>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-gray-400 hover:text-white"
            onClick={() => setAddStructureOpen(true)}
          >
            <Plus className="w-3.5 h-3.5 mr-1" />Add
          </Button>
        </div>

        {loadingStructures ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <div key={i} className="h-9 bg-white/5 rounded animate-pulse" />)}
          </div>
        ) : structures.length === 0 ? (
          <div className="border border-dashed border-white/10 rounded-lg p-4 text-center">
            <p className="text-gray-600 text-sm">No structures configured</p>
            <p className="text-gray-700 text-xs mt-1">Seed defaults or add manually</p>
            {!isSeeded && (
              <Button
                size="sm"
                variant="ghost"
                className="mt-2 text-xs text-gray-500 hover:text-white"
                onClick={() => seedMutation.mutate()}
                disabled={seedMutation.isPending}
              >
                <Database className="w-3 h-3 mr-1" />Seed Defaults
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {structures.map((s: any) => (
              <div key={s.structureId} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/5 group">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-[10px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded shrink-0">{s.structureId}</span>
                  <span className="text-sm text-gray-300 truncate">{s.name}</span>
                  <span className="text-[10px] text-gray-600 bg-white/5 px-1.5 py-0.5 rounded shrink-0">{s.category}</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-500 hover:text-white" onClick={() => setEditStructure(s)}>
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-500 hover:text-red-400" onClick={() => setConfirmDeleteStructure(s.structureId)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Audiences */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-gray-400 text-sm font-medium">Audience Archetypes</p>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-gray-400 hover:text-white"
            onClick={() => setAddAudienceOpen(true)}
          >
            <Plus className="w-3.5 h-3.5 mr-1" />Add
          </Button>
        </div>

        {loadingAudiences ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <div key={i} className="h-9 bg-white/5 rounded animate-pulse" />)}
          </div>
        ) : audiences.length === 0 ? (
          <div className="border border-dashed border-white/10 rounded-lg p-4 text-center">
            <p className="text-gray-600 text-sm">No audiences configured</p>
          </div>
        ) : (
          <div className="space-y-1">
            {audiences.map((a: any) => (
              <div key={a.audienceId} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/5 group">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm text-gray-300 truncate">{a.label}</span>
                  <span className="text-[10px] text-gray-600 truncate hidden sm:block">{String(a.data?.lifeContext || "").slice(0, 50)}…</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-500 hover:text-white" onClick={() => setEditAudience(a)}>
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-500 hover:text-red-400" onClick={() => setConfirmDeleteAudience(a.audienceId)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Structure Modal */}
      {editStructure && (
        <EditStructureModal
          structure={editStructure}
          onClose={() => setEditStructure(null)}
          onSaved={() => { setEditStructure(null); utils.scriptGenerator.listStructures.invalidate(); }}
        />
      )}

      {/* Edit Audience Modal */}
      {editAudience && (
        <EditAudienceModal
          audience={editAudience}
          onClose={() => setEditAudience(null)}
          onSaved={() => { setEditAudience(null); utils.scriptGenerator.listAudiences.invalidate(); }}
        />
      )}

      {/* Add Structure Modal */}
      {addStructureOpen && (
        <EditStructureModal
          structure={null}
          onClose={() => setAddStructureOpen(false)}
          onSaved={() => { setAddStructureOpen(false); utils.scriptGenerator.listStructures.invalidate(); }}
        />
      )}

      {/* Add Audience Modal */}
      {addAudienceOpen && (
        <EditAudienceModal
          audience={null}
          onClose={() => setAddAudienceOpen(false)}
          onSaved={() => { setAddAudienceOpen(false); utils.scriptGenerator.listAudiences.invalidate(); }}
        />
      )}

      {/* Delete confirmations */}
      <AlertDialog open={!!confirmDeleteStructure} onOpenChange={o => !o && setConfirmDeleteStructure(null)}>
        <AlertDialogContent className="bg-[#0D0F12] border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete structure?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              This cannot be undone. Existing pipeline runs that used this structure will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 text-gray-300">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => { if (confirmDeleteStructure) deleteStructureMutation.mutate({ structureId: confirmDeleteStructure }); setConfirmDeleteStructure(null); }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmDeleteAudience} onOpenChange={o => !o && setConfirmDeleteAudience(null)}>
        <AlertDialogContent className="bg-[#0D0F12] border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete audience?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              This cannot be undone. Existing pipeline runs will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 text-gray-300">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => { if (confirmDeleteAudience) deleteAudienceMutation.mutate({ audienceId: confirmDeleteAudience }); setConfirmDeleteAudience(null); }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EditStructureModal({
  structure,
  onClose,
  onSaved,
}: {
  structure: any | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!structure;
  const [structureId, setStructureId] = useState(structure?.structureId || "");
  const [name, setName] = useState(structure?.name || "");
  const [category, setCategory] = useState(structure?.category || "DR");
  const [awarenessLevel, setAwarenessLevel] = useState(structure?.data?.awarenessLevel || "");
  const [psychologicalLever, setPsychologicalLever] = useState(structure?.data?.psychologicalLever || "");
  const [whyItConverts, setWhyItConverts] = useState(structure?.data?.whyItConverts || "");
  const [funnelStages, setFunnelStages] = useState<string[]>(structure?.data?.funnelStages || ["cold"]);
  const [stages, setStages] = useState<Array<{ stage: string; function: string }>>(structure?.data?.stages || []);

  const addStage = () => setStages(prev => [...prev, { stage: "", function: "" }]);
  const removeStage = (i: number) => setStages(prev => prev.filter((_, idx) => idx !== i));
  const updateStage = (i: number, field: "stage" | "function", value: string) =>
    setStages(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s));
  const moveStage = (i: number, direction: -1 | 1) => {
    const newIdx = i + direction;
    if (newIdx < 0 || newIdx >= stages.length) return;
    setStages(prev => {
      const copy = [...prev];
      [copy[i], copy[newIdx]] = [copy[newIdx], copy[i]];
      return copy;
    });
  };

  const createMutation = trpc.scriptGenerator.createStructure.useMutation({
    onSuccess: onSaved,
    onError: (err: any) => toast.error(err.message),
  });
  const updateMutation = trpc.scriptGenerator.updateStructure.useMutation({
    onSuccess: onSaved,
    onError: (err: any) => toast.error(err.message),
  });

  const handleSave = () => {
    const data = { funnelStages, awarenessLevel, psychologicalLever, whyItConverts, stages };
    if (isEdit) {
      updateMutation.mutate({ structureId, name, category, data });
    } else {
      createMutation.mutate({ structureId, name, category, data });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const funnelOptions = ["cold", "warm", "retargeting", "retention"];

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="bg-[#0D0F12] border-white/10 max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">{isEdit ? "Edit Structure" : "Add Structure"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">ID</label>
              <Input
                value={structureId}
                onChange={e => setStructureId(e.target.value.toUpperCase())}
                placeholder="DR-1"
                disabled={isEdit}
                className="bg-[#01040A] border-white/10 text-white h-9 font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Category</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="bg-[#01040A] border-white/10 text-white h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0D0F14] border-white/10">
                  {["DR", "UGC", "FOUNDER", "BRAND"].map(c => (
                    <SelectItem key={c} value={c} className="text-white">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Name</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Problem → Agitate → Solve" className="bg-[#01040A] border-white/10 text-white h-9" />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Funnel Stages</label>
            <div className="flex gap-2 flex-wrap">
              {funnelOptions.map(f => (
                <button
                  key={f}
                  onClick={() => setFunnelStages(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])}
                  className={`text-xs px-2 py-1 rounded border transition-colors ${funnelStages.includes(f) ? "border-[#FF3838]/50 bg-[#FF3838]/10 text-[#FF3838]" : "border-white/10 text-gray-500 hover:text-gray-300"}`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Awareness Level</label>
            <Input value={awarenessLevel} onChange={e => setAwarenessLevel(e.target.value)} placeholder="Problem Aware" className="bg-[#01040A] border-white/10 text-white h-9" />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Psychological Lever</label>
            <Input value={psychologicalLever} onChange={e => setPsychologicalLever(e.target.value)} placeholder="Loss aversion" className="bg-[#01040A] border-white/10 text-white h-9" />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Why It Converts</label>
            <textarea
              value={whyItConverts}
              onChange={e => setWhyItConverts(e.target.value)}
              placeholder="Explain why this structure drives conversions..."
              rows={3}
              className="w-full bg-[#01040A] border border-white/10 text-white rounded-md px-3 py-2 text-sm outline-none resize-none"
            />
          </div>
          {/* Stages sequence editor */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-gray-400 block">Stages</label>
              <button onClick={addStage} className="text-xs text-[#FF3838] hover:text-[#FF3838]/80 flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add Stage
              </button>
            </div>
            {stages.length === 0 && (
              <p className="text-xs text-gray-600 italic">No stages defined. Add stages to define the ad sequence.</p>
            )}
            <div className="space-y-2">
              {stages.map((s, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="flex flex-col gap-0.5 pt-1">
                    <button onClick={() => moveStage(i, -1)} disabled={i === 0} className="text-gray-500 hover:text-white disabled:opacity-20 disabled:hover:text-gray-500"><ChevronUp className="w-3.5 h-3.5" /></button>
                    <button onClick={() => moveStage(i, 1)} disabled={i === stages.length - 1} className="text-gray-500 hover:text-white disabled:opacity-20 disabled:hover:text-gray-500"><ChevronDown className="w-3.5 h-3.5" /></button>
                  </div>
                  <div className="flex-1 grid grid-cols-[1fr_2fr] gap-2">
                    <Input
                      value={s.stage}
                      onChange={e => updateStage(i, "stage", e.target.value)}
                      placeholder="Stage name"
                      className="bg-[#01040A] border-white/10 text-white h-8 text-xs"
                    />
                    <Input
                      value={s.function}
                      onChange={e => updateStage(i, "function", e.target.value)}
                      placeholder="Stage function / purpose"
                      className="bg-[#01040A] border-white/10 text-white h-8 text-xs"
                    />
                  </div>
                  <button onClick={() => removeStage(i)} className="text-gray-500 hover:text-red-400 pt-1.5">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            {stages.length > 0 && (
              <p className="text-[10px] text-gray-600 mt-1.5">
                {stages.map(s => s.stage || "…").join(" → ")}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="border-white/10 text-gray-300" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={isPending || !structureId || !name} className="bg-[#FF3838] hover:bg-[#FF3838]/90 text-white">
              {isPending ? <><span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin mr-2 inline-block" />Saving...</> : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditAudienceModal({
  audience,
  onClose,
  onSaved,
}: {
  audience: any | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!audience;
  const [audienceId, setAudienceId] = useState(audience?.audienceId || "");
  const [label, setLabel] = useState(audience?.label || "");
  const [lifeContext, setLifeContext] = useState(audience?.data?.lifeContext || "");
  const [languageRegister, setLanguageRegister] = useState(audience?.data?.languageRegister || "");
  const [preProductObjection, setPreProductObjection] = useState(audience?.data?.preProductObjection || "");

  const createMutation = trpc.scriptGenerator.createAudience.useMutation({
    onSuccess: onSaved,
    onError: (err: any) => toast.error(err.message),
  });
  const updateMutation = trpc.scriptGenerator.updateAudience.useMutation({
    onSuccess: onSaved,
    onError: (err: any) => toast.error(err.message),
  });

  const handleSave = () => {
    const data = { lifeContext, languageRegister, preProductObjection };
    if (isEdit) {
      updateMutation.mutate({ audienceId, label, data });
    } else {
      createMutation.mutate({ audienceId, label, data });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="bg-[#0D0F12] border-white/10 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white">{isEdit ? "Edit Audience" : "Add Audience"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">ID</label>
              <Input
                value={audienceId}
                onChange={e => setAudienceId(e.target.value)}
                placeholder="FitnessEnthusiast"
                disabled={isEdit}
                className="bg-[#01040A] border-white/10 text-white h-9"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Label</label>
              <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="Fitness Enthusiast" className="bg-[#01040A] border-white/10 text-white h-9" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Life Context</label>
            <textarea
              value={lifeContext}
              onChange={e => setLifeContext(e.target.value)}
              rows={3}
              placeholder="Describe their daily life, goals, and environment..."
              className="w-full bg-[#01040A] border border-white/10 text-white rounded-md px-3 py-2 text-sm outline-none resize-none"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Language Register</label>
            <textarea
              value={languageRegister}
              onChange={e => setLanguageRegister(e.target.value)}
              rows={2}
              placeholder="How they speak — vocabulary, tone, references..."
              className="w-full bg-[#01040A] border border-white/10 text-white rounded-md px-3 py-2 text-sm outline-none resize-none"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Pre-product Objection</label>
            <textarea
              value={preProductObjection}
              onChange={e => setPreProductObjection(e.target.value)}
              rows={2}
              placeholder="What they're sceptical about before trying the product..."
              className="w-full bg-[#01040A] border border-white/10 text-white rounded-md px-3 py-2 text-sm outline-none resize-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="border-white/10 text-gray-300" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={isPending || !audienceId || !label} className="bg-[#FF3838] hover:bg-[#FF3838]/90 text-white">
              {isPending ? <><span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin mr-2 inline-block" />Saving...</> : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
