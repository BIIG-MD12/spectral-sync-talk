import { motion } from "framer-motion";
import { RefreshCw, WifiOff } from "lucide-react";
import { CONNECTION_ERROR_BODY, CONNECTION_ERROR_TITLE } from "@/lib/api";

const SPRING = { type: "spring", stiffness: 300, damping: 25 } as const;

export function ConnectionError({
  onRetry,
  title = CONNECTION_ERROR_TITLE,
  body = CONNECTION_ERROR_BODY,
  detail,
}: {
  onRetry: () => void;
  title?: string | undefined;
  body?: string | undefined;
  detail?: string | undefined;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={SPRING}
      role="alert"
      className="glass-panel mx-4 rounded-3xl px-5 py-7 text-center"
    >
      <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-destructive/15 text-destructive">
        <WifiOff className="size-5" />
      </div>
      <h2 className="mt-4 text-[17px] font-medium">{title}</h2>
      <p className="mt-1.5 text-[13px] text-muted-foreground">{body}</p>
      {detail && <p className="mt-2 text-[11px] text-muted-foreground/70">{detail}</p>}
      <motion.button
        whileTap={{ scale: 0.95 }}
        transition={SPRING}
        onClick={onRetry}
        className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-[14px] font-medium text-primary-foreground"
      >
        <RefreshCw className="size-4" />
        Retry
      </motion.button>
    </motion.div>
  );
}
