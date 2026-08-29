import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { api } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";

/**
 * Single source of authenticated identity: the Neon Auth session.
 * Restores the session on app start and mirrors it into the Zustand store.
 */
export function useSession() {
  const setSession = useAppStore((s) => s.setSession);
  const clearSession = useAppStore((s) => s.clearSession);

  const query = useQuery({
    queryKey: ["session"],
    queryFn: () => api.auth.session(),
    retry: false,
    staleTime: 60_000,
  });

  const session = query.data ?? null;

  useEffect(() => {
    if (query.isLoading) return;
    if (session) setSession(session.user, session.jwt);
    else clearSession();
  }, [session, query.isLoading, setSession, clearSession]);

  return {
    user: session?.user ?? null,
    isAuthenticated: Boolean(session),
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

/** Client-side route guard: unauthenticated visitors go back to the login screen. */
export function useRequireAuth() {
  const session = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!session.isLoading && !session.isAuthenticated) {
      navigate({ to: "/", replace: true });
    }
  }, [session.isLoading, session.isAuthenticated, navigate]);

  return session;
}
