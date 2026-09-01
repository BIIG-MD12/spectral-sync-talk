-- ============================================================================
-- FluidTalk — Neon schema + Row Level Security
-- Run this once in the Neon SQL Editor (neondb) with the Data API enabled.
-- Identity comes from Neon Auth JWTs: auth.user_id() returns the JWT `sub`.
-- The browser ONLY ever uses the signed-in user's JWT; these policies decide
-- what that identity may read or write.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id           text primary key,                       -- Neon Auth user id (JWT sub)
  email        text not null,
  username     text not null unique,
  display_name text not null,
  avatar_url   text,
  bio          text,
  status       text not null default 'offline' check (status in ('online','offline','away')),
  created_at   timestamptz not null default now()
);

create table if not exists public.conversations (
  id         uuid primary key default gen_random_uuid(),
  title      text,
  is_group   boolean not null default false,
  created_by text not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id         text not null references public.profiles(id) on delete cascade,
  joined_at       timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       text not null references public.profiles(id) on delete cascade,
  content         text not null,
  effect_type     text not null default 'none'
                  check (effect_type in ('none','invisible_ink','slam','loud','gentle')),
  reply_to_id     uuid references public.messages(id) on delete set null,
  scheduled_at    timestamptz,
  sent_at         timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at desc);
create index if not exists messages_created_idx on public.messages (created_at);

create table if not exists public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id    text not null references public.profiles(id) on delete cascade,
  emoji      text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create table if not exists public.contact_requests (
  id          uuid primary key default gen_random_uuid(),
  sender_id   text not null references public.profiles(id) on delete cascade,
  receiver_id text not null references public.profiles(id) on delete cascade,
  status      text not null default 'pending' check (status in ('pending','accepted','rejected')),
  created_at  timestamptz not null default now(),
  unique (sender_id, receiver_id)
);

create table if not exists public.user_settings (
  user_id               text primary key references public.profiles(id) on delete cascade,
  privacy_settings      jsonb not null default
    '{"last_seen":"everyone","profile_photo":"everyone","status":"contacts","read_receipts":true}'::jsonb,
  notification_settings jsonb not null default
    '{"sound":true,"vibration":true,"message_preview":true}'::jsonb,
  updated_at            timestamptz not null default now()
);

create table if not exists public.blocked_users (
  blocker_id text not null references public.profiles(id) on delete cascade,
  blocked_id text not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

create table if not exists public.statuses (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null references public.profiles(id) on delete cascade,
  media_url  text,
  media_type text not null default 'text' check (media_type in ('image','video','text')),
  caption    text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);
create index if not exists statuses_expires_idx on public.statuses (expires_at);

create table if not exists public.status_views (
  status_id uuid not null references public.statuses(id) on delete cascade,
  viewer_id text not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (status_id, viewer_id)
);

-- ---------------------------------------------------------------------------
-- Grants for the Data API roles
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated, anonymous;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on all tables in schema public from anonymous;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;

-- ---------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER avoids recursive RLS on participants)
-- ---------------------------------------------------------------------------
create or replace function public.is_participant(conv uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = conv and user_id = auth.user_id()
  );
$$;

create or replace function public.shares_conversation_with(other text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.conversation_participants a
    join public.conversation_participants b on a.conversation_id = b.conversation_id
    where a.user_id = auth.user_id() and b.user_id = other
  );
$$;

create or replace function public.is_blocked_between(a text, b text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.blocked_users
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles                  enable row level security;
alter table public.conversations             enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages                  enable row level security;
alter table public.message_reactions         enable row level security;
alter table public.contact_requests          enable row level security;
alter table public.user_settings             enable row level security;
alter table public.blocked_users             enable row level security;
alter table public.statuses                  enable row level security;
alter table public.status_views              enable row level security;

-- profiles: any signed-in user can look people up; you manage only your own row
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (auth.user_id() is not null);
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated
  with check (id = auth.user_id());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.user_id()) with check (id = auth.user_id());

