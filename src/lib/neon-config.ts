/**
 * Central Neon configuration.
 *
 * Everything here is PUBLIC, browser-safe configuration only:
 *  - VITE_NEON_AUTH_URL      Neon Auth (Better-Auth) base URL
 *  - VITE_NEON_DATA_API_URL  Neon Data API (PostgREST) base URL
 *
 * A PostgreSQL connection string, database password or any privileged
 * credential must NEVER appear here — the browser only ever talks to the
 * Data API with the signed-in user's JWT, and PostgreSQL RLS decides what
 * that identity may read or write.
 */

const env = import.meta.env as Record<string, string | undefined>;

function clean(value: string | undefined): string {
  return (value ?? "").trim().replace(/\/+$/, "");
}

export const NEON_AUTH_URL = clean(env["VITE_NEON_AUTH_URL"]);
export const NEON_DATA_API_URL = clean(env["VITE_NEON_DATA_API_URL"]);
export const REALTIME_URL = clean(env["VITE_REALTIME_URL"] ?? env["VITE_API_URL"]);

/**
 * Mocks are OPT-IN for local development only. They are never used as a
 * silent fallback: if Neon is configured but unreachable the UI surfaces a
 * real connection error instead of pretending fake data is real.
 */
export const USE_MOCKS = env["VITE_USE_MOCKS"] === "true";

export const AUTH_CONFIGURED = Boolean(NEON_AUTH_URL) || USE_MOCKS;
export const DATA_API_CONFIGURED = Boolean(NEON_DATA_API_URL) || USE_MOCKS;
export const NEON_CONFIGURED = AUTH_CONFIGURED && DATA_API_CONFIGURED;

/** Thrown when the app is running without Neon configuration. */
export class NeonNotConfiguredError extends Error {
  constructor(what: string) {
    super(
      `${what} is not configured. Set VITE_NEON_AUTH_URL and VITE_NEON_DATA_API_URL to your Neon project endpoints.`,
    );
    this.name = "NeonNotConfiguredError";
  }
}
