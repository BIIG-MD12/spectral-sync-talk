import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Camera, Clock, Sparkle, X } from "lucide-react";
import { useState } from "react";
import type { EffectType, Message } from "@/types";
import { cn } from "@/lib/utils";

const SPRING = { type: "spring", stiffness: 300, damping: 25 } as const;

export interface ComposerProps {
  replyTo: Message | null;
  onCancelReply: () => void;
  onSend: (content: string, effect: EffectType, scheduledAt: string | null) => void;
}

export function Composer({ replyTo, onCancelReply, onSend }: ComposerProps) {
  const [value, setValue] = useState("");
  const [inkMode, setInkMode] = useState(false);
  const [scheduleMode, setScheduleMode] = useState(false);
  const canSend = value.trim().length > 0;

  const submit = () => {
    if (!canSend) return;
    onSend(
      value.trim(),
      inkMode ? "invisible_ink" : "none",
      scheduleMode ? new Date(Date.now() + 60 * 60 * 1000).toISOString() : null,
    );
    setValue("");
    setInkMode(false);
    setScheduleMode(false);
  };

  return (
    <div className="sticky bottom-0 px-3 pb-4 pt-2">
      <AnimatePresence>
        {replyTo && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={SPRING}
            className="glass-panel mb-2 flex items-center gap-2 rounded-2xl px-3 py-2 text-[12px] text-muted-foreground"
          >
            <span className="truncate">Replying to: {replyTo.content}</span>
            <button onClick={onCancelReply} className="ml-auto">
              <X className="size-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        layout
        transition={SPRING}
        className="glass-strong flex items-end gap-2 rounded-[26px] p-2 shadow-[0_10px_40px_-20px_var(--glow)]"
      >
        <motion.button
          whileTap={{ scale: 0.88 }}
          transition={SPRING}
          aria-label="Camera"
          className="grid size-9 shrink-0 place-items-center rounded-full bg-glass text-muted-foreground"
        >
          <Camera className="size-[18px]" />
        </motion.button>

        <textarea
          rows={1}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={inkMode ? "Invisible ink message…" : "Message"}
          className="max-h-[140px] min-h-9 flex-1 resize-none bg-transparent py-2 text-[16px] leading-snug text-foreground outline-none placeholder:text-muted-foreground"
        />

        <motion.button
          whileTap={{ scale: 0.88 }}
          transition={SPRING}
          onClick={() => setInkMode((v) => !v)}
          aria-label="Invisible ink"
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground",
            inkMode ? "bg-primary/25 text-primary" : "bg-glass",
          )}
        >
          <Sparkle className="size-[18px]" />
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.88 }}
          transition={SPRING}
          onClick={() => setScheduleMode((v) => !v)}
          aria-label="Send later"
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground",
            scheduleMode ? "bg-primary/25 text-primary" : "bg-glass",
          )}
        >
          <Clock className="size-[18px]" />
        </motion.button>

        <motion.button
          layout
          onClick={submit}
          disabled={!canSend}
          animate={{
            scale: canSend ? 1 : 0.85,
            opacity: canSend ? 1 : 0.4,
          }}
          whileTap={{ scale: 0.85 }}
          transition={SPRING}
          aria-label="Send"
          className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"
        >
          <ArrowUp className="size-[18px]" />
        </motion.button>
      </motion.div>
    </div>
  );
}
