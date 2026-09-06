-- Anonymous guest sessions.
--
-- Replaces Supabase's `auth.users` + `signInAnonymously()`. A session is the
-- server-verifiable identity every authorization check is made against; it is
-- created on first visit and never asks the visitor for anything.
--
-- Deliberately holds nothing personal. No email, no name, no IP — the display
-- name and emoji live in the browser's own storage, as they always have.

create table if not exists sessions (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  expires_at    timestamptz not null default now() + interval '30 days'
);

-- The cleanup sweep orders by this.
create index if not exists sessions_expires_idx on sessions (expires_at);
