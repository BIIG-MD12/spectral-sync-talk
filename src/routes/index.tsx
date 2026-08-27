import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Loader2, Mail } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ParticleField } from "@/components/fluid/ParticleField";
import { api, authToken } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";

const SPRING = { type: "spring", stiffness: 300, damping: 25 } as const;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FluidTalk — Sign in to your futuristic chat" },
      {
        name: "description",
        content:
          "Sign in to FluidTalk with a one-time email code or Google. Glassy dark chat with invisible ink, reactions and scheduled time capsules.",
      },
      { property: "og:title", content: "FluidTalk — Sign in" },
      {
        property: "og:description",
        content: "Zero-friction sign in to FluidTalk, the premium dark-mode chat experience.",
      },
    ],
  }),
  component: AuthScreen,
});

function AuthScreen() {
  const navigate = useNavigate();
  const setSession = useAppStore((s) => s.setSession);
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const requestOtp = async () => {
    if (!email.includes("@")) return toast.error("Enter a valid email");
    setLoading(true);
    try {
      const res = await api.auth.emailOtp(email);
      if (res.requiresOtp) setStep("otp");
      toast.success("Code sent — use any 6 digits in demo mode");
    } catch {
      toast.error("Could not send code");
    } finally {
      setLoading(false);
    }
  };

  const verify = async () => {
    setLoading(true);
    try {
      const { user, jwt } = await api.auth.verifyOtp(email, otp);
      authToken.set(jwt);
      setSession(user, jwt);
      navigate({ to: "/chats" });
    } catch {
      toast.error("Invalid code");
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    setLoading(true);
    try {
      const { user, jwt } = await api.auth.google("demo-id-token");
      authToken.set(jwt);
      setSession(user, jwt);
      navigate({ to: "/chats" });
    } catch {
      toast.error("Google sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-6">
      <ParticleField />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={SPRING}
        className="glass-panel relative z-10 w-full max-w-sm rounded-[32px] p-7"
      >
        <motion.div
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/20"
        >
          <span className="text-2xl">💧</span>
        </motion.div>

        <h1 className="mt-5 text-center text-3xl font-semibold tracking-tight text-glow">
          FluidTalk
        </h1>
        <p className="mt-2 text-center text-[13px] text-muted-foreground">
          Conversations that move like water.
        </p>

        <AnimatePresence mode="wait">
          {step === "email" ? (
            <motion.div
              key="email"
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={SPRING}
              className="mt-7 space-y-3"
            >
              <div className="flex items-center gap-2 rounded-2xl bg-glass px-4 py-3">
                <Mail className="size-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && requestOtp()}
                  placeholder="you@example.com"
                  className="w-full bg-transparent text-[16px] outline-none placeholder:text-muted-foreground"
                />
              </div>
              <PrimaryButton onClick={requestOtp} loading={loading} label="Continue with email" />
              <div className="flex items-center gap-3 py-1 text-[12px] text-muted-foreground">
                <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
              </div>
              <motion.button
                whileTap={{ scale: 0.97 }}
                transition={SPRING}
                onClick={google}
                className="w-full rounded-2xl border border-border bg-glass py-3 text-[15px] font-medium"
              >
                Continue with Google
              </motion.button>
            </motion.div>
          ) : (
            <motion.div
              key="otp"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={SPRING}
              className="mt-7 space-y-3"
            >
              <p className="text-center text-[13px] text-muted-foreground">
                Enter the 6-digit code sent to {email}
              </p>
              <input
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && verify()}
                placeholder="••••••"
                className="w-full rounded-2xl bg-glass py-3 text-center text-2xl tracking-[0.5em] outline-none placeholder:text-muted-foreground"
              />
              <PrimaryButton onClick={verify} loading={loading} label="Verify & enter" />
              <button
                onClick={() => setStep("email")}
                className="w-full text-center text-[12px] text-muted-foreground"
              >
                Use a different email
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </main>
  );
}

function PrimaryButton({
  onClick,
  loading,
  label,
}: {
  onClick: () => void;
  loading: boolean;
  label: string;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      transition={SPRING}
      disabled={loading}
      onClick={onClick}
      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-[15px] font-semibold text-primary-foreground disabled:opacity-60"
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
      {label}
    </motion.button>
  );
}
