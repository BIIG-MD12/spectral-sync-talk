/**
 * Neon Auth (Better-Auth compatible) client.
 *
 * Talks to the Better-Auth REST surface hosted by Neon Auth using native fetch.
 * No Supabase, no SDK lock-in — the JWT it returns is verified against the
 * published JWKS by the Neon Data API and attached as
 * `Authorization: Bearer <token>` by src/lib/api.ts.
 */

import { NEON_AUTH_URL, NEON_JWKS_URL, NeonNotConfiguredError } from "./neon-config";

export { NEON_AUTH_URL, NEON_JWKS_URL };

const TOKEN_KEY = "fluidtalk.jwt";

/** Session JWT persistence (browser only). */
export const authToken = {
  get(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(TOKEN_KEY);
  },
  set(jwt: string) {
    if (typeof window !== "undefined") window.localStorage.setItem(TOKEN_KEY, jwt);
  },
  clear() {
    if (typeof window !== "undefined") window.localStorage.removeItem(TOKEN_KEY);
  },
};

export interface NeonAuthUser {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
}

export interface BetterAuthSession {
  token: string;
  user: NeonAuthUser;
}

export class NeonAuthError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "NeonAuthError";
  }
}

async function authFetch<T>(path: string, body?: unknown, method: "GET" | "POST" = "POST") {
  if (!NEON_AUTH_URL) throw new NeonNotConfiguredError("Neon Auth");
  const token = authToken.get();
  const res = await fetch(`${NEON_AUTH_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: "include",
    ...(method === "POST" ? { body: JSON.stringify(body ?? {}) } : {}),
  });
  if (!res.ok) {
    throw new NeonAuthError(res.status, await res.text().catch(() => res.statusText));
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export const neonAuth = {
  jwksUrl: NEON_JWKS_URL,

  /** Restore an existing session (cookie or stored bearer token). */
  async getSession(): Promise<BetterAuthSession | null> {
    if (!NEON_AUTH_URL) return null;
    const data = await authFetch<{
      user?: NeonAuthUser;
      session?: { token?: string };
      token?: string;
    } | null>("/get-session", undefined, "GET").catch(() => null);

    if (!data?.user) return null;
    const token = data.token ?? data.session?.token ?? authToken.get();
    if (!token) return null;
    authToken.set(token);
    return { token, user: data.user };
  },

  /** Better-Auth email-otp plugin: send a 6-digit sign-in code. */
  sendEmailOtp(email: string) {
    return authFetch<{ success: boolean }>("/email-otp/send-verification-otp", {
      email,
      type: "sign-in",
    });
  },

  /** Better-Auth email-otp plugin: exchange the code for a session JWT. */
  async verifyEmailOtp(email: string, otp: string): Promise<BetterAuthSession> {
    const res = await authFetch<{ token: string; user: NeonAuthUser }>("/sign-in/email-otp", {
      email,
      otp,
    });
    authToken.set(res.token);
    return res;
  },

  /** Better-Auth magic-link plugin: emails a one-tap sign-in link. */
  sendMagicLink(email: string, callbackURL = "/chats") {
    return authFetch<{ status: boolean }>("/sign-in/magic-link", { email, callbackURL });
  },

  /** Better-Auth social provider: returns the Google consent URL to redirect to. */
  googleAuthorizeUrl(callbackURL = "/chats") {
    return authFetch<{ url: string; redirect: boolean }>("/sign-in/social", {
      provider: "google",
      callbackURL,
    });
  },

  async signOut() {
    try {
      if (NEON_AUTH_URL) await authFetch<{ success: boolean }>("/sign-out", {});
    } finally {
      authToken.clear();
    }
  },
};