-- conversations: visible to participants; creatable by the signed-in user
drop policy if exists conversations_select on public.conversations;
create policy conversations_select on public.conversations for select to authenticated
  using (public.is_participant(id) or created_by = auth.user_id());
drop policy if exists conversations_insert on public.conversations;
create policy conversations_insert on public.conversations for insert to authenticated
  with check (created_by = auth.user_id());
drop policy if exists conversations_update on public.conversations;
create policy conversations_update on public.conversations for update to authenticated
  using (public.is_participant(id));

-- participants: see members of your conversations; creator adds members; you can leave
drop policy if exists participants_select on public.conversation_participants;
create policy participants_select on public.conversation_participants for select to authenticated
  using (public.is_participant(conversation_id));
drop policy if exists participants_insert on public.conversation_participants;
create policy participants_insert on public.conversation_participants for insert to authenticated
  with check (
    exists (select 1 from public.conversations c
            where c.id = conversation_id and c.created_by = auth.user_id())
    or public.is_participant(conversation_id)
  );
drop policy if exists participants_delete on public.conversation_participants;
create policy participants_delete on public.conversation_participants for delete to authenticated
  using (user_id = auth.user_id());

-- messages: participants read; only you can send as yourself; edit/delete your own
drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages for select to authenticated
  using (public.is_participant(conversation_id));
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert to authenticated
  with check (sender_id = auth.user_id() and public.is_participant(conversation_id));
drop policy if exists messages_update on public.messages;
create policy messages_update on public.messages for update to authenticated
  using (sender_id = auth.user_id());
drop policy if exists messages_delete on public.messages;
create policy messages_delete on public.messages for delete to authenticated
  using (sender_id = auth.user_id());

-- reactions
drop policy if exists reactions_select on public.message_reactions;
create policy reactions_select on public.message_reactions for select to authenticated
  using (exists (select 1 from public.messages m
                 where m.id = message_id and public.is_participant(m.conversation_id)));
drop policy if exists reactions_write on public.message_reactions;
create policy reactions_write on public.message_reactions for all to authenticated
  using (user_id = auth.user_id()) with check (user_id = auth.user_id());

-- contact requests: both parties see; sender creates; receiver answers
drop policy if exists contact_requests_select on public.contact_requests;
create policy contact_requests_select on public.contact_requests for select to authenticated
  using (sender_id = auth.user_id() or receiver_id = auth.user_id());
drop policy if exists contact_requests_insert on public.contact_requests;
create policy contact_requests_insert on public.contact_requests for insert to authenticated
  with check (sender_id = auth.user_id() and not public.is_blocked_between(sender_id, receiver_id));
drop policy if exists contact_requests_update on public.contact_requests;
create policy contact_requests_update on public.contact_requests for update to authenticated
  using (receiver_id = auth.user_id());

-- settings & blocks: strictly private
drop policy if exists settings_own on public.user_settings;
create policy settings_own on public.user_settings for all to authenticated
  using (user_id = auth.user_id()) with check (user_id = auth.user_id());
drop policy if exists blocked_own on public.blocked_users;
create policy blocked_own on public.blocked_users for all to authenticated
  using (blocker_id = auth.user_id()) with check (blocker_id = auth.user_id());

-- statuses: your own + people you share a conversation with (unless blocked)
drop policy if exists statuses_select on public.statuses;
create policy statuses_select on public.statuses for select to authenticated
  using (
    expires_at > now()
    and (user_id = auth.user_id()
         or (public.shares_conversation_with(user_id)
             and not public.is_blocked_between(user_id, auth.user_id())))
  );
drop policy if exists statuses_write on public.statuses;
create policy statuses_write on public.statuses for all to authenticated
  using (user_id = auth.user_id()) with check (user_id = auth.user_id());

drop policy if exists status_views_select on public.status_views;
create policy status_views_select on public.status_views for select to authenticated
  using (viewer_id = auth.user_id()
         or exists (select 1 from public.statuses s
                    where s.id = status_id and s.user_id = auth.user_id()));
drop policy if exists status_views_insert on public.status_views;
create policy status_views_insert on public.status_views for insert to authenticated
  with check (viewer_id = auth.user_id());
