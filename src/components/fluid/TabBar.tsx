import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { MessageCircle, Phone } from "lucide-react";
import { cn } from "@/lib/utils";

const SPRING = { type: "spring", stiffness: 300, damping: 25 } as const;

const TABS = [
  { to: "/chats", label: "Chats", icon: MessageCircle },
  { to: "/calls", label: "Calls", icon: Phone },
] as const;

export function TabBar() {
  return (
    <motion.nav
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={SPRING}
      className="glass-strong fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2"
      aria-label="Primary"
    >
      {TABS.map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          className="flex flex-1 flex-col items-center gap-1 rounded-2xl py-1.5 text-muted-foreground"
          activeProps={{ "data-active": "true" }}
          activeOptions={{ exact: false }}
        >
          {({ isActive }) => (
            <>
              <motion.span
                animate={{ scale: isActive ? 1.12 : 1, y: isActive ? -1 : 0 }}
                transition={SPRING}
                className={cn("grid place-items-center", isActive && "text-primary")}
              >
                <Icon className="size-[22px]" />
              </motion.span>
              <span className={cn("text-[11px]", isActive && "font-medium text-primary")}>
                {label}
              </span>
            </>
          )}
        </Link>
      ))}
    </motion.nav>
  );
}
