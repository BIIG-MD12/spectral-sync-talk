import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Plus, UserRound, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { ConnectionError } from "@/components/fluid/ConnectionError";
import { useRequireAuth } from "@/hooks/useSession";
import { useAppStore } from "@/store/useAppStore";
import type { StatusItem, StatusRingGroup } from "@/types";
import { cn } from "@/lib/utils";

const SPRING = { type: "spring", stiffness: 300, damping: 25 } as const;
const STORY_MS = 5000;

export const Route = createFileRoute("/status")({
  head: () => ({
    meta: [
      { title: "Status — FluidTalk" },
      { name: "description", content: "Share moments that disappear after 24 hours and watch your contacts' stories." },
      { property: "og:title", content: "Status — FluidTalk" },
      { property: "og:description", content: "Disappearing 24-hour status updates on FluidTalk." },
    ],
  }),
  component: StatusScreen,
});

function timeAgo(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : "1d ago";
}

function StatusScreen() {
  const session = useRequireAuth();
  const me = useAppStore((s) => s.user);
  const queryClient = useQueryClient();
  const [viewing, setViewing] = useState<number | null>(null);
  const [composing, setComposing] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["statuses"],
    queryFn: () => api.statuses.list(),
    enabled: session.isAuthenticated,
    refetchInterval: 30_000,
  });

  const groups = data ?? [];
  const mine = groups.find((g) => g.user.id === me?.id);
  const others = groups.filter((g) => g.user.id !== me?.id);
  const recent = others.filter((g) => !g.all_viewed);
  const viewed = others.filter((g) => g.all_viewed);

  const openGroup = (g: StatusRingGroup) => {
    const idx = groups.findIndex((x) => x.user.id === g.user.id);
    if (idx >= 0) setViewing(idx);
  };

  return (
    <main className="relative min-h-screen bg-background px-5 pb-28 pt-8">
      <div className="halo pointer-events-none absolute inset-x-0 top-0 h-72" />

      <header className="relative z-10 flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight text-glow">Status</h1>
        <motion.button
          whileTap={{ scale: 0.92 }}
          transition={SPRING}
          aria-label="Add status"
          onClick={() => setComposing(true)}
          className="glass-panel grid size-10 place-items-center rounded-full text-primary"
        >
          <Plus className="size-5" />
        </motion.button>
      </header>

      {isError && (
        <div className="relative z-10 -mx-4 mt-6">
          <ConnectionError detail={(error as Error)?.message} onRetry={() => void refetch()} />
        </div>
      )}

      {(isLoading || session.isLoading) && !isError && (
        <div className="flex justify-center py-16">
          <Loader2 className="size-5 animate-spin text-primary" />
        </div>
      )}

      {data && (
        <div className="relative z-10 mt-6 space-y-6">
          {/* Ring row */}
          <div className="-mx-5 flex gap-4 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
            <button onClick={() => (mine ? openGroup(mine) : setComposing(true))} className="flex w-[72px] shrink-0 flex-col items-center gap-1.5">
              <Ring active={Boolean(mine && !mine.all_viewed)} seen={Boolean(mine)} size={64}>
                <Avatar url={me?.avatar_url ?? null} name={me?.display_name ?? "Me"} size={58} />
                <span className="absolute -bottom-0.5 -right-0.5 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground ring-2 ring-background">
                  <Plus className="size-3" />
                </span>
              </Ring>
              <span className="truncate text-[11px]">My status</span>
            </button>
            {others.map((g, i) => (
              <motion.button
                key={g.user.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ ...SPRING, delay: Math.min(i * 0.04, 0.3) }}
                onClick={() => openGroup(g)}
                className="flex w-[72px] shrink-0 flex-col items-center gap-1.5"
              >
                <Ring active={!g.all_viewed} seen size={64}>
                  <Avatar url={g.user.avatar_url} name={g.user.display_name} size={58} />
                </Ring>
                <span className="w-full truncate text-[11px]">{g.user.display_name}</span>
              </motion.button>
            ))}
          </div>

          {others.length === 0 && (
            <div className="glass-panel rounded-3xl px-5 py-8 text-center">
              <p className="text-[15px] font-medium">No stories yet</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                When your contacts post a status it will show up here for 24 hours.
              </p>
            </div>
          )}

          {recent.length > 0 && <GroupList title="Recent updates" groups={recent} onOpen={openGroup} />}
          {viewed.length > 0 && <GroupList title="Viewed updates" groups={viewed} onOpen={openGroup} />}
        </div>
      )}

      <AnimatePresence>
        {viewing !== null && groups[viewing] && (
          <StoryViewer
            key="viewer"
            groups={groups}
            index={viewing}
            onIndexChange={setViewing}
            onClose={() => setViewing(null)}
            onViewed={(id) =>
              api.statuses.markViewed(id).then(() => queryClient.invalidateQueries({ queryKey: ["statuses"] }))
            }
          />
        )}
        {composing && (
          <StatusComposer
            key="composer"
            onClose={() => setComposing(false)}
            onCreated={() => {
              setComposing(false);
              void queryClient.invalidateQueries({ queryKey: ["statuses"] });
            }}
          />
        )}
      </AnimatePresence>
    </main>
  );
}

