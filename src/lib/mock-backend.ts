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
