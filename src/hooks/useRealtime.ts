import { useCallback, useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { useAppStore } from "@/store/useAppStore";
import { authToken } from "@/lib/api";
import type { Message } from "@/types";

const SOCKET_URL = (import.meta.env["VITE_API_URL"] as string | undefined) ?? "";

export interface RealtimeHandlers {
  onMessage?: (message: Message) => void;
  onTyping?: (payload: { conversation_id: string; user_ids: string[] }) => void;
  onPresence?: (payload: { user_id: string; status: string }) => void;
}

/**
 * Custom socket.io realtime engine.
 * Owns connection lifecycle, reconnection and room join/leave.
 * When VITE_API_URL is not configured the hook stays inert (mock mode).
 */
export function useRealtime(conversationId?: string | null, handlers: RealtimeHandlers = {}) {
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const setSocketStatus = useAppStore((s) => s.setSocketStatus);
  const incrementUnread = useAppStore((s) => s.incrementUnread);
  const setTyping = useAppStore((s) => s.setTyping);

  useEffect(() => {
    if (typeof window === "undefined" || !SOCKET_URL) {
      setSocketStatus("idle");
      return;
    }

    setSocketStatus("connecting");
    const socket = io(SOCKET_URL, {
      transports: ["websocket"],
      auth: { token: authToken.get() },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 8000,
    });
    socketRef.current = socket;

    socket.on("connect", () => setSocketStatus("connected"));
    socket.on("disconnect", () => setSocketStatus("disconnected"));
    socket.io.on("reconnect_attempt", () => setSocketStatus("reconnecting"));
    socket.io.on("reconnect", () => setSocketStatus("connected"));

    socket.on("message:new", (message: Message) => {
      handlersRef.current.onMessage?.(message);
      const active = useAppStore.getState().activeConversationId;
      if (message.conversation_id !== active) incrementUnread(message.conversation_id);
    });

    socket.on("typing", (payload: { conversation_id: string; user_ids: string[] }) => {
      setTyping(payload.conversation_id, payload.user_ids);
      handlersRef.current.onTyping?.(payload);
    });

    socket.on("presence", (payload: { user_id: string; status: string }) => {
      handlersRef.current.onPresence?.(payload);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setSocketStatus("idle");
    };
  }, [setSocketStatus, incrementUnread, setTyping]);

  // Room join / leave
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !conversationId) return;
    socket.emit("room:join", { conversation_id: conversationId });
    return () => {
      socket.emit("room:leave", { conversation_id: conversationId });
    };
  }, [conversationId]);

  const emitTyping = useCallback(
    (isTyping: boolean) => {
      if (!conversationId) return;
      socketRef.current?.emit("typing", { conversation_id: conversationId, is_typing: isTyping });
    },
    [conversationId],
  );

  return { socket: socketRef, emitTyping };
}
