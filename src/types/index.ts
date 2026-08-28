export type EffectType = "none" | "invisible_ink" | "slam" | "loud" | "gentle";
export type ContactRequestStatus = "pending" | "accepted" | "rejected";
export type PresenceStatus = "online" | "offline" | "away";

export interface Profile {
  id: string;
  email: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  status: PresenceStatus;
  created_at: string;
}

export interface Conversation {
  id: string;
  title: string;
  is_group: boolean;
  created_at: string;
  /** joined fields returned by GET /api/conversations */
  last_message?: Message | null;
  unread_count?: number;
  participants?: Profile[];
}

export interface Participant {
  conversation_id: string;
  user_id: string;
  joined_at: string;
}

export interface Reaction {
  emoji: string;
  user_id: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  effect_type: EffectType;
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string;
  reply_to_id?: string | null;
  reactions?: Reaction[];
}

export interface ContactRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: ContactRequestStatus;
  created_at: string;
}

/* ---- API payload/response contracts ---- */

export interface EmailOtpResponse {
  token: string;
  requiresOtp: boolean;
}

export interface AuthSession {
  user: Profile;
  jwt: string;
}

export interface MessagePage {
  messages: Message[];
  nextCursor: string | null;
}

export interface SendMessagePayload {
  content: string;
  effect_type?: EffectType;
  reply_to_id?: string | null;
  scheduled_at?: string | null;
}

/* ---- Status / Stories ---- */

export type StatusMediaType = "image" | "video" | "text";

export interface StatusItem {
  id: string;
  user_id: string;
  media_url: string | null;
  media_type: StatusMediaType;
  caption: string | null;
  created_at: string;
  expires_at: string;
  viewed: boolean;
}

export interface StatusRingGroup {
  user: Profile;
  items: StatusItem[];
  all_viewed: boolean;
}

/* ---- Calls ---- */

export type CallType = "voice" | "video";
export type CallStatus = "answered" | "missed" | "declined";
export type CallDirection = "incoming" | "outgoing";

export interface CallRecord {
  id: string;
  peer: Profile;
  call_type: CallType;
  status: CallStatus;
  direction: CallDirection;
  duration_seconds: number;
  started_at: string;
}

export interface CallToken {
  room: string;
  token: string;
  url: string;
}

/* ---- Profile / settings ---- */

export type Visibility = "everyone" | "contacts" | "nobody";

export interface PrivacySettings {
  last_seen: Visibility;
  profile_photo: Visibility;
  status: Visibility;
  read_receipts: boolean;
}

export interface NotificationSettings {
  sound: boolean;
  vibration: boolean;
  message_preview: boolean;
}

export interface UserSettings {
  privacy_settings: PrivacySettings;
  notification_settings: NotificationSettings;
}

export interface ProfileUpdatePayload {
  display_name?: string;
  username?: string;
  bio?: string;
  avatar_url?: string | null;
}
