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

const delay = (ms = 320) => new Promise((r) => setTimeout(r, ms));
const uid = () => Math.random().toString(36).slice(2, 10);
const iso = (offsetMinutes: number) =>
  new Date(Date.now() - offsetMinutes * 60_000).toISOString();

export const CURRENT_USER: Profile = {
  id: "u_me",
  email: "you@fluidtalk.app",
  username: "you",
  display_name: "You",
  avatar_url: null,
  status: "online",
  created_at: iso(60 * 24 * 90),
};

const people: Profile[] = [
  {
    id: "u_nova",
    email: "nova@fluidtalk.app",
    username: "nova",
    display_name: "Nova Reyes",
    avatar_url: null,
    status: "online",
    created_at: iso(9000),
  },
  {
    id: "u_kai",
    email: "kai@fluidtalk.app",
    username: "kai",
    display_name: "Kai Lindqvist",
    avatar_url: null,
    status: "away",
    created_at: iso(9000),
  },
  {
    id: "u_orbit",
    email: "orbit@fluidtalk.app",
    username: "orbit",
    display_name: "Orbit Crew",
    avatar_url: null,
    status: "offline",
    created_at: iso(9000),
  },
];

export const PROFILES: Record<string, Profile> = Object.fromEntries(
  [CURRENT_USER, ...people].map((p) => [p.id, p]),
);

function msg(
  conversation_id: string,
  sender_id: string,
  content: string,
  minutesAgo: number,
  extra: Partial<Message> = {},
): Message {
  return {
    id: `m_${uid()}`,
    conversation_id,
    sender_id,
    content,
    effect_type: "none",
    scheduled_at: null,
    sent_at: iso(minutesAgo),
    created_at: iso(minutesAgo),
    reply_to_id: null,
    reactions: [],
    ...extra,
  };
}

const conversations: Conversation[] = [
  {
    id: "c_nova",
    title: "Nova Reyes",
    is_group: false,
    created_at: iso(20000),
    participants: [CURRENT_USER, people[0]!],
  },
  {
    id: "c_kai",
    title: "Kai Lindqvist",
    is_group: false,
    created_at: iso(18000),
    participants: [CURRENT_USER, people[1]!],
  },
  {
    id: "c_orbit",
    title: "Orbit Crew",
    is_group: true,
    created_at: iso(16000),
    participants: [CURRENT_USER, ...people],
  },
];

const messages: Record<string, Message[]> = {
  c_nova: [
    msg("c_nova", "u_nova", "Landing in 20. Did the render finish?", 240),
    msg("c_nova", "u_me", "Finished at 3am. It looks unreal.", 236),
    msg("c_nova", "u_nova", "Send it 👀", 234),
    msg("c_nova", "u_me", "Guess the color palette first", 230, {
      effect_type: "invisible_ink",
    }),
    msg("c_nova", "u_nova", "cyan. always cyan.", 12, {
      reactions: [{ emoji: "🔥", user_id: "u_me" }],
    }),
  ],
  c_kai: [
    msg("c_kai", "u_kai", "The build pipeline is green again.", 900),
    msg("c_kai", "u_me", "Legend. Ship it tonight?", 880),
    msg("c_kai", "u_kai", "SHIP IT", 60, { effect_type: "slam" }),
  ],
  c_orbit: [
    msg("c_orbit", "u_orbit", "Standup moved to 10:30.", 300),
    msg("c_orbit", "u_nova", "Perfect, more coffee time.", 290),
    msg("c_orbit", "u_me", "Happy launch day everyone 🚀", 60 * 24 * -1, {
      scheduled_at: new Date(Date.now() + 60 * 60 * 1000 * 12).toISOString(),
      sent_at: null,
    }),
  ],
};

const contactRequests: ContactRequest[] = [];

function decorate(c: Conversation): Conversation {
  const list = (messages[c.id] ?? []).filter((m) => !m.scheduled_at);
  return {
    ...c,
    last_message: list[list.length - 1] ?? null,
    unread_count: c.id === "c_nova" ? 2 : c.id === "c_orbit" ? 5 : 0,
  };
}

