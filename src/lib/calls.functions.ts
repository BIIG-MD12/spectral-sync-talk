import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import type { CallToken } from "@/types";

const input = z.object({
  peerId: z.string().min(1).max(128),
  callType: z.enum(["voice", "video"]),
  displayName: z.string().max(80).optional(),
});

/** Deterministic room per pair so both sides land in the same LiveKit room. */
export function roomFor(a: string, b: string) {
  return `ft-${[a, b].sort().join("--")}`;
}

/**
 * Mints a short-lived LiveKit access token for the signed-in Neon user.
 * The caller's identity is proven by verifying its Neon Auth JWT against the
 * published JWKS — never trusted from the request body.
 */
export const createCallToken = createServerFn({ method: "POST" })
  .validator({ adapter: (data) => input.parse(data) })
  .handler(async ({ data }): Promise<CallToken> => {
    const url = process.env["LIVEKIT_URL"];
    const apiKey = process.env["LIVEKIT_API_KEY"];
    const apiSecret = process.env["LIVEKIT_API_SECRET"];
    if (!url || !apiKey || !apiSecret) throw new Error("Calling is not configured");

    const auth = getRequestHeader("authorization") ?? "";
    const jwt = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!jwt) throw new Error("Unauthorized");

    const jwksUrl =
      process.env["NEON_JWKS_URL"] ??
      process.env["VITE_NEON_JWKS_URL"] ??
      "";
    if (!jwksUrl) throw new Error("Auth verification is not configured");

    const { createRemoteJWKSet, jwtVerify } = await import("jose");
    const { payload } = await jwtVerify(jwt, createRemoteJWKSet(new URL(jwksUrl)));
    const userId = typeof payload.sub === "string" ? payload.sub : "";
    if (!userId) throw new Error("Unauthorized");

    const { AccessToken } = await import("livekit-server-sdk");
    const room = roomFor(userId, data.peerId);
    const at = new AccessToken(apiKey, apiSecret, {
      identity: userId,
      name: data.displayName ?? userId,
      ttl: "1h",
    });
    at.addGrant({
      room,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    return { room, token: await at.toJwt(), url };
  });
