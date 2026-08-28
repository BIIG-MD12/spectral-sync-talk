/**
 * Neon Auth (Better-Auth compatible) client.
 *
 * Talks to the Better-Auth REST surface hosted by Neon Auth using native fetch.
 * No Supabase, no SDK lock-in — the JWT it returns is verified against the
 * published JWKS and attached as `Authorization: Bearer <token>` by src/lib/api.ts.
 */

export const NEON_AUTH_URL =
  (import.meta.env["VITE_NEON_AUTH_URL"] as string | undefined) ??
  "https://ep-nameless-king-axpsohl1.neonauth.c-4.us-east-2.aws.neon.tech/neondb/auth";

export const NEON_JWKS_URL = `${NEON_AUTH_URL}/.well-known/jwks.json`;

/** Neon Data API (PostgREST) base — all data reads/writes go through this. */
export const NEON_DATA_API_URL =
  (import.meta.env["VITE_NEON_DATA_API_URL"] as string | undefined) ?? "";

export interface BetterAuthSession {
  token: string;
  user: {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
  };
}

async function authFetch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${NEON_AUTH_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return (await res.json()) as T;
}

export const neonAuth = {
  jwksUrl: NEON_JWKS_URL,

  /** Better-Auth email-otp plugin: send a 6-digit sign-in code. */
  sendEmailOtp(email: string) {
    return authFetch<{ success: boolean }>("/email-otp/send-verification-otp", {
      email,
      type: "sign-in",
    });
  },

  /** Better-Auth email-otp plugin: exchange the code for a session JWT. */
  verifyEmailOtp(email: string, otp: string) {
    return authFetch<BetterAuthSession>("/sign-in/email-otp", { email, otp });
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

  signOut() {
    return authFetch<{ success: boolean }>("/sign-out", {});
  },
};
