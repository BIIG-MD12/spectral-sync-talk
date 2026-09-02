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
import { authToken, neonAuth } from "./neon-auth";
import { NEON_DATA_API_URL, NeonNotConfiguredError, USE_MOCKS } from "./neon-config";

export { authToken };

/**
 * Mocks are opt-in via VITE_USE_MOCKS=true (development only).
 * When Neon is configured we never silently fall back to fake data.
 */
export const USING_MOCKS = USE_MOCKS;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Friendly, user-facing copy for any Data API failure. */
export const CONNECTION_ERROR_TITLE = "Unable to connect to FluidTalk";
export const CONNECTION_ERROR_BODY = "Please check your connection and try again.";

/* ------------------------------------------------------------------ */
/* Neon Data API (PostgREST) transport                                 */
/* ------------------------------------------------------------------ */

type Query = Record<string, string | number | undefined>;

async function dataApi<T>(
  path: string,
  init: RequestInit & { query?: Query } = {},
): Promise<T> {
  if (!NEON_DATA_API_URL) throw new NeonNotConfiguredError("Neon Data API");

  const { query, ...rest } = init;
  const url = new URL(`${NEON_DATA_API_URL}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
  }

  // The signed-in user's Neon Auth JWT is the ONLY credential sent from the
  // browser. PostgreSQL RLS decides which rows this identity may touch.
  const token = authToken.get();

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(rest.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError(0, CONNECTION_ERROR_BODY);
  }

  if (!res.ok) {
    throw new ApiError(res.status, await res.text().catch(() => res.statusText));
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

const RETURN_ROW = { Prefer: "return=representation" };

async function selectOne<T>(path: string, query: Query): Promise<T | null> {
  const rows = await dataApi<T[]>(path, { query });
  return rows?.[0] ?? null;
}

/* ------------------------------------------------------------------ */
/* Row mappers — PostgREST rows -> app types                           */
/* ------------------------------------------------------------------ */

interface ConversationRow {
  id: string;
  title: string | null;
  is_group: boolean | null;
  created_at: string;
  participants?: { profile: Profile | null }[] | null;
}

function toConversation(row: ConversationRow, lastMessage: Message | null, me: string | null): Conversation {
  const participants = (row.participants ?? [])
    .map((p) => p.profile)
    .filter((p): p is Profile => Boolean(p));
  const others = participants.filter((p) => p.id !== me);

  return {
    id: row.id,
    title:
      row.title ??
      (others.length ? others.map((p) => p.display_name).join(", ") : participants[0]?.display_name) ??
      "Conversation",
    is_group: Boolean(row.is_group),
    created_at: row.created_at,
    last_message: lastMessage,
    participants,
  };
}

const MESSAGE_SELECT =
  "id,conversation_id,sender_id,content,effect_type,scheduled_at,sent_at,created_at,reply_to_id,reactions:message_reactions(emoji,user_id)";

const CONVERSATION_SELECT =
  "id,title,is_group,created_at,participants:conversation_participants(profile:profiles(*))";

/* ------------------------------------------------------------------ */
/* Public API surface                                                  */
/* ------------------------------------------------------------------ */

export const api = {
  auth: {
    /** Restore an existing Neon Auth session on app start. */
    async session(): Promise<AuthSession | null> {
      if (USING_MOCKS) {
        const jwt = authToken.get();
        if (!jwt) return null;
        return { user: await mockExtras.getProfile(), jwt };
      }
      const session = await neonAuth.getSession();
      if (!session) return null;
      const user = await api.profiles.ensure(session.user);
      return { user, jwt: session.token };
    },

    emailOtp(email: string): Promise<EmailOtpResponse> {
      if (USING_MOCKS) return mockApi.emailOtp(email);
      return neonAuth.sendEmailOtp(email).then(() => ({ token: "", requiresOtp: true }));
    },

    async verifyOtp(email: string, otp: string): Promise<AuthSession> {
      if (USING_MOCKS) return mockApi.verifyOtp(email, otp);
      const session = await neonAuth.verifyEmailOtp(email, otp);
      return { user: await api.profiles.ensure(session.user), jwt: session.token };
    },

    magicLink(email: string): Promise<{ sent: boolean }> {
      if (USING_MOCKS) return Promise.resolve({ sent: true });
      return neonAuth.sendMagicLink(email).then(() => ({ sent: true }));
    },

    /** Google OAuth — redirects to the provider consent screen. */
    async google(_idToken?: string): Promise<AuthSession | null> {
      if (USING_MOCKS) return mockApi.google(_idToken ?? "demo");
      const { url } = await neonAuth.googleAuthorizeUrl();
      if (typeof window !== "undefined") window.location.assign(url);
      return null;
    },

    async signOut(): Promise<void> {
      if (!USING_MOCKS) await neonAuth.signOut().catch(() => undefined);
      authToken.clear();
    },
  },

  profiles: {
    async me(): Promise<Profile | null> {
      if (USING_MOCKS) return mockExtras.getProfile();
      const session = await neonAuth.getSession();
      if (!session) return null;
      return selectOne<Profile>("/profiles", { select: "*", id: `eq.${session.user.id}` });
    },

    /** Load the FluidTalk profile for a Neon Auth user, creating it if missing. */
    async ensure(authUser: { id: string; email: string; name?: string | null; image?: string | null }): Promise<Profile> {
      if (USING_MOCKS) return mockExtras.getProfile();

      const existing = await selectOne<Profile>("/profiles", {
        select: "*",
        id: `eq.${authUser.id}`,
      });
      if (existing) return existing;

      const fallbackName = authUser.name?.trim() || authUser.email.split("@")[0] || "New user";
      const created = await dataApi<Profile[]>("/profiles", {
        method: "POST",
        headers: RETURN_ROW,
        body: JSON.stringify({
          id: authUser.id,
          email: authUser.email,
          username: (authUser.email.split("@")[0] ?? authUser.id).toLowerCase(),
          display_name: fallbackName,
          avatar_url: authUser.image ?? null,
          status: "online",
        }),
      });
      const profile = created?.[0];
      if (!profile) throw new ApiError(500, "Could not create your FluidTalk profile");
      return profile;
    },

    async update(patch: ProfileUpdatePayload): Promise<Profile> {
      if (USING_MOCKS) return mockExtras.updateProfile(patch);
      const session = await neonAuth.getSession();
      if (!session) throw new ApiError(401, "Not signed in");
      const rows = await dataApi<Profile[]>("/profiles", {
        method: "PATCH",
        headers: RETURN_ROW,
        query: { id: `eq.${session.user.id}` },
        body: JSON.stringify(patch),
      });
      const profile = rows?.[0];
      if (!profile) throw new ApiError(500, "Profile update failed");
      return profile;
    },

    /** Find people by username / display name (excludes yourself). */
    async search(q: string): Promise<Profile[]> {
      const term = q.trim().replace(/[%,()]/g, "");
      if (!term) return [];
      const session = await neonAuth.getSession();
      if (!session) return [];
      const rows = await dataApi<Profile[]>("/profiles", {
        query: {
          select: "*",
          or: `(username.ilike.*${term}*,display_name.ilike.*${term}*,email.ilike.*${term}*)`,
          id: `neq.${session.user.id}`,
          limit: 20,
        },
      });
      return rows ?? [];
    },
  },

  conversations: {
    /** Conversations visible to the authenticated identity (RLS-scoped). */
    async list(): Promise<Conversation[]> {
      if (USING_MOCKS) return mockApi.listConversations();
      const me = (await neonAuth.getSession())?.user.id ?? null;

      const rows = await dataApi<ConversationRow[]>("/conversations", {
        query: { select: CONVERSATION_SELECT, order: "created_at.desc" },
      });
      if (!rows?.length) return [];

      const ids = rows.map((r) => r.id);
      const recent = await dataApi<Message[]>("/messages", {
        query: {
          select: MESSAGE_SELECT,
          conversation_id: `in.(${ids.join(",")})`,
          order: "created_at.desc",
          limit: 200,
        },
      }).catch(() => [] as Message[]);

      const latest = new Map<string, Message>();
      for (const m of recent ?? []) {
        if (!latest.has(m.conversation_id)) latest.set(m.conversation_id, m);
      }

      return rows
        .map((row) => toConversation(row, latest.get(row.id) ?? null, me))
        .sort(
          (a, b) =>
            new Date(b.last_message?.created_at ?? b.created_at).getTime() -
            new Date(a.last_message?.created_at ?? a.created_at).getTime(),
        );
    },

    async get(id: string): Promise<Conversation> {
      if (USING_MOCKS) return mockApi.getConversation(id);
      const row = await selectOne<ConversationRow>("/conversations", {
        select: CONVERSATION_SELECT,
        id: `eq.${id}`,
      });
      if (!row) throw new ApiError(404, "Conversation not found");
      const me = (await neonAuth.getSession())?.user.id ?? null;
      return toConversation(row, null, me);
    },

    /** Keyset pagination on created_at (cursor = oldest loaded created_at). */
    async messages(id: string, cursor?: string, limit = 30): Promise<MessagePage> {
      if (USING_MOCKS) return mockApi.listMessages(id, cursor, limit);

      const rows = await dataApi<Message[]>("/messages", {
        query: {
          select: MESSAGE_SELECT,
          conversation_id: `eq.${id}`,
          ...(cursor ? { created_at: `lt.${cursor}` } : {}),
          order: "created_at.desc",
          limit,
        },
      });

      const messages = (rows ?? []).slice().reverse();
      const nextCursor = (rows?.length ?? 0) === limit ? (rows?.at(-1)?.created_at ?? null) : null;
      return { messages, nextCursor };
    },

    /** Insert into PostgreSQL; only a successful insert resolves. */
    async sendMessage(id: string, payload: SendMessagePayload): Promise<Message> {
      if (USING_MOCKS) return mockApi.sendMessage(id, payload);

      const session = await neonAuth.getSession();
      if (!session) throw new ApiError(401, "Not signed in");

      const rows = await dataApi<Message[]>("/messages", {
        method: "POST",
        headers: RETURN_ROW,
        query: { select: MESSAGE_SELECT },
        body: JSON.stringify({
          conversation_id: id,
          sender_id: session.user.id,
          content: payload.content,
          effect_type: payload.effect_type ?? "none",
          reply_to_id: payload.reply_to_id ?? null,
          scheduled_at: payload.scheduled_at ?? null,
          sent_at: payload.scheduled_at ? null : new Date().toISOString(),
        }),
      });

      const message = rows?.[0];
      if (!message) throw new ApiError(500, "Message was not saved");
      return message;
    },

    /** Start a conversation with one or more people (reuses an existing 1:1). */
    async create(peerIds: string[], title?: string): Promise<Conversation> {
      const session = await neonAuth.getSession();
      if (!session) throw new ApiError(401, "Not signed in");
      const me = session.user.id;
      const isGroup = peerIds.length > 1;

      if (!isGroup && peerIds[0]) {
        const existing = (await api.conversations.list()).find(
          (c) =>
            !c.is_group &&
            (c.participants ?? []).length === 2 &&
            (c.participants ?? []).some((p) => p.id === peerIds[0]),
        );
        if (existing) return existing;
      }

      const created = await dataApi<ConversationRow[]>("/conversations", {
        method: "POST",
        headers: RETURN_ROW,
        body: JSON.stringify({ title: title ?? null, is_group: isGroup, created_by: me }),
      });
      const row = created?.[0];
      if (!row) throw new ApiError(500, "Conversation was not created");

      await dataApi("/conversation_participants", {
        method: "POST",
        headers: { Prefer: "resolution=ignore-duplicates" },
        body: JSON.stringify(
          [me, ...peerIds].map((user_id) => ({ conversation_id: row.id, user_id })),
        ),
      });

      return api.conversations.get(row.id);
    },

    /** One reaction per user per message (upsert on the composite key). */
    async react(messageId: string, emoji: string): Promise<void> {
      if (USING_MOCKS) return;
      const session = await neonAuth.getSession();
      if (!session) throw new ApiError(401, "Not signed in");
      await dataApi("/message_reactions", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates" },
        query: { on_conflict: "message_id,user_id" },
        body: JSON.stringify({ message_id: messageId, user_id: session.user.id, emoji }),
      });
    },
  },

  contactRequests: {
    async create(receiver_id: string): Promise<ContactRequest> {
      if (USING_MOCKS) return mockApi.createContactRequest(receiver_id);
      const session = await neonAuth.getSession();
      if (!session) throw new ApiError(401, "Not signed in");
      const rows = await dataApi<ContactRequest[]>("/contact_requests", {
        method: "POST",
        headers: RETURN_ROW,
        body: JSON.stringify({
          sender_id: session.user.id,
          receiver_id,
          status: "pending",
        }),
      });
      const row = rows?.[0];
      if (!row) throw new ApiError(500, "Request failed");
      return row;
    },

    async update(
      id: string,
      status: Exclude<ContactRequestStatus, "pending">,
    ): Promise<ContactRequest> {
      if (USING_MOCKS) return mockApi.updateContactRequest(id, status);
      const rows = await dataApi<ContactRequest[]>("/contact_requests", {
        method: "PATCH",
        headers: RETURN_ROW,
        query: { id: `eq.${id}` },
        body: JSON.stringify({ status }),
      });
      const row = rows?.[0];
      if (!row) throw new ApiError(500, "Request failed");
      return row;
    },
  },

  statuses: {
    /** Active (non-expired) statuses grouped per author, own ring first. */
    async list(): Promise<StatusRingGroup[]> {
      if (USING_MOCKS) return mockExtras.listStatuses();
      const session = await neonAuth.getSession();
      if (!session) return [];
      const me = session.user.id;

      const rows = await dataApi<StatusRow[]>("/statuses", {
        query: {
          select: "id,user_id,media_url,media_type,caption,created_at,expires_at,profile:profiles(*),views:status_views(viewer_id)",
          expires_at: `gt.${new Date().toISOString()}`,
          order: "created_at.asc",
        },
      });

      const groups = new Map<string, StatusRingGroup>();
      for (const row of rows ?? []) {
        if (!row.profile) continue;
        const item: StatusItem = {
          id: row.id,
          user_id: row.user_id,
          media_url: row.media_url,
          media_type: row.media_type,
          caption: row.caption,
          created_at: row.created_at,
          expires_at: row.expires_at,
          viewed: row.user_id === me || (row.views ?? []).some((v) => v.viewer_id === me),
        };
        const g = groups.get(row.user_id) ?? { user: row.profile, items: [], all_viewed: true };
        g.items.push(item);
        g.all_viewed = g.all_viewed && item.viewed;
        groups.set(row.user_id, g);
      }

      return [...groups.values()].sort((a, b) => {
        if (a.user.id === me) return -1;
        if (b.user.id === me) return 1;
        if (a.all_viewed !== b.all_viewed) return a.all_viewed ? 1 : -1;
        return (
          new Date(b.items.at(-1)?.created_at ?? 0).getTime() -
          new Date(a.items.at(-1)?.created_at ?? 0).getTime()
        );
      });
    },

    async create(caption: string, media_type: StatusMediaType, media_url: string | null = null): Promise<StatusItem> {
      if (USING_MOCKS) return mockExtras.createStatus(caption, media_type);
      const session = await neonAuth.getSession();
      if (!session) throw new ApiError(401, "Not signed in");
      const rows = await dataApi<Omit<StatusItem, "viewed">[]>("/statuses", {
        method: "POST",
        headers: RETURN_ROW,
        body: JSON.stringify({ user_id: session.user.id, caption, media_type, media_url }),
      });
      const row = rows?.[0];
      if (!row) throw new ApiError(500, "Status was not saved");
      return { ...row, viewed: true };
    },

    async markViewed(id: string): Promise<{ ok: true }> {
      if (USING_MOCKS) return mockExtras.markStatusViewed(id);
      const session = await neonAuth.getSession();
      if (!session) return { ok: true };
      await dataApi("/status_views", {
        method: "POST",
        headers: { Prefer: "resolution=ignore-duplicates" },
        body: JSON.stringify({ status_id: id, viewer_id: session.user.id }),
      }).catch(() => undefined);
      return { ok: true };
    },
  },

  calls: {
    history(): Promise<CallRecord[]> {
      if (USING_MOCKS) return mockExtras.listCalls();
      return Promise.resolve([]);
    },
    start(peer_id: string, call_type: CallType): Promise<CallToken> {
      if (USING_MOCKS) return mockExtras.createCall(peer_id, call_type);
      return Promise.reject(new ApiError(501, "Calling is not available yet"));
    },
  },

  settings: {
    async get(): Promise<UserSettings> {
      if (USING_MOCKS) return mockExtras.getSettings();
      const session = await neonAuth.getSession();
      if (!session) throw new ApiError(401, "Not signed in");
      const row = await selectOne<UserSettings>("/user_settings", {
        select: "privacy_settings,notification_settings",
        user_id: `eq.${session.user.id}`,
      });
      return row ?? DEFAULT_SETTINGS;
    },
    async updatePrivacy(patch: Partial<PrivacySettings>): Promise<UserSettings> {
      if (USING_MOCKS) return mockExtras.updatePrivacy(patch);
      const current = await api.settings.get();
      return upsertSettings({ ...current, privacy_settings: { ...current.privacy_settings, ...patch } });
    },
    async updateNotifications(patch: Partial<NotificationSettings>): Promise<UserSettings> {
      if (USING_MOCKS) return mockExtras.updateNotifications(patch);
      const current = await api.settings.get();
      return upsertSettings({
        ...current,
        notification_settings: { ...current.notification_settings, ...patch },
      });
    },
  },

  blocked: {
    async list(): Promise<Profile[]> {
      if (USING_MOCKS) return mockExtras.listBlocked();
      const session = await neonAuth.getSession();
      if (!session) return [];
      const rows = await dataApi<{ profile: Profile | null }[]>("/blocked_users", {
        query: {
          select: "profile:profiles!blocked_users_blocked_id_fkey(*)",
          blocker_id: `eq.${session.user.id}`,
          order: "created_at.desc",
        },
      });
      return (rows ?? []).map((r) => r.profile).filter((p): p is Profile => Boolean(p));
    },
    async block(user_id: string): Promise<Profile[]> {
      if (USING_MOCKS) return mockExtras.block(user_id);
      const session = await neonAuth.getSession();
      if (!session) throw new ApiError(401, "Not signed in");
      await dataApi("/blocked_users", {
        method: "POST",
        headers: { Prefer: "resolution=ignore-duplicates" },
        body: JSON.stringify({ blocker_id: session.user.id, blocked_id: user_id }),
      });
      return api.blocked.list();
    },
    async unblock(user_id: string): Promise<Profile[]> {
      if (USING_MOCKS) return mockExtras.unblock(user_id);
      const session = await neonAuth.getSession();
      if (!session) throw new ApiError(401, "Not signed in");
      await dataApi("/blocked_users", {
        method: "DELETE",
        query: { blocker_id: `eq.${session.user.id}`, blocked_id: `eq.${user_id}` },
      });
      return api.blocked.list();
    },
  },

  account: {
    async exportData(): Promise<Blob> {
      if (USING_MOCKS) return mockExtras.exportData();
      const [profile, conversations, settings] = await Promise.all([
        api.profiles.me(),
        api.conversations.list(),
        api.settings.get().catch(() => DEFAULT_SETTINGS),
      ]);
      const messages = await dataApi<Message[]>("/messages", {
        query: { select: MESSAGE_SELECT, sender_id: `eq.${profile?.id ?? ""}`, order: "created_at.asc" },
      }).catch(() => [] as Message[]);
      return new Blob([JSON.stringify({ profile, settings, conversations, messages }, null, 2)], {
        type: "application/json",
      });
    },
    /** Deleting the profile row cascades to every FluidTalk table via FKs. */
    async remove(): Promise<{ ok: true }> {
      if (USING_MOCKS) return mockExtras.deleteAccount();
      const session = await neonAuth.getSession();
      if (!session) throw new ApiError(401, "Not signed in");
      await dataApi("/profiles", { method: "DELETE", query: { id: `eq.${session.user.id}` } });
      await api.auth.signOut();
      return { ok: true };
    },
  },
};

/* ------------------------------------------------------------------ */
/* Internal helpers                                                    */
/* ------------------------------------------------------------------ */

interface StatusRow {
  id: string;
  user_id: string;
  media_url: string | null;
  media_type: StatusMediaType;
  caption: string | null;
  created_at: string;
  expires_at: string;
  profile: Profile | null;
  views: { viewer_id: string }[] | null;
}

const DEFAULT_SETTINGS: UserSettings = {
  privacy_settings: {
    last_seen: "everyone",
    profile_photo: "everyone",
    status: "contacts",
    read_receipts: true,
  },
  notification_settings: { sound: true, vibration: true, message_preview: true },
};

async function upsertSettings(next: UserSettings): Promise<UserSettings> {
  const session = await neonAuth.getSession();
  if (!session) throw new ApiError(401, "Not signed in");
  const rows = await dataApi<UserSettings[]>("/user_settings", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    query: { on_conflict: "user_id", select: "privacy_settings,notification_settings" },
    body: JSON.stringify({
      user_id: session.user.id,
      privacy_settings: next.privacy_settings,
      notification_settings: next.notification_settings,
      updated_at: new Date().toISOString(),
    }),
  });
  return rows?.[0] ?? next;
}
