import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { Profile } from "@/types";

const SPRING = { type: "spring", stiffness: 300, damping: 25 } as const;

export function NewChatSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (!open) {
      setQ("");
      setDebounced("");
    }
  }, [open]);

  const { data: results, isFetching, isError } = useQuery({
    queryKey: ["profile-search", debounced],
    queryFn: () => api.profiles.search(debounced),
    enabled: open && debounced.trim().length > 0,
  });

  const start = useMutation({
    mutationFn: (peer: Profile) => api.conversations.create([peer.id]),
    onSuccess: (conversation) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      onClose();
      navigate({ to: "/chats/$conversationId", params: { conversationId: conversation.id } });
    },
    onError: (err: Error) => toast.error(err.message || "Could not start the chat"),
  });

  return (
    <AnimatePresence>
      {open && (
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
            aria-label="New chat"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={SPRING}
            className="glass-strong fixed inset-x-0 bottom-0 z-50 max-h-[80vh] rounded-t-[28px] px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3"
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
            <div className="flex items-center justify-between">
              <h2 className="text-[17px] font-semibold">New chat</h2>
              <button onClick={onClose} className="grid size-8 place-items-center rounded-full bg-glass">
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-3 flex items-center gap-2 rounded-2xl bg-glass px-4 py-2.5">
              <Search className="size-4 text-muted-foreground" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by name, username or email"
                className="w-full bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
              />
              {isFetching && <Loader2 className="size-4 animate-spin text-primary" />}
            </div>

            <ul className="mt-3 max-h-[52vh] space-y-1.5 overflow-y-auto">
              {isError && (
                <li className="px-2 py-6 text-center text-[13px] text-destructive">Search failed. Try again.</li>
              )}
              {!isError && debounced && !isFetching && (results?.length ?? 0) === 0 && (
                <li className="px-2 py-6 text-center text-[13px] text-muted-foreground">
                  Nobody matches “{debounced}”. They need to sign in to FluidTalk once first.
                </li>
              )}
              {!debounced && (
                <li className="px-2 py-6 text-center text-[13px] text-muted-foreground">
                  Type to find people on FluidTalk.
                </li>
              )}
              {(results ?? []).map((p, i) => (
                <motion.li
                  key={p.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...SPRING, delay: Math.min(i * 0.04, 0.2) }}
                >
                  <button
                    disabled={start.isPending}
                    onClick={() => start.mutate(p)}
                    className="glass-panel flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left disabled:opacity-60"
                  >
                    <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-primary/20 text-[14px] font-semibold text-primary">
                      {p.avatar_url ? (
                        <img src={p.avatar_url} alt="" className="size-10 object-cover" />
                      ) : (
                        p.display_name.slice(0, 1)
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium">{p.display_name}</span>
                      <span className="block truncate text-[12px] text-muted-foreground">@{p.username}</span>
                    </span>
                    {start.isPending && start.variables?.id === p.id && (
                      <Loader2 className="size-4 animate-spin text-primary" />
                    )}
                  </button>
                </motion.li>
              ))}
            </ul>
          </motion.section>
        </>
      )}
    </AnimatePresence>
  );
}
