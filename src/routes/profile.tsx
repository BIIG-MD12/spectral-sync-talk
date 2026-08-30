import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, UserRound } from "lucide-react";
import { toast } from "sonner";
import { api, authToken } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "FluidTalk — Profile" },
      { name: "description", content: "Manage your FluidTalk profile and account settings." },
      { property: "og:title", content: "FluidTalk — Profile" },
      { property: "og:description", content: "Your FluidTalk profile and settings." },
    ],
  }),
  component: ProfileScreen,
});

function ProfileScreen() {
  const user = useAppStore((s) => s.user);
  const clearSession = useAppStore((s) => s.clearSession);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const signOut = async () => {
    try {
      await api.auth.signOut();
    } catch {
      // best-effort server sign-out
    } finally {
      await queryClient.cancelQueries();
      queryClient.clear();
      authToken.clear();
      clearSession();
      navigate({ to: "/", replace: true });
      toast.success("Signed out");
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center bg-background px-6 pb-24 pt-16">
      <div className="glass-panel grid size-20 place-items-center rounded-full">
        {user?.avatar_url ? (
          <img src={user.avatar_url} alt={user.display_name ?? "Profile"} className="size-20 rounded-full object-cover" />
        ) : (
          <UserRound className="size-9 text-primary" />
        )}
      </div>
      <h1 className="mt-4 text-xl font-semibold tracking-tight">
        {user?.display_name ?? "Your profile"}
      </h1>
      <p className="mt-1 text-[13px] text-muted-foreground">{user?.email ?? ""}</p>

      <button
        onClick={signOut}
        className="glass-panel mt-10 flex w-full max-w-sm items-center justify-center gap-2 rounded-2xl py-3 text-[15px] font-medium text-destructive"
      >
        <LogOut className="size-4" />
        Sign out
      </button>
    </main>
  );
}
