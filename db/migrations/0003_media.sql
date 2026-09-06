-- Photo references.
--
-- The bytes live in object storage. This table holds only what is needed to
-- decide whether a given session may have a signed URL for a given object, and
-- to sweep the objects when their room expires.

create table if not exists media (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references rooms(id) on delete cascade,
  session_id   uuid not null references sessions(id) on delete cascade,
  player_id    text not null,
  -- 'booth' | 'hunt'. Kept as text so a new experience does not need a migration.
  kind         text not null,
  object_key   text unique not null,
  content_type text not null default 'image/jpeg',
  bytes        integer not null default 0,
  -- Set once the client confirms the upload landed. Rows that never get here
  -- are abandoned uploads and are swept.
  uploaded_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists media_room_idx    on media (room_id);
create index if not exists media_pending_idx on media (created_at) where uploaded_at is null;
