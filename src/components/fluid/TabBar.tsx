import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { CircleDot, MessageCircle, Phone, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";

const SPRING = { type: "spring", stiffness: 300, damping: 25 } as const;

const TABS = [
  { to: "/chats", label: "Chats", icon: MessageCircle },
  { to: "/status", label: "Status", icon: CircleDot },
  { to: "/calls", label: "Calls", icon: Phone },
  { to: "/profile", label: "Profile", icon: UserRound },
] as const;

function haptic() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(10);
  }
}

export function TabBar() {
  const unreadCounts = useAppStore((s) => s.unreadCounts);
  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

  return (
    <motion.nav
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={SPRING}
      className="glass-strong fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur-xl"
      aria-label="Primary"
    >
      {TABS.map(({ to, label, icon: Icon }) => {
        const badge = to === "/chats" ? totalUnread : 0;
        return (
          <Link
            key={to}
            to={to}
            onClick={haptic}
            className="flex flex-1 flex-col items-center gap-1 rounded-2xl py-1.5 text-muted-foreground"
            activeProps={{ "data-active": "true" }}
            activeOptions={{ exact: false }}
          >
            {({ isActive }) => (
              <>
                <span className="relative">
                  <motion.span
                    animate={{ scale: isActive ? 1.1 : 1 }}
                    transition={SPRING}
                    className={cn("grid place-items-center", isActive && "text-primary")}
                  >
                    <Icon className="size-[22px]" />
                  </motion.span>
                  {badge > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={SPRING}
                      className="absolute -right-2 -top-1 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground"
                    >
                      {badge > 99 ? "99+" : badge}
                    </motion.span>
                  )}
                </span>
                <span className={cn("text-[11px]", isActive && "font-medium text-primary")}>
                  {label}
                </span>
              </>
            )}
          </Link>
        );
      })}
    </motion.nav>
  );
}
