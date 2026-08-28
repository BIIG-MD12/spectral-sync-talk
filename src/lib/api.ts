import type {
  AuthSession,
  ContactRequest,
  ContactRequestStatus,
  Conversation,
  EmailOtpResponse,
  Message,
  MessagePage,
  Profile,
  SendMessagePayload,
} from "@/types";
import type {
  CallRecord,
  CallToken,
  CallType,
  NotificationSettings,
  PrivacySettings,
  ProfileUpdatePayload,
  StatusItem,
  StatusMediaType,
  StatusRingGroup,
  UserSettings,
} from "@/types";
import { mockApi, mockExtras } from "./mock-backend";
import { NEON_DATA_API_URL, neonAuth } from "./neon-auth";

/** Neon Data API endpoint (falls back to a custom API server if provided). */
const BASE_URL =
  NEON_DATA_API_URL || ((import.meta.env["VITE_API_URL"] as string | undefined) ?? "");

/** When no backend URL is configured we serve deterministic mock data. */
export const USING_MOCKS = !BASE_URL;

const TOKEN_KEY = "fluidtalk.jwt";

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

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  init: RequestInit & { query?: Record<string, string | number | undefined> } = {},
): Promise<T> {
  const { query, ...rest } = init;
  const url = new URL(`${BASE_URL}${path}`, BASE_URL || "http://localhost");
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
  }

  const token = authToken.get();
  const res = await fetch(url.toString(), {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(rest.headers ?? {}),
    },
  });

  if (!res.ok) {
    throw new ApiError(res.status, await res.text().catch(() => res.statusText));
  }
  return (await res.json()) as T;
}

/* ------------------------------------------------------------------ */
/* Public API surface — signatures match the Node/Express + Neon API.  */
/* ------------------------------------------------------------------ */

