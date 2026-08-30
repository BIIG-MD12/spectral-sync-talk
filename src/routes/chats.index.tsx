import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { Archive, Loader2, Search } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { ConnectionError } from "@/components/fluid/ConnectionError";
import { useAppStore } from "@/store/useAppStore";
import { useRealtime } from "@/hooks/useRealtime";
import type { Conversation } from "@/types";
import { cn } from "@/lib/utils";

const SPRING = { type: "spring", stiffness: 300, damping: 25 } as const;

export const Route = createFileRoute("/chats/")({
  head: () => ({
    meta: [
      { title: "Your chats — FluidTalk" },
      {
        name: "description",
        content:
          "All your FluidTalk conversations in one glassy list: last message previews, unread badges and swipe-to-archive.",
      },
      { property: "og:title", content: "Your chats — FluidTalk" },
      {
        property: "og:description",
        content: "Glassmorphic conversation list with unread badges and swipe-to-archive.",
      },
    ],
  }),
  component: ChatList,
});

function relative(iso?: string | null) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

function ChatList() {
  const realtime = useRealtime(null);
  const [archived, setArchived] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const unreadCounts = useAppStore((s) => s.unreadCounts);
  const socketStatus = useAppStore((s) => s.socketStatus);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => api.conversations.list(),
  });

  const list = (data ?? [])
    .filter((c) => !archived.includes(c.id))
    .filter((c) => c.title.toLowerCase().includes(q.toLowerCase()));

  return (
    <main className="relative min-h-screen bg-background pb-10">
      <div className="halo pointer-events-none absolute inset-x-0 top-0 h-72" />

      <header className="relative z-10 px-5 pb-3 pt-8">
        <h1 className="text-3xl font-semibold tracking-tight text-glow">Messages</h1>
        <p className="mt-1 text-[12px] text-muted-foreground">
          {socketStatus === "connected"
            ? "Live"
            : socketStatus === "reconnecting" || socketStatus === "connecting"
              ? "Connecting…"
              : socketStatus === "error"
                ? "Live updates paused"
                : "Ready"}{" "}
          · swipe a card to archive
        </p>
        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-glass px-4 py-2.5">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search"
            className="w-full bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
          />
        </div>
      </header>

      {realtime.isError && (
        <div className="relative z-10 pb-2">
          <ConnectionError
            title="Live connection lost"
            body="New messages won't appear automatically until we reconnect."
            detail={realtime.error ?? undefined}
            onRetry={() => {
              realtime.reconnect();
              void refetch();
            }}
          />
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-16">
          <Loader2 className="size-5 animate-spin text-primary" />
        </div>
      )}

      <ul className="relative z-10 space-y-2 px-3">
        <AnimatePresence initial={false}>
          {list.map((c, i) => (
            <ConversationCard
              key={c.id}
              conversation={c}
              index={i}
              unread={unreadCounts[c.id] ?? c.unread_count ?? 0}
              onArchive={() => setArchived((a) => [...a, c.id])}
            />
          ))}
        </AnimatePresence>
      </ul>
    </main>
  );
}

function ConversationCard({
  conversation,
  index,
  unread,
  onArchive,
}: {
  conversation: Conversation;
  index: number;
  unread: number;
  onArchive: () => void;
}) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: -320, scale: 0.9 }}
      transition={{ ...SPRING, delay: Math.min(index * 0.05, 0.3) }}
      className="relative"
    >
      <div className="absolute inset-0 flex items-center justify-end rounded-3xl bg-destructive/20 pr-6 text-destructive">
        <Archive className="size-5" />
      </div>
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.35}
        onDragEnd={(_, info) => {
          if (info.offset.x < -120) onArchive();
        }}
        transition={SPRING}
        className="relative"
      >
        <Link
          to="/chats/$conversationId"
          params={{ conversationId: conversation.id }}
          className="glass-panel flex items-center gap-3 rounded-3xl px-4 py-3.5"
        >
          <div className="grid size-12 shrink-0 place-items-center rounded-full bg-primary/20 text-[15px] font-semibold text-primary">
            {conversation.title.slice(0, 1)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-[16px] font-medium">{conversation.title}</span>
              <span className="shrink-0 text-[12px] text-muted-foreground">
                {relative(conversation.last_message?.sent_at)}
              </span>
            </div>
            <p
              className={cn(
                "mt-0.5 truncate text-[13px]",
                unread ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {conversation.last_message?.effect_type === "invisible_ink"
                ? "Sent with invisible ink"
                : (conversation.last_message?.content ?? "Say hello")}
            </p>
          </div>
          {unread > 0 && (
            <motion.span
              layout
              transition={SPRING}
              className="grid min-w-6 place-items-center rounded-full bg-primary px-2 py-0.5 text-[12px] font-semibold text-primary-foreground"
            >
              {unread}
            </motion.span>
          )}
        </Link>
      </motion.div>
    </motion.li>
  );
}