export const mockApi = {
  async emailOtp(email: string): Promise<EmailOtpResponse> {
    await delay();
    return { token: `otp_${btoa(email).slice(0, 12)}`, requiresOtp: true };
  },

  async verifyOtp(email: string, otp: string): Promise<AuthSession> {
    await delay();
    if (otp.length !== 6) throw new Error("Invalid code");
    const user: Profile = { ...CURRENT_USER, email };
    return { user, jwt: `mock.${btoa(email)}.jwt` };
  },

  async google(_idToken: string): Promise<AuthSession> {
    await delay();
    return { user: CURRENT_USER, jwt: "mock.google.jwt" };
  },

  async me(): Promise<Profile> {
    await delay(80);
    return CURRENT_USER;
  },

  async listConversations(): Promise<Conversation[]> {
    await delay(200);
    return conversations.map(decorate);
  },

  async getConversation(id: string): Promise<Conversation> {
    await delay(120);
    const c = conversations.find((x) => x.id === id);
    if (!c) throw new Error("Conversation not found");
    return decorate(c);
  },

  async listMessages(id: string, cursor?: string, limit = 30): Promise<MessagePage> {
    await delay(200);
    const all = messages[id] ?? [];
    const start = cursor ? Math.max(0, all.findIndex((m) => m.id === cursor)) : 0;
    const slice = all.slice(start, start + limit);
    const next = all[start + limit];
    return { messages: slice, nextCursor: next ? next.id : null };
  },

  async sendMessage(id: string, payload: SendMessagePayload): Promise<Message> {
    await delay(150);
    const created: Message = {
      id: `m_${uid()}`,
      conversation_id: id,
      sender_id: CURRENT_USER.id,
      content: payload.content,
      effect_type: payload.effect_type ?? "none",
      scheduled_at: payload.scheduled_at ?? null,
      sent_at: payload.scheduled_at ? null : new Date().toISOString(),
      created_at: new Date().toISOString(),
      reply_to_id: payload.reply_to_id ?? null,
      reactions: [],
    };
    messages[id] = [...(messages[id] ?? []), created];
    return created;
  },

  async createContactRequest(receiver_id: string): Promise<ContactRequest> {
    await delay();
    const req: ContactRequest = {
      id: `cr_${uid()}`,
      sender_id: CURRENT_USER.id,
      receiver_id,
      status: "pending",
      created_at: new Date().toISOString(),
    };
    contactRequests.push(req);
    return req;
  },

  async updateContactRequest(
    id: string,
    status: Exclude<ContactRequestStatus, "pending">,
  ): Promise<ContactRequest> {
    await delay();
    const req = contactRequests.find((r) => r.id === id);
    if (!req) throw new Error("Request not found");
    req.status = status;
    return req;
  },
};

/* ------------------------------------------------------------------ */
/* Status / Calls / Settings mock data                                 */
/* ------------------------------------------------------------------ */

import type {
  CallRecord,
  CallToken,
  NotificationSettings,
  PrivacySettings,
  ProfileUpdatePayload,
  StatusItem,
  StatusRingGroup,
  UserSettings,
} from "@/types";

const hoursFromNow = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

function status(
  user_id: string,
  caption: string,
  media_type: StatusItem["media_type"],
  hoursAgo: number,
  viewed = false,
): StatusItem {
  return {
    id: `s_${uid()}`,
    user_id,
    media_url: null,
    media_type,
    caption,
    created_at: iso(hoursAgo * 60),
    expires_at: hoursFromNow(24 - hoursAgo),
    viewed,
  };
}

const statuses: StatusItem[] = [
  status("u_me", "Shipping FluidTalk tonight ✨", "text", 2),
  status("u_nova", "Sunrise over the studio", "image", 1),
  status("u_nova", "Second pass on the cyan grade", "image", 3),
  status("u_kai", "Pipeline: all green", "text", 5, true),
  status("u_orbit", "Launch prep 🚀", "video", 8, true),
];

