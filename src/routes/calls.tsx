import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
  Loader2,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
  Plus,
  Search,
  Video,
  Phone as PhoneIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ActiveCall, CallOverlay } from "@/components/fluid/CallOverlay";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { CallRecord, CallType } from "@/types";

const SPRING = { type: "spring", stiffness: 300, damping: 25 } as const;

export const Route = createFileRoute("/calls")({
  head: () => ({
    meta: [
      { title: "Calls — FluidTalk" },
      {
        name: "description",
        content:
          "Your FluidTalk voice and video call history with one-tap redial and WebRTC calling powered by LiveKit.",
      },
      { property: "og:title", content: "Calls — FluidTalk" },
      {
        property: "og:description",
        content: "Voice and video call history with instant redial in FluidTalk.",
      },
    ],
  }),
  component: CallsScreen,
});

function duration(seconds: number) {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

function when(iso: string) {
  const d = new Date(iso);
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function CallsScreen() {
  const { data, isLoading } = useQuery({ queryKey: ["calls"], queryFn: () => api.calls.history() });
  const peers = Array.from(
    new Map((data ?? []).map((c) => [c.peer.id, c.peer])).values(),
  );
  const [sheetOpen, setSheetOpen] = useState(false);

  const dial = async (peerId: string, peerName: string, type: CallType) => {
    setSheetOpen(false);
    try {
      await api.calls.start(peerId, type);
      toast.success(`${type === "video" ? "Video" : "Voice"} call with ${peerName}`);
    } catch {
      toast.error("Could not start the call");
    }
  };

  return (
    <main className="relative min-h-screen bg-background pb-28">
      <div className="halo pointer-events-none absolute inset-x-0 top-0 h-64" />

      <header className="relative z-10 px-5 pb-3 pt-8">
        <h1 className="text-3xl font-semibold tracking-tight text-glow">Calls</h1>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Voice &amp; video over WebRTC · green answered, red missed
        </p>
      </header>

      {isLoading && (
        <div className="flex justify-center py-16">
          <Loader2 className="size-5 animate-spin text-primary" />
        </div>
      )}

      <ul className="relative z-10 space-y-2 px-3">
        {(data ?? []).map((call, i) => (
          <CallRow key={call.id} call={call} index={i} onRedial={dial} />
        ))}
      </ul>

      <motion.button
        whileTap={{ scale: 0.92 }}
        transition={SPRING}
        onClick={() => setSheetOpen(true)}
        className="fixed bottom-24 right-5 z-40 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_12px_40px_-12px_var(--glow)]"
        aria-label="Start a new call"
      >
        <Plus className="size-6" />
      </motion.button>

      <AnimatePresence>
        {sheetOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSheetOpen(false)}
              className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: 320 }}
              animate={{ y: 0 }}
              exit={{ y: 320 }}
              transition={SPRING}
              className="glass-strong fixed inset-x-0 bottom-0 z-50 rounded-t-[28px] p-5 pb-8"
            >
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
              <h2 className="mb-3 text-[15px] font-medium">Start a call</h2>
              <ul className="space-y-2">
                {peers.length === 0 && (
                  <li className="rounded-2xl bg-glass px-4 py-6 text-center text-[13px] text-muted-foreground">
                    No contacts yet
                  </li>
                )}
                {peers.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center gap-3 rounded-2xl bg-glass px-4 py-3"
                    >
                      <div className="grid size-10 place-items-center rounded-full bg-primary/20 text-[14px] font-semibold text-primary">
                        {p.display_name.slice(0, 1)}
                      </div>
                      <span className="flex-1 truncate text-[15px]">{p.display_name}</span>
                      <button
                        onClick={() => dial(p.id, p.display_name, "voice")}
                        className="grid size-9 place-items-center rounded-full bg-glass text-primary"
                        aria-label={`Voice call ${p.display_name}`}
                      >
                        <PhoneIcon className="size-[18px]" />
                      </button>
                      <button
                        onClick={() => dial(p.id, p.display_name, "video")}
                        className="grid size-9 place-items-center rounded-full bg-glass text-primary"
                        aria-label={`Video call ${p.display_name}`}
                      >
                        <Video className="size-[18px]" />
                      </button>
                    </li>
                  ))}
              </ul>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </main>
  );
}

function CallRow({
  call,
  index,
  onRedial,
}: {
  call: CallRecord;
  index: number;
  onRedial: (peerId: string, peerName: string, type: CallType) => void;
}) {
  const missed = call.status !== "answered";
  const Icon = missed ? PhoneMissed : call.direction === "incoming" ? PhoneIncoming : PhoneOutgoing;
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING, delay: Math.min(index * 0.05, 0.3) }}
      className="glass-panel flex items-center gap-3 rounded-3xl px-4 py-3.5"
    >
      <div className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/20 text-[14px] font-semibold text-primary">
        {call.peer.display_name.slice(0, 1)}
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-[16px]", missed ? "text-destructive" : "text-foreground")}>
          {call.peer.display_name}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <Icon className={cn("size-3.5", missed ? "text-destructive" : "text-chart-3")} />
          {call.status === "answered"
            ? `${call.direction === "incoming" ? "Incoming" : "Outgoing"} · ${duration(call.duration_seconds)}`
            : call.status === "missed"
              ? "Missed"
              : "Declined"}
        </p>
      </div>
      <span className="shrink-0 text-[12px] text-muted-foreground">{when(call.started_at)}</span>
      <button
        onClick={() => onRedial(call.peer.id, call.peer.display_name, call.call_type)}
        className="grid size-9 place-items-center rounded-full bg-glass text-primary"
        aria-label={`Call ${call.peer.display_name} back`}
      >
        {call.call_type === "video" ? (
          <Video className="size-[18px]" />
        ) : (
          <PhoneIcon className="size-[18px]" />
        )}
      </button>
    </motion.li>
  );
}
