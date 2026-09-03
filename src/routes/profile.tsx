import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Camera, Check, ChevronRight, Loader2, LogOut, Settings, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, authToken } from "@/lib/api";
import { ConnectionError } from "@/components/fluid/ConnectionError";
import { useRequireAuth } from "@/hooks/useSession";
import { useAppStore } from "@/store/useAppStore";
import type { Profile } from "@/types";

const SPRING = { type: "spring", stiffness: 300, damping: 25 } as const;

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Your profile — FluidTalk" },
      { name: "description", content: "Edit your FluidTalk name, username, bio and photo." },
      { property: "og:title", content: "Your profile — FluidTalk" },
      { property: "og:description", content: "Edit your FluidTalk profile." },
    ],
  }),
  component: ProfileScreen,
});

function ProfileScreen() {
  const session = useRequireAuth();
  const jwt = useAppStore((s) => s.jwt);
  const setSession = useAppStore((s) => s.setSession);
  const clearSession = useAppStore((s) => s.clearSession);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: profile, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["profile", "me"],
    queryFn: () => api.profiles.me(),
    enabled: session.isAuthenticated,
  });

  const [form, setForm] = useState({ display_name: "", username: "", bio: "", avatar_url: "" });
  useEffect(() => {
    if (!profile) return;
    setForm({
      display_name: profile.display_name ?? "",
      username: profile.username ?? "",
      bio: profile.bio ?? "",
      avatar_url: profile.avatar_url ?? "",
    });
  }, [profile]);

  const dirty =
    !!profile &&
    (form.display_name !== (profile.display_name ?? "") ||
      form.username !== (profile.username ?? "") ||
      form.bio !== (profile.bio ?? "") ||
      form.avatar_url !== (profile.avatar_url ?? ""));

  const save = useMutation({
    mutationFn: () =>
      api.profiles.update({
        display_name: form.display_name.trim(),
        username: form.username.trim().toLowerCase(),
        bio: form.bio.trim(),
        avatar_url: form.avatar_url.trim() || null,
      }),
    onSuccess: (updated: Profile) => {
      queryClient.setQueryData(["profile", "me"], updated);
      if (jwt) setSession(updated, jwt);
      toast.success("Profile saved");
    },
    onError: (err: Error) => toast.error(err.message || "Could not save profile"),
  });

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
    <main className="relative min-h-screen bg-background px-5 pb-28 pt-10">
      <div className="halo pointer-events-none absolute inset-x-0 top-0 h-72" />

      <header className="relative z-10 flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight text-glow">Profile</h1>
        <Link
          to="/settings"
          aria-label="Settings"
          className="glass-panel grid size-10 place-items-center rounded-full text-primary"
        >
          <Settings className="size-[18px]" />
        </Link>
      </header>

      {isError && (
        <div className="relative z-10 mt-6 -mx-4">
          <ConnectionError detail={(error as Error)?.message} onRetry={() => void refetch()} />
        </div>
      )}

      {(isLoading || session.isLoading) && !isError && (
        <div className="flex justify-center py-16">
          <Loader2 className="size-5 animate-spin text-primary" />
        </div>
      )}

      {profile && (
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING}
          className="relative z-10 mt-6"
        >
          <div className="flex flex-col items-center">
            <div className="relative">
              <div className="glass-panel grid size-24 place-items-center overflow-hidden rounded-full ring-2 ring-primary/40">
                {form.avatar_url ? (
                  <img src={form.avatar_url} alt={form.display_name || "Profile"} className="size-24 object-cover" />
                ) : (
                  <UserRound className="size-10 text-primary" />
                )}
              </div>
              <span className="absolute -bottom-1 -right-1 grid size-8 place-items-center rounded-full bg-primary text-primary-foreground">
                <Camera className="size-4" />
              </span>
            </div>
            <p className="mt-3 text-[13px] text-muted-foreground">{profile.email}</p>
          </div>

          <div className="glass-panel mt-6 divide-y divide-border/60 rounded-3xl">
            <Field label="Name">
              <input
                value={form.display_name}
                onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
                className="w-full bg-transparent text-right text-[15px] outline-none"
                placeholder="Your name"
              />
            </Field>
            <Field label="Username">
              <div className="flex items-center justify-end gap-0.5">
                <span className="text-[15px] text-muted-foreground">@</span>
                <input
                  value={form.username}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, username: e.target.value.replace(/[^a-z0-9_.]/gi, "") }))
                  }
                  className="w-full bg-transparent text-[15px] outline-none"
                  placeholder="username"
                />
              </div>
            </Field>
            <Field label="Photo URL">
              <input
                value={form.avatar_url}
                onChange={(e) => setForm((f) => ({ ...f, avatar_url: e.target.value }))}
                className="w-full bg-transparent text-right text-[13px] outline-none"
                placeholder="https://…"
              />
            </Field>
            <div className="px-4 py-3">
              <p className="text-[13px] text-muted-foreground">Bio</p>
              <textarea
                value={form.bio}
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value.slice(0, 160) }))}
                rows={2}
                placeholder="Say something about yourself"
                className="mt-1 w-full resize-none bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
              />
              <p className="text-right text-[11px] text-muted-foreground">{form.bio.length}/160</p>
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.97 }}
            transition={SPRING}
            disabled={!dirty || save.isPending || !form.display_name.trim() || !form.username.trim()}
            onClick={() => save.mutate()}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-[15px] font-medium text-primary-foreground disabled:opacity-40"
          >
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Save changes
          </motion.button>

          <Link
            to="/settings"
            className="glass-panel mt-6 flex items-center justify-between rounded-2xl px-4 py-3.5 text-[15px]"
          >
            <span className="flex items-center gap-3">
              <Settings className="size-4 text-primary" />
              Privacy, notifications & blocked users
            </span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Link>

          <button
            onClick={signOut}
            className="glass-panel mt-3 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-[15px] font-medium text-destructive"
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </motion.section>
      )}
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-4 px-4 py-3">
      <span className="w-24 shrink-0 text-[13px] text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1">{children}</span>
    </label>
  );
}
