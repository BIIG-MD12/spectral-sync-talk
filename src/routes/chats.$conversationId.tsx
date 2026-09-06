import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, Loader2, Video } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ActiveCall, CallOverlay } from "@/components/fluid/CallOverlay";
import { Composer } from "@/components/fluid/Composer";
import { ConnectionError } from "@/components/fluid/ConnectionError";
import { MessageBubble } from "@/components/fluid/MessageBubble";
import { useRealtime } from "@/hooks/useRealtime";
import { useRequireAuth } from "@/hooks/useSession";
import { api } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";
import type { EffectType, Message } from "@/types";

/** When no socket server is connected, poll the Data API so other people's messages still arrive. */
const POLL_INTERVAL_MS = 4000;

const SPRING = { type: "spring", stiffness: 300, damping: 25 } as const;

export const Route = createFileRoute("/chats/$conversationId")({
  head: () => ({
    meta: [
      { title: "Conversation — FluidTalk" },
      {
        name: "description",
        content:
          "A FluidTalk conversation with spring-animated bubbles, invisible ink mystery reveal, double-tap reactions and scheduled time capsules.",
      },
      { property: "og:title", content: "Conversation — FluidTalk" },
      {
        property: "og:description",
        content: "Invisible ink, reactions and time capsules in a premium dark chat room.",
      },
    ],
  }),
  component: ChatRoom,
});

function ChatRoom() {
  useRequireAuth();
  const { conversationId } = Route.useParams();
  const queryClient = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [localReactions, setLocalReactions] = useState<Record<string, string>>({});

  const setActiveConversation = useAppStore((s) => s.setActiveConversation);
  const currentUser = useAppStore((s) => s.user);
  const socketStatus = useAppStore((s) => s.socketStatus);
  const myId = currentUser?.id ?? "";

  useEffect(() => {
    setActiveConversation(conversationId);
    return () => setActiveConversation(null);
  }, [conversationId, setActiveConversation]);

  const realtime = useRealtime(conversationId, {
    onMessage: () => queryClient.invalidateQueries({ queryKey: ["messages", conversationId] }),
  });

  const { data: conversation } = useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: () => api.conversations.get(conversationId),
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: () => api.conversations.messages(conversationId),
    // Sockets deliver instantly; otherwise fall back to lightweight polling.
    refetchInterval: socketStatus === "connected" ? false : POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
  });

  const messages = useMemo(() => data?.messages ?? [], [data]);
  const byId = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);
  const nameFor = (id: string) =>
    conversation?.participants?.find((p) => p.id === id)?.display_name ?? "Member";

  const peer = conversation?.participants?.find((p) => p.id !== myId);
  const title = conversation
    ? conversation.is_group
      ? conversation.title
      : (peer?.display_name ?? conversation.title)
    : null;

  const send = useMutation({
    mutationFn: ({
      content,
      effect,
      scheduledAt,
    }: {
      content: string;
      effect: EffectType;
      scheduledAt: string | null;
    }) =>
      api.conversations.sendMessage(conversationId, {
        content,
        effect_type: effect,
        reply_to_id: replyTo?.id ?? null,
        scheduled_at: scheduledAt,
      }),
    onSuccess: (message) => {
      setReplyTo(null);
      realtime.socket.current?.emit("message:send", message);
      queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (err: Error) => toast.error(err.message || "Message was not sent"),
  });

  const react = useMutation({
    mutationFn: ({ id, emoji }: { id: string; emoji: string }) => api.conversations.react(id, emoji),
    onMutate: ({ id, emoji }) => setLocalReactions((r) => ({ ...r, [id]: emoji })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["messages", conversationId] }),
    onError: (err: Error) => toast.error(err.message || "Reaction failed"),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <main className="relative flex min-h-screen flex-col bg-background">
      <div className="halo pointer-events-none absolute inset-x-0 top-0 h-64" />

      <motion.header
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING}
        className="glass-strong sticky top-0 z-20 flex items-center gap-3 px-3 py-3"
      >
        <Link to="/chats" className="grid size-9 place-items-center rounded-full bg-glass">
          <ChevronLeft className="size-5" />
        </Link>
        <div className="grid size-9 place-items-center overflow-hidden rounded-full bg-primary/20 text-[13px] font-semibold text-primary">
          {peer?.avatar_url && !conversation?.is_group ? (
            <img src={peer.avatar_url} alt="" className="size-9 object-cover" />
          ) : (
            (title ?? "?").slice(0, 1)
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium">{title ?? "Loading…"}</p>
          <p className="text-[12px] text-muted-foreground">
            {conversation?.is_group
              ? `${conversation.participants?.length ?? 0} people`
              : socketStatus === "connected"
                ? "Live"
                : "Syncing every few seconds"}
          </p>
        </div>
        <button className="grid size-9 place-items-center rounded-full bg-glass text-muted-foreground">
          <Video className="size-[18px]" />
        </button>
      </motion.header>

      <AnimatePresence>
        {(realtime.isError || isError) && (
          <div className="relative z-20 pt-3">
            <ConnectionError
              title={isError ? undefined : "Live connection lost"}
              body={isError ? undefined : "Messages won't arrive in real time until we reconnect."}
              detail={realtime.error ?? undefined}
              onRetry={() => {
                realtime.reconnect();
                void refetch();
                queryClient.invalidateQueries({ queryKey: ["conversation", conversationId] });
              }}
            />
          </div>
        )}
      </AnimatePresence>

      <div className="relative z-10 flex-1 space-y-3 overflow-y-auto py-5">
        {isLoading && (
          <div className="flex justify-center py-16">
            <Loader2 className="size-5 animate-spin text-primary" />
          </div>
        )}
        {!isLoading && !isError && messages.length === 0 && (
          <p className="px-8 pt-16 text-center text-[13px] text-muted-foreground">
            No messages yet. Say hello — it'll be saved to your Neon database.
          </p>
        )}
        <AnimatePresence initial={false}>
          {messages.map((m, i) => {
            const reaction = localReactions[m.id];
            const merged = reaction
              ? {
                  ...m,
                  reactions: [
                    ...(m.reactions ?? []).filter((r) => r.user_id !== myId),
                    { emoji: reaction, user_id: myId },
                  ],
                }
              : m;
            return (
              <MessageBubble
                key={m.id}
                index={i}
                message={merged}
                mine={m.sender_id === myId}
                senderName={conversation?.is_group ? nameFor(m.sender_id) : undefined}
                replyTo={m.reply_to_id ? (byId.get(m.reply_to_id) ?? null) : null}
                onReact={(id, emoji) => react.mutate({ id, emoji })}
                onReply={setReplyTo}
              />
            );
          })}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      <Composer
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        onSend={(content, effect, scheduledAt) => send.mutate({ content, effect, scheduledAt })}
      />
    </main>
  );
}
