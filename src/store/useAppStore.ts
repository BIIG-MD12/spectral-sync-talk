import { create } from "zustand";
import type { Profile } from "@/types";

export type SocketStatus = "idle" | "connecting" | "connected" | "reconnecting" | "disconnected";

interface AppState {
  user: Profile | null;
  jwt: string | null;
  activeConversationId: string | null;
  unreadCounts: Record<string, number>;
  socketStatus: SocketStatus;
  typingIn: Record<string, string[]>;

  setSession: (user: Profile, jwt: string) => void;
  clearSession: () => void;
  setActiveConversation: (id: string | null) => void;
  setUnread: (conversationId: string, count: number) => void;
  incrementUnread: (conversationId: string) => void;
  setSocketStatus: (status: SocketStatus) => void;
  setTyping: (conversationId: string, userIds: string[]) => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  jwt: null,
  activeConversationId: null,
  unreadCounts: {},
  socketStatus: "idle",
  typingIn: {},

  setSession: (user, jwt) => set({ user, jwt }),
  clearSession: () => set({ user: null, jwt: null, activeConversationId: null, unreadCounts: {} }),
  setActiveConversation: (id) =>
    set((s) => ({
      activeConversationId: id,
      unreadCounts: id ? { ...s.unreadCounts, [id]: 0 } : s.unreadCounts,
    })),
  setUnread: (conversationId, count) =>
    set((s) => ({ unreadCounts: { ...s.unreadCounts, [conversationId]: count } })),
  incrementUnread: (conversationId) =>
    set((s) => ({
      unreadCounts: {
        ...s.unreadCounts,
        [conversationId]: (s.unreadCounts[conversationId] ?? 0) + 1,
      },
    })),
  setSocketStatus: (socketStatus) => set({ socketStatus }),
  setTyping: (conversationId, userIds) =>
    set((s) => ({ typingIn: { ...s.typingIn, [conversationId]: userIds } })),
}));
