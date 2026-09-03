import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ChevronLeft, Download, Loader2, ShieldBan, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { api, authToken } from "@/lib/api";
import { ConnectionError } from "@/components/fluid/ConnectionError";
import { useRequireAuth } from "@/hooks/useSession";
import { useAppStore } from "@/store/useAppStore";
import type { NotificationSettings, PrivacySettings, UserSettings, Visibility } from "@/types";
import { cn } from "@/lib/utils";

const SPRING = { type: "spring", stiffness: 300, damping: 25 } as const;
const VISIBILITY: Visibility[] = ["everyone", "contacts", "nobody"];

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — FluidTalk" },
      { name: "description", content: "Privacy, notifications, blocked users and account controls for FluidTalk." },
      { property: "og:title", content: "Settings — FluidTalk" },
      { property: "og:description", content: "Manage privacy, notifications and blocked users." },
    ],
  }),
  component: SettingsScreen,
});

function SettingsScreen() {
  const session = useRequireAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const clearSession = useAppStore((s) => s.clearSession);

  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.settings.get(),
    enabled: session.isAuthenticated,
  });
  const blocked = useQuery({
    queryKey: ["blocked"],
    queryFn: () => api.blocked.list(),
    enabled: session.isAuthenticated,
  });

  const applySettings = (next: UserSettings) => queryClient.setQueryData(["settings"], next);

  const privacy = useMutation({
    mutationFn: (patch: Partial<PrivacySettings>) => api.settings.updatePrivacy(patch),
    onSuccess: applySettings,
    onError: (e: Error) => toast.error(e.message || "Could not update privacy"),
  });
  const notifications = useMutation({
    mutationFn: (patch: Partial<NotificationSettings>) => api.settings.updateNotifications(patch),
    onSuccess: applySettings,
    onError: (e: Error) => toast.error(e.message || "Could not update notifications"),
  });
  const unblock = useMutation({
    mutationFn: (id: string) => api.blocked.unblock(id),
    onSuccess: (list) => {
      queryClient.setQueryData(["blocked"], list);
      toast.success("Unblocked");
    },
    onError: (e: Error) => toast.error(e.message || "Could not unblock"),
  });

  const exportData = useMutation({
    mutationFn: () => api.account.exportData(),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "fluidtalk-export.json";
      a.click();
      URL.revokeObjectURL(url);
    },
    onError: (e: Error) => toast.error(e.message || "Export failed"),
  });

  const deleteAccount = useMutation({
    mutationFn: () => api.account.remove(),
    onSuccess: async () => {
      queryClient.clear();
      authToken.clear();
      clearSession();
      navigate({ to: "/", replace: true });
      toast.success("Account deleted");
    },
    onError: (e: Error) => toast.error(e.message || "Could not delete account"),
  });

  const s = settings.data;

  return (
    <main className="relative min-h-screen bg-background px-5 pb-28 pt-8">
      <div className="halo pointer-events-none absolute inset-x-0 top-0 h-72" />

      <header className="relative z-10 flex items-center gap-3">
        <Link to="/profile" aria-label="Back" className="glass-panel grid size-10 place-items-center rounded-full">
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-glow">Settings</h1>
      </header>

      {settings.isError && (
        <div className="relative z-10 -mx-4 mt-6">
          <ConnectionError detail={(settings.error as Error)?.message} onRetry={() => void settings.refetch()} />
        </div>
      )}

      {settings.isLoading && (
        <div className="flex justify-center py-16">
          <Loader2 className="size-5 animate-spin text-primary" />
        </div>
      )}

      {s && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING}
          className="relative z-10 mt-6 space-y-6"
        >
          <Section title="Privacy">
            <VisibilityRow
              label="Last seen"
              value={s.privacy_settings.last_seen}
              onChange={(v) => privacy.mutate({ last_seen: v })}
            />
            <VisibilityRow
              label="Profile photo"
              value={s.privacy_settings.profile_photo}
              onChange={(v) => privacy.mutate({ profile_photo: v })}
            />
            <VisibilityRow
              label="Status"
              value={s.privacy_settings.status}
              onChange={(v) => privacy.mutate({ status: v })}
            />
            <ToggleRow
              label="Read receipts"
              checked={s.privacy_settings.read_receipts}
              onChange={(v) => privacy.mutate({ read_receipts: v })}
            />
          </Section>

          <Section title="Notifications">
            <ToggleRow
              label="Sound"
              checked={s.notification_settings.sound}
              onChange={(v) => notifications.mutate({ sound: v })}
            />
            <ToggleRow
              label="Vibration"
              checked={s.notification_settings.vibration}
              onChange={(v) => notifications.mutate({ vibration: v })}
            />
            <ToggleRow
              label="Message preview"
              checked={s.notification_settings.message_preview}
              onChange={(v) => notifications.mutate({ message_preview: v })}
            />
          </Section>

          <Section title="Blocked users">
            {blocked.isLoading && (
              <div className="px-4 py-4">
                <Loader2 className="size-4 animate-spin text-primary" />
              </div>
            )}
            {blocked.data && blocked.data.length === 0 && (
              <p className="flex items-center gap-2 px-4 py-4 text-[13px] text-muted-foreground">
                <ShieldBan className="size-4" /> You haven't blocked anyone.
              </p>
            )}
            {blocked.data?.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                <div className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-primary/20 text-primary">
                  {p.avatar_url ? (
                    <img src={p.avatar_url} alt="" className="size-9 object-cover" />
                  ) : (
                    <UserRound className="size-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px]">{p.display_name}</p>
                  <p className="truncate text-[12px] text-muted-foreground">@{p.username}</p>
                </div>
                <button
                  onClick={() => unblock.mutate(p.id)}
                  disabled={unblock.isPending}
                  className="rounded-xl bg-glass px-3 py-1.5 text-[13px] font-medium text-primary"
                >
                  Unblock
                </button>
              </div>
            ))}
          </Section>

          <Section title="Account">
            <button
              onClick={() => exportData.mutate()}
              disabled={exportData.isPending}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-[15px]"
            >
              {exportData.isPending ? (
                <Loader2 className="size-4 animate-spin text-primary" />
              ) : (
                <Download className="size-4 text-primary" />
              )}
              Export my data
            </button>
            <button
              onClick={() => {
                if (window.confirm("Delete your FluidTalk account and all messages? This cannot be undone.")) {
                  deleteAccount.mutate();
                }
              }}
              disabled={deleteAccount.isPending}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-[15px] text-destructive"
            >
              <Trash2 className="size-4" />
              Delete account
            </button>
          </Section>
        </motion.div>
      )}
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-[12px] font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      <div className="glass-panel divide-y divide-border/60 rounded-3xl">{children}</div>
    </section>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-[15px]">{label}</span>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-7 w-12 rounded-full transition-colors",
          checked ? "bg-primary" : "bg-glass",
        )}
      >
        <motion.span
          layout
          transition={SPRING}
          className={cn(
            "absolute top-0.5 size-6 rounded-full bg-foreground",
            checked ? "left-[calc(100%-1.625rem)]" : "left-0.5",
          )}
        />
      </button>
    </div>
  );
}

function VisibilityRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Visibility;
  onChange: (v: Visibility) => void;
}) {
  return (
    <div className="px-4 py-3">
      <p className="text-[15px]">{label}</p>
      <div className="mt-2 flex gap-1 rounded-xl bg-glass p-1">
        {VISIBILITY.map((v) => (
          <button
            key={v}
            onClick={() => onChange(v)}
            className={cn(
              "flex-1 rounded-lg py-1.5 text-[12px] capitalize transition-colors",
              v === value ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground",
            )}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}
