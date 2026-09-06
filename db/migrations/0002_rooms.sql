-- Rooms, membership and presence.
--
-- Three tables doing three different jobs, deliberately not one:
--
--   rooms         the replicated document every experience reads and writes
--   room_members  the authorization record — who is allowed near that document
--   room_players  presence, which changes every few seconds and must not drag
--                 the document along with it
--
-- Splitting presence out is the fix for the write amplification the Supabase
-- design had: a heartbeat used to rewrite the whole `state` blob, which during
-- a Draw Together round means every stroke both players have drawn, twenty
-- times a minute.

create table if not exists rooms (
  id            uuid primary key default gen_random_uuid(),
  code          text unique not null check (code ~ '^[A-Z0-9]{4,8}$'),
  experience_id text not null,
  status        text not null default 'lobby' check (status in ('lobby','active','finished')),
  host_id       text not null,
  owner_id      uuid references sessions(id) on delete set null,
  state         jsonb not null default '{}'::jsonb,
  -- Compare-and-set. A writer sends the version it derived its patch from; a
  -- mismatch means someone else landed first and the writer retries.
  version       bigint not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists rooms_code_idx    on rooms (code);
-- The 24-hour expiry sweep.
create index if not exists rooms_expiry_idx  on rooms (updated_at);

-- Membership. Written only by the join path, never by a client request that
-- carries its own idea of who it is.
create table if not exists room_members (
  room_id    uuid not null references rooms(id) on delete cascade,
  session_id uuid not null references sessions(id) on delete cascade,
  player_id  text not null check (player_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  role       text not null default 'guest' check (role in ('host','guest')),
  joined_at  timestamptz not null default now(),
  primary key (room_id, session_id)
);

create index if not exists room_members_room_idx    on room_members (room_id);
create index if not exists room_members_session_idx on room_members (session_id);
-- One seat per player id within a room, whichever session holds it.
create unique index if not exists room_members_seat_idx on room_members (room_id, player_id);

-- Presence. High-churn, small rows, never part of the room document.
create table if not exists room_players (
  room_id    uuid not null references rooms(id) on delete cascade,
  player_id  text not null,
  session_id uuid not null references sessions(id) on delete cascade,
  name       text not null default 'Guest',
  emoji      text not null default '🌸',
  ready      boolean not null default false,
  last_seen  timestamptz not null default now(),
  primary key (room_id, player_id)
);

create index if not exists room_players_room_idx      on room_players (room_id);
create index if not exists room_players_last_seen_idx on room_players (room_id, last_seen);