function GroupList({
  title,
  groups,
  onOpen,
}: {
  title: string;
  groups: StatusRingGroup[];
  onOpen: (g: StatusRingGroup) => void;
}) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-[12px] font-medium uppercase tracking-wider text-muted-foreground">{title}</h2>
      <ul className="glass-panel divide-y divide-border/60 rounded-3xl">
        {groups.map((g) => (
          <li key={g.user.id}>
            <button onClick={() => onOpen(g)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
              <Ring active={!g.all_viewed} seen size={50}>
                <Avatar url={g.user.avatar_url} name={g.user.display_name} size={44} />
              </Ring>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium">{g.user.display_name}</p>
                <p className="text-[12px] text-muted-foreground">
                  {timeAgo(g.items.at(-1)?.created_at ?? new Date().toISOString())} · {g.items.length}{" "}
                  {g.items.length === 1 ? "update" : "updates"}
                </p>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Ring({
  active,
  seen,
  size,
  children,
}: {
  active: boolean;
  seen: boolean;
  size: number;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "relative grid place-items-center rounded-full p-[3px]",
        active ? "status-ring" : seen ? "bg-border" : "bg-transparent",
      )}
      style={{ width: size, height: size }}
    >
      <span className="grid size-full place-items-center rounded-full bg-background p-[2px]">{children}</span>
    </span>
  );
}

function Avatar({ url, name, size }: { url: string | null; name: string; size: number }) {
  return (
    <span
      className="grid place-items-center overflow-hidden rounded-full bg-primary/20 text-primary"
      style={{ width: size, height: size }}
    >
      {url ? (
        <img src={url} alt={name} className="size-full object-cover" />
      ) : (
        <span className="text-[15px] font-semibold">{name.slice(0, 1).toUpperCase() || <UserRound className="size-4" />}</span>
      )}
    </span>
  );
}

/* ---------------------------- Story viewer ---------------------------- */

function StoryViewer({
  groups,
  index,
  onIndexChange,
  onClose,
  onViewed,
}: {
  groups: StatusRingGroup[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
  onViewed: (id: string) => Promise<unknown>;
}) {
  const group = groups[index]!;
  const [item, setItem] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const raf = useRef<number | null>(null);
  const startRef = useRef(0);
  const elapsedRef = useRef(0);

  useEffect(() => {
    setItem(0);
  }, [index]);

  const current: StatusItem | undefined = group.items[item];

  const next = useCallback(() => {
    if (item < group.items.length - 1) setItem((i) => i + 1);
    else if (index < groups.length - 1) onIndexChange(index + 1);
    else onClose();
  }, [item, group.items.length, index, groups.length, onIndexChange, onClose]);

  const prev = useCallback(() => {
    if (item > 0) setItem((i) => i - 1);
    else if (index > 0) onIndexChange(index - 1);
    else setItem(0);
  }, [item, index, onIndexChange]);

  useEffect(() => {
    if (current && !current.viewed) void onViewed(current.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  useEffect(() => {
    elapsedRef.current = 0;
    setProgress(0);
  }, [current?.id]);

  useEffect(() => {
    if (paused || !current) return;
    startRef.current = performance.now() - elapsedRef.current;
    const tick = (t: number) => {
      elapsedRef.current = t - startRef.current;
      const p = Math.min(elapsedRef.current / STORY_MS, 1);
      setProgress(p);
      if (p >= 1) next();
      else raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [paused, current, next]);

  if (!current) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={SPRING}
      className="fixed inset-0 z-50 flex flex-col bg-background"
      role="dialog"
      aria-label={`${group.user.display_name}'s status`}
    >
      <motion.div
        key={current.id}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.4}
        onDragEnd={(_, info) => {
          if (info.offset.y > 120) onClose();
        }}
        className="relative flex flex-1 flex-col overflow-hidden"
        onPointerDown={() => setPaused(true)}
        onPointerUp={() => setPaused(false)}
        onPointerCancel={() => setPaused(false)}
      >
        {/* Media */}
        <div className="story-bg absolute inset-0">
          {current.media_type === "image" && current.media_url && (
            <img src={current.media_url} alt={current.caption ?? ""} className="size-full object-cover" />
          )}
          {current.media_type === "video" && current.media_url && (
            <video src={current.media_url} autoPlay muted playsInline className="size-full object-cover" />
          )}
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-background/80 to-transparent" />

        {/* Progress bars */}
        <div className="relative z-10 flex gap-1 px-3 pt-[max(env(safe-area-inset-top),0.75rem)]">
          {group.items.map((s, i) => (
            <div key={s.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-foreground/25">
              <div
                className="h-full rounded-full bg-foreground"
                style={{ width: i < item ? "100%" : i === item ? `${progress * 100}%` : "0%" }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="relative z-10 mt-3 flex items-center gap-3 px-4">
          <Avatar url={group.user.avatar_url} name={group.user.display_name} size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-medium">{group.user.display_name}</p>
            <p className="text-[11px] text-muted-foreground">{timeAgo(current.created_at)}</p>
          </div>
          <button aria-label="Close" onClick={onClose} className="grid size-9 place-items-center rounded-full bg-glass">
            <X className="size-4" />
          </button>
        </div>

        {/* Text story / caption */}
        <div className="relative z-10 flex flex-1 items-center justify-center px-8">
          {current.media_type === "text" && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={SPRING}
              className="text-center text-[26px] font-semibold leading-snug tracking-tight text-glow"
            >
              {current.caption}
            </motion.p>
          )}
        </div>
        {current.media_type !== "text" && current.caption && (
          <p className="relative z-10 px-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] text-center text-[15px]">
            {current.caption}
          </p>
        )}

        {/* Tap zones */}
        <button aria-label="Previous" onClick={prev} className="absolute inset-y-0 left-0 z-20 w-1/3" />
        <button aria-label="Next" onClick={next} className="absolute inset-y-0 right-0 z-20 w-2/3" />
      </motion.div>
    </motion.div>
  );
}

/* ---------------------------- Composer ---------------------------- */

function StatusComposer({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [caption, setCaption] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");

  const create = useMutation({
    mutationFn: () => {
      const url = mediaUrl.trim();
      const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(url);
      return api.statuses.create(caption.trim(), url ? (isVideo ? "video" : "image") : "text", url || null);
    },
    onSuccess: () => {
      toast.success("Status posted");
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message || "Could not post status"),
  });

  const disabled = create.isPending || (!caption.trim() && !mediaUrl.trim());

  return (
    <>
      <motion.button
        aria-label="Close"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm"
      />
      <motion.section
        role="dialog"
        aria-label="New status"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={SPRING}
        className="glass-strong fixed inset-x-0 bottom-0 z-50 rounded-t-[28px] px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-semibold">New status</h2>
          <button onClick={onClose} className="grid size-8 place-items-center rounded-full bg-glass">
            <X className="size-4" />
          </button>
        </div>

        <div className="story-bg mt-4 flex min-h-40 items-center justify-center rounded-3xl px-5">
          <textarea
            autoFocus
            value={caption}
            onChange={(e) => setCaption(e.target.value.slice(0, 200))}
            rows={3}
            placeholder="What's on your mind?"
            className="w-full resize-none bg-transparent text-center text-[22px] font-semibold tracking-tight outline-none placeholder:text-foreground/50"
          />
        </div>
        <input
          value={mediaUrl}
          onChange={(e) => setMediaUrl(e.target.value)}
          placeholder="Optional image or video URL"
          className="mt-3 w-full rounded-2xl bg-glass px-4 py-2.5 text-[14px] outline-none placeholder:text-muted-foreground"
        />
        <p className="mt-2 text-[11px] text-muted-foreground">Disappears after 24 hours.</p>

        <motion.button
          whileTap={{ scale: 0.97 }}
          transition={SPRING}
          disabled={disabled}
          onClick={() => create.mutate()}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-[15px] font-medium text-primary-foreground disabled:opacity-40"
        >
          {create.isPending && <Loader2 className="size-4 animate-spin" />}
          Share status
        </motion.button>
      </motion.section>
    </>
  );
}
