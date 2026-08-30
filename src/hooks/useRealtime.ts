import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { useAppStore } from "@/store/useAppStore";
import { authToken } from "@/lib/neon-auth";
import { REALTIME_URL } from "@/lib/neon-config";
import type { Message } from "@/types";

export interface RealtimeHandlers {
  onMessage?: (message: Message) => void;
  onTyping?: (payload: { conversation_id: string; user_ids: string[] }) => void;
  onPresence?: (payload: { user_id: string; status: string }) => void;
}

/** Attempts before we surface a connection error to the user. */
const MAX_ATTEMPTS = 4;

/**
 * Custom socket.io realtime engine.
 * Owns connection lifecycle, reconnection and room join/leave.
 * When VITE_REALTIME_URL is not configured the hook stays inert.
 */
export function useRealtime(conversationId?: string | null, handlers: RealtimeHandlers = {}) {
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const conversationRef = useRef<string | null>(conversationId ?? null);
  conversationRef.current = conversationId ?? null;

  const [attempt, setAttempt] = useState(0);

  const setSocketStatus = useAppStore((s) => s.setSocketStatus);
  const incrementUnread = useAppStore((s) => s.incrementUnread);
  const setTyping = useAppStore((s) => s.setTyping);
  const status = useAppStore((s) => s.socketStatus);
  const error = useAppStore((s) => s.socketError);

  useEffect(() => {
    if (typeof window === "undefined" || !REALTIME_URL) {
      setSocketStatus("idle");
      return;
    }

    setSocketStatus("connecting");
    const socket = io(REALTIME_URL, {
      transports: ["websocket"],
      auth: { token: authToken.get() },
      reconnection: true,
      reconnectionAttempts: MAX_ATTEMPTS,
      reconnectionDelay: 800,
      reconnectionDelayMax: 8000,
    });
    socketRef.current = socket;

    const joinCurrentRoom = () => {
      const id = conversationRef.current;
      if (id) socket.emit("room:join", { conversation_id: id });
    };

    socket.on("connect", () => {
      setSocketStatus("connected");
      joinCurrentRoom();
    });
    socket.on("disconnect", () => setSocketStatus("disconnected"));
    socket.on("connect_error", (err: Error) => {
      setSocketStatus("connecting", err.message);
    });
    socket.io.on("reconnect_attempt", () => setSocketStatus("reconnecting"));
    socket.io.on("reconnect", () => setSocketStatus("connected"));
    socket.io.on("reconnect_failed", () => setSocketStatus("error", "Realtime connection failed"));
    socket.io.on("error", (err: Error) => setSocketStatus("error", err.message));

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
      socket.io.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setSocketStatus("idle");
    };
  }, [setSocketStatus, incrementUnread, setTyping, attempt]);

  // Room join / leave
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !conversationId) return;
    if (socket.connected) socket.emit("room:join", { conversation_id: conversationId });
    return () => {
      socket.emit("room:leave", { conversation_id: conversationId });
    };
  }, [conversationId, attempt]);

  /** Tear down and rebuild the socket, then re-join the active room on connect. */
  const reconnect = useCallback(() => {
    setSocketStatus("connecting");
    setAttempt((a) => a + 1);
  }, [setSocketStatus]);

  const emitTyping = useCallback(
    (isTyping: boolean) => {
      if (!conversationId) return;
      socketRef.current?.emit("typing", { conversation_id: conversationId, is_typing: isTyping });
    },
    [conversationId],
  );

  return {
    socket: socketRef,
    emitTyping,
    reconnect,
    status,
    error,
    isError: status === "error",
  };
}
