-- ===========================================================================
-- Together — Postgres schema for Supabase
--
-- Run this once in the SQL editor of a fresh Supabase project, then put the
-- project URL and anon key in .env.local. Until you do, the app runs entirely
-- in the browser and none of this is required.
--
-- Design notes
--   * Every id is a uuid.
--   * `rooms.state` holds the replicated room document the realtime transport
--     reads and writes. The normalised tables below it exist for anything you
--     want to query or keep after the room closes.
--   * Row Level Security is on for every table and NOTHING private is readable
--     with `using (true)`. Authorisation is enforced by policy, never by the
--     application. See the classification and the membership model below.
--
-- Every visitor has an identity
--   Guests never create an account, but they are not anonymous to the database:
--   the client calls `auth.signInAnonymously()` before touching a room, so
--   `auth.uid()` is always present and policies have something real to check.
--
-- Knowing a room code is not the same as being in the room
--   A code lets you *ask* to join, through `public.join_room(code)`. That
--   function — the only path in — records a membership row. Every read and
--   write to a room, and to everything hanging off it, then requires that
--   membership. Holding a code you were never invited to gets you nothing but
--   the ability to call `join_room` and become a member on the record.
-- ===========================================================================

create extension if not exists "pgcrypto";

-- --------------------------------------------------------------------------
-- Identity
-- --------------------------------------------------------------------------

create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text        not null default 'Guest',
  emoji        text        not null default '🌸',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.couples (
  id                uuid primary key default gen_random_uuid(),
  couple_name       text,
  partner_one       uuid references public.profiles(id) on delete set null,
  partner_two       uuid references public.profiles(id) on delete set null,
  since             date,
  emoji             text not null default '🌿',
  note              text,
  created_at        timestamptz not null default now(),
  constraint couples_distinct_partners check (partner_one is distinct from partner_two)
);

create index if not exists couples_partner_one_idx on public.couples(partner_one);
create index if not exists couples_partner_two_idx on public.couples(partner_two);

-- True when the current user belongs to the given couple.
create or replace function public.is_couple_member(couple uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.couples c
    where c.id = couple
      and (c.partner_one = auth.uid() or c.partner_two = auth.uid())
  );
$$;

-- --------------------------------------------------------------------------
-- Catalogue
-- --------------------------------------------------------------------------

create table if not exists public.experiences (
  id          text primary key,
  title       text not null,
  description text not null,
  section     text not null default 'main',
  is_new      boolean not null default false,
  mode        text not null default 'room'
);

-- --------------------------------------------------------------------------
-- Rooms and presence
-- --------------------------------------------------------------------------

