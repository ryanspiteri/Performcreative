import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => {
      window.location.reload();
    },
    onError: (err) => {
      toast.error(err.message || "Invalid credentials");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ username, password });
  };

  return (
    <div className="min-h-screen bg-[#01040A] flex flex-col items-center justify-center">
      <div className="flex flex-col items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-full bg-emerald-600/20 flex items-center justify-center">
          <Lock className="w-6 h-6 text-emerald-500" />
        </div>
        <h1 className="text-2xl font-bold text-white">ONEST Creative Pipeline</h1>
        <p className="text-sm text-gray-400">Sign in to access the pipeline dashboard</p>
      </div>

      <div className="w-full max-w-sm bg-[#191B1F] rounded-xl p-6 border border-white/5">
        <h2 className="text-lg font-semibold text-white mb-6">Sign In</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-gray-300 mb-1.5 block">Username</label>
            <Input
              type="text"
              placeholder="Enter username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="bg-[#01040A] border-white/10 text-white placeholder:text-gray-500"
            />
          </div>
          <div>
            <label className="text-sm text-gray-300 mb-1.5 block">Password</label>
            <Input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-[#01040A] border-white/10 text-white placeholder:text-gray-500"
            />
          </div>
          <Button
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending ? "Signing in..." : "Sign In"}
          </Button>
        </form>
      </div>
    </div>
  );
}