const calls: CallRecord[] = [
  {
    id: "call_1",
    peer: people[0]!,
    call_type: "video",
    status: "answered",
    direction: "incoming",
    duration_seconds: 1284,
    started_at: iso(90),
  },
  {
    id: "call_2",
    peer: people[1]!,
    call_type: "voice",
    status: "missed",
    direction: "incoming",
    duration_seconds: 0,
    started_at: iso(320),
  },
  {
    id: "call_3",
    peer: people[2]!,
    call_type: "video",
    status: "answered",
    direction: "outgoing",
    duration_seconds: 3120,
    started_at: iso(1500),
  },
  {
    id: "call_4",
    peer: people[0]!,
    call_type: "voice",
    status: "declined",
    direction: "outgoing",
    duration_seconds: 0,
    started_at: iso(2600),
  },
];

let settings: UserSettings = {
  privacy_settings: {
    last_seen: "contacts",
    profile_photo: "everyone",
    status: "contacts",
    read_receipts: true,
  },
  notification_settings: { sound: true, vibration: true, message_preview: true },
};

let blocked: Profile[] = [];
let profile: Profile = { ...CURRENT_USER, bio: "Designing calm interfaces at 3am." };

export const mockExtras = {
  async listStatuses(): Promise<StatusRingGroup[]> {
    await delay(160);
    const live = statuses.filter((s) => new Date(s.expires_at).getTime() > Date.now());
    const ids = [...new Set(live.map((s) => s.user_id))];
    return ids.map((id) => {
      const items = live.filter((s) => s.user_id === id);
      return {
        user: id === CURRENT_USER.id ? profile : (PROFILES[id] ?? profile),
        items,
        all_viewed: items.every((s) => s.viewed),
      };
    });
  },

  async createStatus(caption: string, media_type: StatusItem["media_type"]): Promise<StatusItem> {
    await delay();
    const created = status(CURRENT_USER.id, caption, media_type, 0);
    statuses.unshift(created);
    return created;
  },

  async markStatusViewed(id: string): Promise<{ ok: true }> {
    await delay(60);
    const s = statuses.find((x) => x.id === id);
    if (s) s.viewed = true;
    return { ok: true };
  },

  async listCalls(): Promise<CallRecord[]> {
    await delay(160);
    return calls;
  },

  async createCall(peer_id: string, call_type: CallRecord["call_type"]): Promise<CallToken> {
    await delay(200);
    return {
      room: `fluidtalk-${peer_id}-${uid()}`,
      token: `livekit.mock.${uid()}`,
      url: "wss://fluidtalk.livekit.cloud",
    };
  },

  async getSettings(): Promise<UserSettings> {
    await delay(120);
    return settings;
  },

  async updatePrivacy(patch: Partial<PrivacySettings>): Promise<UserSettings> {
    await delay(120);
    settings = { ...settings, privacy_settings: { ...settings.privacy_settings, ...patch } };
    return settings;
  },

  async updateNotifications(patch: Partial<NotificationSettings>): Promise<UserSettings> {
    await delay(120);
    settings = {
      ...settings,
      notification_settings: { ...settings.notification_settings, ...patch },
    };
    return settings;
  },

  async getProfile(): Promise<Profile> {
    await delay(100);
    return profile;
  },

  async updateProfile(patch: ProfileUpdatePayload): Promise<Profile> {
    await delay(180);
    profile = { ...profile, ...patch };
    return profile;
  },

  async listBlocked(): Promise<Profile[]> {
    await delay(120);
    return blocked;
  },

  async block(user_id: string): Promise<Profile[]> {
    await delay(120);
    const p = PROFILES[user_id];
    if (p && !blocked.some((b) => b.id === user_id)) blocked = [...blocked, p];
    return blocked;
  },

  async unblock(user_id: string): Promise<Profile[]> {
    await delay(120);
    blocked = blocked.filter((b) => b.id !== user_id);
    return blocked;
  },

  async exportData(): Promise<Blob> {
    await delay(300);
    const payload = { profile, conversations, messages, statuses, calls, settings };
    return new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  },

  async deleteAccount(): Promise<{ ok: true }> {
    await delay(400);
    return { ok: true };
  },
};