create table if not exists public.rooms (
  id            uuid primary key default gen_random_uuid(),
  code          text unique not null check (code ~ '^[A-Z0-9]{4,8}$'),
  experience_id text not null,
  status        text not null default 'lobby' check (status in ('lobby','active','finished')),
  host_id       text not null,
  owner_id      uuid references auth.users(id) on delete set null,
  state         jsonb not null default '{}'::jsonb,
  -- Bumped on every write and checked by the writer. Two clients that read the
  -- same document and patch it at the same moment cannot both win: the second
  -- update matches no row, and its client re-reads and re-applies.
  version       bigint not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists rooms_code_idx on public.rooms(code);
create index if not exists rooms_updated_idx on public.rooms(updated_at desc);

create table if not exists public.room_players (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.rooms(id) on delete cascade,
  player_id  text not null,
  user_id    uuid references auth.users(id) on delete set null,
  name       text not null,
  emoji      text not null default '🌸',
  role       text not null default 'guest' check (role in ('host','guest')),
  ready      boolean not null default false,
  last_seen  timestamptz not null default now(),
  unique (room_id, player_id)
);

create index if not exists room_players_room_idx on public.room_players(room_id);

-- The authorisation record for a room. One row per participant per room.
--
-- `room_players` is presence — names, emoji, heartbeats — and is rewritten
-- constantly by the game. This table is the security boundary and is written
-- only by `join_room`, so a client can never grant itself access by writing a
-- presence row.
create table if not exists public.room_members (
  room_id   uuid not null references public.rooms(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  player_id text not null,
  role      text not null default 'guest' check (role in ('host','guest')),
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index if not exists room_members_user_idx on public.room_members(user_id);

-- True when the current user has joined the given room.
--
-- `security definer` so the check itself is not subject to the policy it is
-- being used to evaluate, which would recurse.
create or replace function public.is_room_member(room uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.room_members m
    where m.room_id = room and m.user_id = auth.uid()
  );
$$;

-- True when the current user is the room's host, according to the room document.
create or replace function public.is_room_host(room uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.room_members m
    join public.rooms r on r.id = m.room_id
    where m.room_id = room
      and m.user_id = auth.uid()
      and r.host_id = m.player_id
  );
$$;

-- --------------------------------------------------------------------------
-- Joining
-- --------------------------------------------------------------------------

-- The only way to become a member of a room.
--
-- Takes a code, not a room id, so a caller cannot enumerate rooms by uuid. The
-- room row itself is unreadable to a non-member, so this function is also the
-- only way to discover that a code corresponds to anything at all — and it
-- tells you nothing beyond the room you just legitimately joined.
--
-- Rate limiting lives in front of this (see the API layer); the 32^6 code space
-- and the 24-hour room lifetime are the other two defences against guessing.
create or replace function public.join_room(
  p_code      text,
  p_player_id text,
  p_name      text default 'Guest',
  p_emoji     text default '🌸'
)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.rooms;
begin
  if auth.uid() is null then
    raise exception 'sign in (even anonymously) before joining a room'
      using errcode = '28000';
  end if;

  if p_code !~ '^[A-Z0-9]{4,8}$' or p_player_id !~ '^[A-Za-z0-9_-]{1,64}$' then
    raise exception 'malformed room code or player id' using errcode = '22023';
  end if;

  select * into target from public.rooms
  where code = upper(p_code)
    and updated_at > now() - interval '24 hours';

  if not found then
    -- Deliberately the same message whether the room never existed or has
    -- expired, so this cannot be used to probe which codes are live.
    raise exception 'no such room' using errcode = 'P0002';
  end if;

  insert into public.room_members (room_id, user_id, player_id, role)
  values (target.id, auth.uid(), p_player_id,
          case when target.host_id = p_player_id then 'host' else 'guest' end)
  on conflict (room_id, user_id) do update set player_id = excluded.player_id;

  return target;
end;
$$;

-- Creating a room makes you its first member, atomically.
create or replace function public.create_room(
  p_code          text,
  p_experience_id text,
  p_player_id     text,
  p_state         jsonb
)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  fresh public.rooms;
begin
  if auth.uid() is null then
    raise exception 'sign in (even anonymously) before creating a room'
      using errcode = '28000';
  end if;

  if p_code !~ '^[A-Z0-9]{4,8}$' or p_player_id !~ '^[A-Za-z0-9_-]{1,64}$' then
    raise exception 'malformed room code or player id' using errcode = '22023';
  end if;

  insert into public.rooms (code, experience_id, status, host_id, owner_id, state)
  values (upper(p_code), p_experience_id, 'lobby', p_player_id, auth.uid(), p_state)
  returning * into fresh;

  insert into public.room_members (room_id, user_id, player_id, role)
  values (fresh.id, auth.uid(), p_player_id, 'host');

  return fresh;
end;
$$;

-- --------------------------------------------------------------------------
-- Gameplay
-- --------------------------------------------------------------------------

create table if not exists public.game_sessions (
  id            uuid primary key default gen_random_uuid(),
  room_id       uuid references public.rooms(id) on delete cascade,
  couple_id     uuid references public.couples(id) on delete cascade,
  experience_id text not null,
  seed          text not null,
  state         jsonb not null default '{}'::jsonb,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz
);

create index if not exists game_sessions_room_idx on public.game_sessions(room_id);
create index if not exists game_sessions_couple_idx on public.game_sessions(couple_id);

create table if not exists public.game_answers (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.game_sessions(id) on delete cascade,
  question_id text not null,
  player_id   text not null,
  answer      jsonb not null,
  answered_at timestamptz not null default now(),
  unique (session_id, question_id, player_id)
);

create table if not exists public.game_scores (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  player_id  text not null,
  score      integer not null default 0,
  detail     jsonb not null default '{}'::jsonb,
  unique (session_id, player_id)
);

-- --------------------------------------------------------------------------
-- Drawings
-- --------------------------------------------------------------------------

create table if not exists public.drawings (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid references public.game_sessions(id) on delete cascade,
  couple_id  uuid references public.couples(id) on delete cascade,
  player_id  text not null,
  prompt     text not null,
  image_path text,               -- Supabase Storage object path
  created_at timestamptz not null default now()
);

create table if not exists public.drawing_strokes (
  id         uuid primary key default gen_random_uuid(),
  drawing_id uuid not null references public.drawings(id) on delete cascade,
  ordinal    integer not null,
  stroke     jsonb not null,     -- { color, size, mode, points[] } in 0–1 space
  unique (drawing_id, ordinal)
);

-- --------------------------------------------------------------------------
-- Photos
-- --------------------------------------------------------------------------

create table if not exists public.photos (
  id         uuid primary key default gen_random_uuid(),
  couple_id  uuid references public.couples(id) on delete cascade,
  owner_id   uuid references auth.users(id) on delete cascade,
  session_id uuid references public.game_sessions(id) on delete set null,
  storage_path text not null,
  caption    text,
  taken_at   timestamptz not null default now()
);

create table if not exists public.photo_strips (
  id           uuid primary key default gen_random_uuid(),
  couple_id    uuid references public.couples(id) on delete cascade,
  owner_id     uuid references auth.users(id) on delete cascade,
  storage_path text not null,
  frame        text not null default 'classic',
  filter       text not null default 'none',
  caption      text,
  created_at   timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- Keepsakes
-- --------------------------------------------------------------------------

create table if not exists public.scrapbook_items (
  id           uuid primary key default gen_random_uuid(),
  couple_id    uuid references public.couples(id) on delete cascade,
  owner_id     uuid references auth.users(id) on delete cascade,
  kind         text not null check (kind in ('strip','drawing','photo','note')),
  storage_path text,
  title        text not null default '',
  caption      text not null default '',
  happened_on  date,
  tilt         numeric not null default 0,
  created_at   timestamptz not null default now()
);

create table if not exists public.letters (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid references auth.users(id) on delete cascade,
  couple_id   uuid references public.couples(id) on delete cascade,
  recipient   text not null,
  sender      text not null,
  subject     text not null default '',
  body        text not null,
  deliver_on  date not null,
  delivered_at timestamptz,
  opened_at   timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists letters_deliver_idx on public.letters(deliver_on);

create table if not exists public.gift_pages (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid references auth.users(id) on delete cascade,
  title      text not null,
  recipient  text not null,
  sender     text not null,
  message    text not null,
  reveal_on  date not null,
  photos     jsonb not null default '[]'::jsonb,   -- array of storage paths
  memories   jsonb not null default '[]'::jsonb,
  -- The capability that opens this one gift and nothing else. It goes in the
  -- link; it is never derivable from the id, and the table is not selectable by
  -- anyone but the owner, so a recipient cannot walk from their gift to anyone
  -- else's.
  share_token text unique not null default encode(gen_random_bytes(24), 'hex'),
  created_at timestamptz not null default now()
);

create index if not exists gift_pages_owner_idx on public.gift_pages(owner_id);

-- The recipient's door. Returns exactly one gift, and only once its date has
-- arrived — the seal is enforced here rather than by the page that renders it.
create or replace function public.get_gift(p_token text)
returns public.gift_pages
language plpgsql
security definer
set search_path = public
as $$
declare
  found_gift public.gift_pages;
begin
  select * into found_gift from public.gift_pages where share_token = p_token;

  if not found then
    raise exception 'no such gift' using errcode = 'P0002';
  end if;

  -- The owner may always preview their own. Everyone else waits.
  if found_gift.owner_id is distinct from auth.uid()
     and found_gift.reveal_on > current_date then
    raise exception 'this gift has not opened yet' using errcode = 'P0002';
  end if;

  return found_gift;
end;
$$;

-- --------------------------------------------------------------------------
-- Vision boards
-- --------------------------------------------------------------------------

create table if not exists public.vision_boards (
  id         uuid primary key default gen_random_uuid(),
  couple_id  uuid references public.couples(id) on delete cascade,
  room_id    uuid references public.rooms(id) on delete set null,
  title      text not null default 'Our Future',
  created_at timestamptz not null default now()
);

create table if not exists public.vision_board_items (
  id         uuid primary key default gen_random_uuid(),
  board_id   uuid not null references public.vision_boards(id) on delete cascade,
  kind       text not null check (kind in ('goal','dream','place','date','note','image')),
  text       text not null default '',
  storage_path text,
  x          numeric not null default 0.5,
  y          numeric not null default 0.5,
  created_by text not null,
  created_at timestamptz not null default now()
);

create index if not exists vision_items_board_idx on public.vision_board_items(board_id);

-- --------------------------------------------------------------------------
-- Connection Tree
-- --------------------------------------------------------------------------

create table if not exists public.connection_tree_progress (
  id            uuid primary key default gen_random_uuid(),
  couple_id     uuid not null references public.couples(id) on delete cascade,
  experience_id text not null,
  completions   integer not null default 0,
  last_at       timestamptz not null default now(),
  unique (couple_id, experience_id)
);


-- --------------------------------------------------------------------------
-- Housekeeping
-- --------------------------------------------------------------------------

-- Rooms are ephemeral, and `join_room` already refuses anything older than a
-- day. Schedule this so the rows go too:
--   select cron.schedule('prune-rooms', '17 * * * *',
--                        $$select public.prune_stale_rooms()$$);
create or replace function public.prune_stale_rooms(older_than interval default '24 hours')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  delete from public.rooms where updated_at < now() - older_than;
  get diagnostics removed = row_count;
  return removed;
end;
$$;

-- ===========================================================================
-- Row Level Security
--
-- Every table is classified, and the classification decides the policy. There
-- is exactly one `using (true)` in this file and it is on the experience
-- catalogue, which is a list of game titles.
--
--   PUBLIC         experiences
--                  A static catalogue. No user data. Readable by anyone,
--                  writable by no one.
--
--   PRIVATE        profiles (write), photos, photo_strips, scrapbook_items,
--                  letters, gift_pages, connection_tree_progress
--                  Reachable by the owner. Several are also reachable by the
--                  other half of a couple — see COUPLE-SHARED.
--
--   COUPLE-SHARED  couples, photos, photo_strips, scrapbook_items, letters,
--                  vision_boards, vision_board_items, connection_tree_progress
--                  Owner, or the partner named on the couple row. Membership is
--                  checked with `is_couple_member`, never inferred.
--
--   ROOM-SHARED    rooms, room_members, room_players, game_sessions,
--                  game_answers, game_scores, drawings, drawing_strokes
--                  Confined to people who have actually joined the room, by way
--                  of `is_room_member`. A room code is not access; calling
--                  `join_room` with one is what grants access.
--
--   CAPABILITY     gift_pages read path
--                  Not readable directly by anyone but the owner. Recipients go
--                  through `get_gift(share_token)`, which returns one row and
--                  refuses before the reveal date.
--
-- Two rules held throughout:
--   * No policy trusts the application to have checked anything first.
--   * No policy on private data uses `using (true)`.
-- ===========================================================================

alter table public.profiles                 enable row level security;
alter table public.couples                  enable row level security;
alter table public.experiences              enable row level security;
alter table public.rooms                    enable row level security;
alter table public.room_members             enable row level security;
alter table public.room_players             enable row level security;
alter table public.game_sessions            enable row level security;
alter table public.game_answers             enable row level security;
alter table public.game_scores              enable row level security;
alter table public.drawings                 enable row level security;
alter table public.drawing_strokes          enable row level security;
alter table public.photos                   enable row level security;
alter table public.photo_strips             enable row level security;
alter table public.scrapbook_items          enable row level security;
alter table public.letters                  enable row level security;
alter table public.gift_pages               enable row level security;
alter table public.vision_boards            enable row level security;
alter table public.vision_board_items       enable row level security;
alter table public.connection_tree_progress enable row level security;

-- Deny by default: no table may be reached by an unauthenticated request unless
-- a policy below explicitly grants it.
revoke all on all tables in schema public from anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.experiences to anon;

-- --------------------------------------------------------------------------
-- PUBLIC — the catalogue
-- --------------------------------------------------------------------------
drop policy if exists experiences_read on public.experiences;
create policy experiences_read on public.experiences
  for select to anon, authenticated using (true);

-- --------------------------------------------------------------------------
-- PRIVATE / ROOM-SHARED — profiles
--
-- A name and an emoji. You can see your own, and you can see the profile of
-- someone you are actually in a room or a couple with — which is what the
-- lobby and every scoreboard need. Not the whole table.
-- --------------------------------------------------------------------------
drop policy if exists profiles_read   on public.profiles;
drop policy if exists profiles_write  on public.profiles;
drop policy if exists profiles_update on public.profiles;
drop policy if exists profiles_delete on public.profiles;

create policy profiles_read on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.room_members mine
      join public.room_members theirs on theirs.room_id = mine.room_id
      where mine.user_id = auth.uid() and theirs.user_id = public.profiles.id
    )
    or exists (
      select 1 from public.couples c
      where (c.partner_one = auth.uid() and c.partner_two = public.profiles.id)
         or (c.partner_two = auth.uid() and c.partner_one = public.profiles.id)
    )
  );
create policy profiles_write  on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_delete on public.profiles for delete to authenticated using (id = auth.uid());

-- --------------------------------------------------------------------------
-- COUPLE-SHARED — couples
-- --------------------------------------------------------------------------
drop policy if exists couples_read   on public.couples;
drop policy if exists couples_write  on public.couples;
drop policy if exists couples_update on public.couples;
drop policy if exists couples_delete on public.couples;

create policy couples_read on public.couples for select to authenticated
  using (partner_one = auth.uid() or partner_two = auth.uid());
create policy couples_write on public.couples for insert to authenticated
  with check (partner_one = auth.uid() or partner_two = auth.uid());
create policy couples_update on public.couples for update to authenticated
  using (partner_one = auth.uid() or partner_two = auth.uid())
  with check (partner_one = auth.uid() or partner_two = auth.uid());
create policy couples_delete on public.couples for delete to authenticated
  using (partner_one = auth.uid() or partner_two = auth.uid());

-- --------------------------------------------------------------------------
-- ROOM-SHARED — the room document
--
-- `state` holds every answer, argument, drawing and chat line in the session,
-- so this is the policy that matters most. Members only, for both directions.
-- There is no insert policy at all: rooms are created by `create_room`, which
-- makes the creator a member in the same transaction.
-- --------------------------------------------------------------------------
drop policy if exists rooms_read   on public.rooms;
drop policy if exists rooms_write  on public.rooms;
drop policy if exists rooms_update on public.rooms;
drop policy if exists rooms_delete on public.rooms;

create policy rooms_read on public.rooms for select to authenticated
  using (public.is_room_member(id));
create policy rooms_update on public.rooms for update to authenticated
  using (public.is_room_member(id))
  with check (public.is_room_member(id));
create policy rooms_delete on public.rooms for delete to authenticated
  using (owner_id = auth.uid());

-- Membership is readable by fellow members and created only by `join_room`.
-- No insert or update policy exists, so a client cannot enrol itself.
drop policy if exists room_members_read   on public.room_members;
drop policy if exists room_members_delete on public.room_members;
create policy room_members_read on public.room_members for select to authenticated
  using (public.is_room_member(room_id));
create policy room_members_delete on public.room_members for delete to authenticated
  using (user_id = auth.uid());

-- Presence rows. Members may read them all and write only their own seat.
drop policy if exists room_players_all    on public.room_players;
drop policy if exists room_players_read   on public.room_players;
drop policy if exists room_players_write  on public.room_players;
drop policy if exists room_players_update on public.room_players;
drop policy if exists room_players_delete on public.room_players;

create policy room_players_read on public.room_players for select to authenticated
  using (public.is_room_member(room_id));
create policy room_players_write on public.room_players for insert to authenticated
  with check (
    public.is_room_member(room_id)
    and exists (
      select 1 from public.room_members m
      where m.room_id = room_players.room_id
        and m.user_id = auth.uid()
        and m.player_id = room_players.player_id
    )
  );
create policy room_players_update on public.room_players for update to authenticated
  using (
    exists (
      select 1 from public.room_members m
      where m.room_id = room_players.room_id
        and m.user_id = auth.uid()
        and m.player_id = room_players.player_id
    )
  )
  with check (public.is_room_member(room_id));
create policy room_players_delete on public.room_players for delete to authenticated
  using (
    exists (
      select 1 from public.room_members m
      where m.room_id = room_players.room_id
        and m.user_id = auth.uid()
        and m.player_id = room_players.player_id
    )
  );

-- --------------------------------------------------------------------------
-- ROOM-SHARED / COUPLE-SHARED — gameplay
--
-- A session belongs either to a room (members only) or to a couple (partners
-- only). A row with neither is unreachable, which is the safe default.
-- --------------------------------------------------------------------------
drop policy if exists game_sessions_all on public.game_sessions;
drop policy if exists game_sessions_rw  on public.game_sessions;
create policy game_sessions_rw on public.game_sessions for all to authenticated
  using (
    (room_id is not null and public.is_room_member(room_id))
    or (couple_id is not null and public.is_couple_member(couple_id))
  )
  with check (
    (room_id is not null and public.is_room_member(room_id))
    or (couple_id is not null and public.is_couple_member(couple_id))
  );

drop policy if exists game_answers_all on public.game_answers;
drop policy if exists game_answers_rw  on public.game_answers;
create policy game_answers_rw on public.game_answers for all to authenticated
  using (
    exists (
      select 1 from public.game_sessions s
      where s.id = game_answers.session_id
        and ((s.room_id is not null and public.is_room_member(s.room_id))
          or (s.couple_id is not null and public.is_couple_member(s.couple_id)))
    )
  )
  with check (
    exists (
      select 1 from public.game_sessions s
      where s.id = game_answers.session_id
        and ((s.room_id is not null and public.is_room_member(s.room_id))
          or (s.couple_id is not null and public.is_couple_member(s.couple_id)))
    )
  );

drop policy if exists game_scores_all on public.game_scores;
drop policy if exists game_scores_rw  on public.game_scores;
create policy game_scores_rw on public.game_scores for all to authenticated
  using (
    exists (
      select 1 from public.game_sessions s
      where s.id = game_scores.session_id
        and ((s.room_id is not null and public.is_room_member(s.room_id))
          or (s.couple_id is not null and public.is_couple_member(s.couple_id)))
    )
  )
  with check (
    exists (
      select 1 from public.game_sessions s
      where s.id = game_scores.session_id
        and ((s.room_id is not null and public.is_room_member(s.room_id))
          or (s.couple_id is not null and public.is_couple_member(s.couple_id)))
    )
  );

-- --------------------------------------------------------------------------
-- ROOM-SHARED / COUPLE-SHARED — drawings
-- --------------------------------------------------------------------------
drop policy if exists drawings_all on public.drawings;
drop policy if exists drawings_rw  on public.drawings;
create policy drawings_rw on public.drawings for all to authenticated
  using (
    (couple_id is not null and public.is_couple_member(couple_id))
    or exists (
      select 1 from public.game_sessions s
      where s.id = drawings.session_id
        and s.room_id is not null
        and public.is_room_member(s.room_id)
    )
  )
  with check (
    (couple_id is not null and public.is_couple_member(couple_id))
    or exists (
      select 1 from public.game_sessions s
      where s.id = drawings.session_id
        and s.room_id is not null
        and public.is_room_member(s.room_id)
    )
  );

drop policy if exists drawing_strokes_all on public.drawing_strokes;
drop policy if exists drawing_strokes_rw  on public.drawing_strokes;
create policy drawing_strokes_rw on public.drawing_strokes for all to authenticated
  using (
    exists (
      select 1 from public.drawings d
      where d.id = drawing_strokes.drawing_id
        and ((d.couple_id is not null and public.is_couple_member(d.couple_id))
          or exists (
            select 1 from public.game_sessions s
            where s.id = d.session_id and s.room_id is not null
              and public.is_room_member(s.room_id)
          ))
    )
  )
  with check (
    exists (
      select 1 from public.drawings d
      where d.id = drawing_strokes.drawing_id
        and ((d.couple_id is not null and public.is_couple_member(d.couple_id))
          or exists (
            select 1 from public.game_sessions s
            where s.id = d.session_id and s.room_id is not null
              and public.is_room_member(s.room_id)
          ))
    )
  );

-- --------------------------------------------------------------------------
-- PRIVATE / COUPLE-SHARED — anything with a face or a confidence in it
-- --------------------------------------------------------------------------
drop policy if exists photos_owner       on public.photos;
drop policy if exists photo_strips_owner on public.photo_strips;
drop policy if exists scrapbook_owner    on public.scrapbook_items;

create policy photos_owner on public.photos for all to authenticated
  using (owner_id = auth.uid() or (couple_id is not null and public.is_couple_member(couple_id)))
  with check (owner_id = auth.uid());
create policy photo_strips_owner on public.photo_strips for all to authenticated
  using (owner_id = auth.uid() or (couple_id is not null and public.is_couple_member(couple_id)))
  with check (owner_id = auth.uid());
create policy scrapbook_owner on public.scrapbook_items for all to authenticated
  using (owner_id = auth.uid() or (couple_id is not null and public.is_couple_member(couple_id)))
  with check (owner_id = auth.uid());

-- Letters are sealed until their date. The author may always read their own
-- draft; the other half of the couple cannot read it a day early.
drop policy if exists letters_owner  on public.letters;
drop policy if exists letters_read   on public.letters;
drop policy if exists letters_write  on public.letters;
drop policy if exists letters_update on public.letters;
drop policy if exists letters_delete on public.letters;

create policy letters_read on public.letters for select to authenticated
  using (
    owner_id = auth.uid()
    or (couple_id is not null and public.is_couple_member(couple_id) and deliver_on <= current_date)
  );
create policy letters_write on public.letters for insert to authenticated
  with check (owner_id = auth.uid());
create policy letters_update on public.letters for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy letters_delete on public.letters for delete to authenticated
  using (owner_id = auth.uid());

-- --------------------------------------------------------------------------
-- CAPABILITY — gift pages
--
-- No general read. The owner sees their own; a recipient calls
-- `get_gift(share_token)`, which returns that one gift and only after its date.
-- --------------------------------------------------------------------------
drop policy if exists gift_pages_read  on public.gift_pages;
drop policy if exists gift_pages_write on public.gift_pages;
create policy gift_pages_owner on public.gift_pages for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- --------------------------------------------------------------------------
-- COUPLE-SHARED / ROOM-SHARED — vision boards
--
-- A board with neither a couple nor a room attached is nobody's, and stays
-- unreachable. The previous `couple_id is null or …` made exactly that row
-- readable by everyone.
-- --------------------------------------------------------------------------
drop policy if exists vision_boards_member on public.vision_boards;
drop policy if exists vision_items_member  on public.vision_board_items;

create policy vision_boards_member on public.vision_boards for all to authenticated
  using (
    (couple_id is not null and public.is_couple_member(couple_id))
    or (room_id is not null and public.is_room_member(room_id))
  )
  with check (
    (couple_id is not null and public.is_couple_member(couple_id))
    or (room_id is not null and public.is_room_member(room_id))
  );

create policy vision_items_member on public.vision_board_items for all to authenticated
  using (
    exists (
      select 1 from public.vision_boards b
      where b.id = vision_board_items.board_id
        and ((b.couple_id is not null and public.is_couple_member(b.couple_id))
          or (b.room_id is not null and public.is_room_member(b.room_id)))
    )
  )
  with check (
    exists (
      select 1 from public.vision_boards b
      where b.id = vision_board_items.board_id
        and ((b.couple_id is not null and public.is_couple_member(b.couple_id))
          or (b.room_id is not null and public.is_room_member(b.room_id)))
    )
  );

-- --------------------------------------------------------------------------
-- COUPLE-SHARED — the Connection Tree
-- --------------------------------------------------------------------------
drop policy if exists tree_member on public.connection_tree_progress;
create policy tree_member on public.connection_tree_progress for all to authenticated
  using (public.is_couple_member(couple_id))
  with check (public.is_couple_member(couple_id));

-- --------------------------------------------------------------------------
-- Function privileges
--
-- The three `security definer` functions are the only elevated paths, so each
-- is granted deliberately. `anon` gets nothing: the client signs in
-- anonymously first, which makes it `authenticated`.
-- --------------------------------------------------------------------------
revoke all on function public.join_room(text, text, text, text) from public, anon;
revoke all on function public.create_room(text, text, text, jsonb) from public, anon;
revoke all on function public.get_gift(text) from public, anon;
revoke all on function public.is_room_member(uuid) from public, anon;
revoke all on function public.is_room_host(uuid) from public, anon;
revoke all on function public.is_couple_member(uuid) from public, anon;
revoke all on function public.prune_stale_rooms(interval) from public, anon, authenticated;

grant execute on function public.join_room(text, text, text, text) to authenticated;
grant execute on function public.create_room(text, text, text, jsonb) to authenticated;
grant execute on function public.get_gift(text) to authenticated;
grant execute on function public.is_room_member(uuid) to authenticated;
grant execute on function public.is_room_host(uuid) to authenticated;
grant execute on function public.is_couple_member(uuid) to authenticated;


-- ===========================================================================
-- Realtime + Storage
-- ===========================================================================

-- The transport subscribes to postgres_changes on rooms as a reconnect path.
-- Realtime respects RLS, so a subscriber still only receives rows its policies
-- allow — which, with `rooms_read`, means rooms it has actually joined.
alter publication supabase_realtime add table public.rooms;
alter table public.rooms replica identity full;

-- Private buckets for anything with a face in it.
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false), ('drawings', 'drawings', false)
on conflict (id) do nothing;

-- Objects are addressed as `<user-uuid>/<filename>`, so ownership is provable
-- from the path itself rather than from the deprecated `owner` column. A
-- couple's partner may read, but only the uploader may write or delete.
drop policy if exists "own photo objects"     on storage.objects;
drop policy if exists "read own media"        on storage.objects;
drop policy if exists "write own media"       on storage.objects;
drop policy if exists "update own media"      on storage.objects;
drop policy if exists "delete own media"      on storage.objects;

create policy "read own media" on storage.objects for select to authenticated
  using (
    bucket_id in ('photos', 'drawings')
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.couples c
        where (c.partner_one = auth.uid() and c.partner_two::text = (storage.foldername(name))[1])
           or (c.partner_two = auth.uid() and c.partner_one::text = (storage.foldername(name))[1])
      )
    )
  );

create policy "write own media" on storage.objects for insert to authenticated
  with check (
    bucket_id in ('photos', 'drawings')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "update own media" on storage.objects for update to authenticated
  using (
    bucket_id in ('photos', 'drawings')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "delete own media" on storage.objects for delete to authenticated
  using (
    bucket_id in ('photos', 'drawings')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ===========================================================================
-- Housekeeping
-- ===========================================================================


-- Keep a profile row in step with auth.users.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', 'Guest'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
