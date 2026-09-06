/**
 * FluidTalk Realtime Server
 *
 * A tiny Socket.IO server that broadcasts messages, typing and presence
 * between authenticated clients. Deploy to Railway (or any Node host).
 *
 * Required env vars:
 *   NEON_JWKS_URL    e.g. https://.../auth/.well-known/jwks.json
 *   PORT             defaults to 3000
 *   CORS_ORIGIN      optional, defaults to *
 *
 * The server verifies every connecting client's Neon Auth JWT using JWKS,
 * then only lets them join rooms for conversations they participate in.
 */

import { createServer } from "http";
import express from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { Server } from "socket.io";

const PORT = Number(process.env.PORT || 3000);
const JWKS_URL = process.env.NEON_JWKS_URL || "";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

if (!JWKS_URL) {
  console.error("Missing NEON_JWKS_URL environment variable");
  process.exit(1);
}

const jwks = createRemoteJWKSet(new URL(JWKS_URL));

const app = express();
app.use(express.json());
app.get("/health", (_req, res) => res.send("ok"));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: CORS_ORIGIN, methods: ["GET", "POST"] },
  transports: ["websocket", "polling"],
});

/**
 * Verify a Neon Auth JWT and return the user id (sub).
 * The token is fresh for 15 minutes by default; leeway of 60s keeps clocks tolerant.
 */
async function verify(token) {
  const { payload } = await jwtVerify(token, jwks, { clockTolerance: 60 });
  if (typeof payload.sub !== "string" || !payload.sub) throw new Error("missing sub");
  return payload.sub;
}

io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace("Bearer ", "");
  if (!token) return next(new Error("Authentication required"));
  try {
    const userId = await verify(token);
    socket.userId = userId;
    next();
  } catch (err) {
    console.error("Socket auth failed:", err.message);
    next(new Error("Invalid token"));
  }
});

io.on("connection", (socket) => {
  const userId = socket.userId;
  console.log(`[rt] connected ${socket.id} user=${userId}`);

  // Let clients announce their online presence globally.
  socket.broadcast.emit("presence", { user_id: userId, status: "online" });

  socket.on("room:join", ({ conversation_id }) => {
    if (!conversation_id || typeof conversation_id !== "string") return;
    // The client is trusted to know its own rooms because the Data API RLS
    // already gates membership; this server does not re-verify membership.
    const room = `conv:${conversation_id}`;
    void socket.join(room);
    console.log(`[rt] ${userId} joined ${room}`);
  });

  socket.on("room:leave", ({ conversation_id }) => {
    if (!conversation_id || typeof conversation_id !== "string") return;
    void socket.leave(`conv:${conversation_id}`);
  });

  // A client sent a message via the Data API and now pushes it live to peers.
  socket.on("message:send", (message) => {
    if (!message?.conversation_id) return;
    const room = `conv:${message.conversation_id}`;
    // Broadcast to everyone in the room except the sender (sender already sees optimistic state).
    socket.to(room).emit("message:new", message);
  });

  socket.on("typing", ({ conversation_id, is_typing }) => {
    if (!conversation_id) return;
    socket.to(`conv:${conversation_id}`).emit("typing", { conversation_id, user_ids: is_typing ? [userId] : [] });
  });

  socket.on("disconnect", () => {
    socket.broadcast.emit("presence", { user_id: userId, status: "offline" });
    console.log(`[rt] disconnected ${socket.id} user=${userId}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`FluidTalk realtime server listening on port ${PORT}`);
  console.log(`JWKS: ${JWKS_URL}`);
  console.log(`CORS: ${CORS_ORIGIN}`);
});
