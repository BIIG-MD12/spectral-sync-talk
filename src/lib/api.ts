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
import { mockApi } from "./mock-backend";

const BASE_URL = (import.meta.env["VITE_API_URL"] as string | undefined) ?? "";

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
      return request("/api/auth/email-otp", { method: "POST", body: JSON.stringify({ email }) });
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
      if (USING_MOCKS) return mockApi.me();
      return request("/api/profiles/me");
    },
  },
};
