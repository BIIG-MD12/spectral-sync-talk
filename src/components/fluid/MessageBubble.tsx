import { AnimatePresence, motion } from "framer-motion";
import { Clock, CornerUpLeft } from "lucide-react";
import { useRef, useState } from "react";
import { InvisibleInk } from "./InvisibleInk";
import type { Message } from "@/types";
import { cn } from "@/lib/utils";

const SPRING = { type: "spring", stiffness: 300, damping: 25 } as const;
const EMOJI = ["❤️", "👍", "😂", "🔥", "😮", "😢"];

function initialFor(effect: Message["effect_type"], mine: boolean) {
  switch (effect) {
    case "slam":
      return { opacity: 0, scale: 1.9, rotate: mine ? -4 : 4 };
    case "loud":
      return { opacity: 0, scale: 0.4 };
    case "gentle":
      return { opacity: 0, scale: 0.94, y: 6 };
    default:
      return { opacity: 0, y: 14, scale: 0.96 };
  }
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export interface MessageBubbleProps {
  message: Message;
  mine: boolean;
  index: number;
  senderName?: string | undefined;
  replyTo?: Message | null | undefined;
  onReact: (messageId: string, emoji: string) => void;
  onReply: (message: Message) => void;
}

export function MessageBubble({
  message,
  mine,
  index,
  senderName,
  replyTo,
  onReact,
  onReply,
}: MessageBubbleProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const lastTap = useRef(0);
  const scheduled = Boolean(message.scheduled_at) && !message.sent_at;

  const handleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 320) setPickerOpen((v) => !v);
    lastTap.current = now;
  };

  return (
    <motion.div
      layout
      initial={initialFor(message.effect_type, mine)}
      animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
      transition={{ ...SPRING, delay: Math.min(index * 0.035, 0.4) }}
      className={cn("flex w-full flex-col px-4", mine ? "items-end" : "items-start")}
    >
      {!mine && senderName && (
        <span className="mb-1 pl-2 text-[12px] text-muted-foreground">{senderName}</span>
      )}

      {replyTo && (
        <div
          className={cn(
            "mb-1 flex max-w-[78%] items-center gap-1.5 rounded-2xl border border-border/60 bg-glass px-3 py-1.5 text-[12px] text-muted-foreground",
            mine ? "mr-1" : "ml-1",
          )}
        >
          <CornerUpLeft className="size-3 shrink-0" />
          <span className="truncate">{replyTo.content}</span>
        </div>
      )}

      <div className={cn("relative max-w-[80%]", scheduled && "opacity-70")}>
        <motion.div
          onPointerDown={handleTap}
          whileTap={{ scale: 0.98 }}
          transition={SPRING}
          className={cn(
            "select-none px-4 py-2.5 text-[16px] leading-snug",
            mine
              ? "bubble-sent rounded-[18px] rounded-br-[4px]"
              : "bubble-received rounded-[18px] rounded-bl-[4px]",
            scheduled && "border border-dashed border-primary/50 bg-glass bg-none text-foreground",
          )}
        >
          {message.effect_type === "invisible_ink" ? (
            <InvisibleInk>
              <span className="block">{message.content}</span>
            </InvisibleInk>
          ) : (
            <span className="block whitespace-pre-wrap break-words">{message.content}</span>
          )}
        </motion.div>

        <AnimatePresence>
          {pickerOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.85 }}
              transition={SPRING}
              className={cn(
                "glass-strong absolute -top-11 z-20 flex gap-1 rounded-full px-2 py-1.5 shadow-xl",
                mine ? "right-0" : "left-0",
              )}
            >
              {EMOJI.map((e) => (
                <motion.button
                  key={e}
                  whileHover={{ scale: 1.25 }}
                  whileTap={{ scale: 0.9 }}
                  transition={SPRING}
                  className="text-lg"
                  onClick={() => {
                    onReact(message.id, e);
                    setPickerOpen(false);
                  }}
                >
                  {e}
                </motion.button>
              ))}
              <motion.button
                whileTap={{ scale: 0.9 }}
                className="ml-1 flex items-center text-muted-foreground"
                onClick={() => {
                  onReply(message);
                  setPickerOpen(false);
                }}
              >
                <CornerUpLeft className="size-4" />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {!!message.reactions?.length && (
          <motion.div
            layout
            transition={SPRING}
            className={cn(
              "glass-panel -mt-2 ml-auto w-fit rounded-full px-2 py-0.5 text-xs",
              mine ? "mr-2" : "ml-2",
            )}
          >
            {message.reactions.map((r) => r.emoji).join(" ")}
          </motion.div>
        )}
      </div>

      <span
        className={cn(
          "mt-1 flex items-center gap-1 px-2 text-[12px] text-muted-foreground",
          mine ? "flex-row-reverse" : "",
        )}
      >
        {scheduled ? (
          <>
            <Clock className="size-3 text-primary" />
            Time capsule · {formatTime(message.scheduled_at!)}
          </>
        ) : (
          formatTime(message.sent_at ?? message.created_at)
        )}
      </span>
    </motion.div>
  );
}