export const api = {
  auth: {
    /** POST /api/auth/email-otp  { email } -> { token, requiresOtp } */
    emailOtp(email: string): Promise<EmailOtpResponse> {
      if (USING_MOCKS) return mockApi.emailOtp(email);
      return neonAuth.sendEmailOtp(email).then(() => ({ token: "", requiresOtp: true }));
    },

    /** POST /api/auth/verify-otp  { email, otp } -> { user, jwt } */
    verifyOtp(email: string, otp: string): Promise<AuthSession> {
      if (USING_MOCKS) return mockApi.verifyOtp(email, otp);
      return request("/api/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ email, otp }),
      });
    },

    /** POST /api/auth/google  { idToken } -> { user, jwt } */
    google(idToken: string): Promise<AuthSession> {
      if (USING_MOCKS) return mockApi.google(idToken);
      return request("/api/auth/google", {
        method: "POST",
        body: JSON.stringify({ idToken }),
      });
    },
  },

  conversations: {
    /** GET /api/conversations -> Conversation[] */
    list(): Promise<Conversation[]> {
      if (USING_MOCKS) return mockApi.listConversations();
      return request("/api/conversations");
    },

    get(id: string): Promise<Conversation> {
      if (USING_MOCKS) return mockApi.getConversation(id);
      return request(`/api/conversations/${id}`);
    },

    /** GET /api/conversations/:id/messages?cursor=&limit= -> { messages, nextCursor } */
    messages(id: string, cursor?: string, limit = 30): Promise<MessagePage> {
      if (USING_MOCKS) return mockApi.listMessages(id, cursor, limit);
      return request(`/api/conversations/${id}/messages`, { query: { cursor, limit } });
    },

    /** POST /api/conversations/:id/messages -> Message */
    sendMessage(id: string, payload: SendMessagePayload): Promise<Message> {
      if (USING_MOCKS) return mockApi.sendMessage(id, payload);
      return request(`/api/conversations/${id}/messages`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
  },

  contactRequests: {
    /** POST /api/contact-requests { receiver_id } -> ContactRequest */
    create(receiver_id: string): Promise<ContactRequest> {
      if (USING_MOCKS) return mockApi.createContactRequest(receiver_id);
      return request("/api/contact-requests", {
        method: "POST",
        body: JSON.stringify({ receiver_id }),
      });
    },

    /** PUT /api/contact-requests/:id { status } -> ContactRequest */
    update(id: string, status: Exclude<ContactRequestStatus, "pending">): Promise<ContactRequest> {
      if (USING_MOCKS) return mockApi.updateContactRequest(id, status);
      return request(`/api/contact-requests/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
    },
  },

  profiles: {
    me(): Promise<Profile> {
      if (USING_MOCKS) return mockExtras.getProfile();
      return request("/api/profiles/me");
    },
    update(patch: ProfileUpdatePayload): Promise<Profile> {
      if (USING_MOCKS) return mockExtras.updateProfile(patch);
      return request("/api/profiles/me", { method: "PATCH", body: JSON.stringify(patch) });
    },
  },

  statuses: {
    /** GET /api/statuses -> grouped rings, unexpired only */
    list(): Promise<StatusRingGroup[]> {
      if (USING_MOCKS) return mockExtras.listStatuses();
      return request("/api/statuses");
    },
    create(caption: string, media_type: StatusMediaType): Promise<StatusItem> {
      if (USING_MOCKS) return mockExtras.createStatus(caption, media_type);
      return request("/api/statuses", {
        method: "POST",
        body: JSON.stringify({ caption, media_type }),
      });
    },
    markViewed(id: string): Promise<{ ok: true }> {
      if (USING_MOCKS) return mockExtras.markStatusViewed(id);
      return request(`/api/statuses/${id}/view`, { method: "POST" });
    },
  },

  calls: {
    history(): Promise<CallRecord[]> {
      if (USING_MOCKS) return mockExtras.listCalls();
      return request("/api/calls");
    },
    /** POST /api/calls -> LiveKit/Daily room credentials for WebRTC signaling */
    start(peer_id: string, call_type: CallType): Promise<CallToken> {
      if (USING_MOCKS) return mockExtras.createCall(peer_id, call_type);
      return request("/api/calls", {
        method: "POST",
        body: JSON.stringify({ peer_id, call_type }),
      });
    },
  },

  settings: {
    get(): Promise<UserSettings> {
      if (USING_MOCKS) return mockExtras.getSettings();
      return request("/api/settings");
    },
    updatePrivacy(patch: Partial<PrivacySettings>): Promise<UserSettings> {
      if (USING_MOCKS) return mockExtras.updatePrivacy(patch);
      return request("/api/settings/privacy", { method: "PATCH", body: JSON.stringify(patch) });
    },
    updateNotifications(patch: Partial<NotificationSettings>): Promise<UserSettings> {
      if (USING_MOCKS) return mockExtras.updateNotifications(patch);
      return request("/api/settings/notifications", {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
    },
  },

  blocked: {
    list(): Promise<Profile[]> {
      if (USING_MOCKS) return mockExtras.listBlocked();
      return request("/api/blocked");
    },
    block(user_id: string): Promise<Profile[]> {
      if (USING_MOCKS) return mockExtras.block(user_id);
      return request("/api/blocked", { method: "POST", body: JSON.stringify({ user_id }) });
    },
    unblock(user_id: string): Promise<Profile[]> {
      if (USING_MOCKS) return mockExtras.unblock(user_id);
      return request(`/api/blocked/${user_id}`, { method: "DELETE" });
    },
  },

  account: {
    async exportData(): Promise<Blob> {
      if (USING_MOCKS) return mockExtras.exportData();
      const res = await fetch(`${BASE_URL}/api/account/export`, {
        headers: { Authorization: `Bearer ${authToken.get() ?? ""}` },
      });
      if (!res.ok) throw new ApiError(res.status, "Export failed");
      return res.blob();
    },
    remove(): Promise<{ ok: true }> {
      if (USING_MOCKS) return mockExtras.deleteAccount();
      return request("/api/account", { method: "DELETE" });
    },
  },
};

