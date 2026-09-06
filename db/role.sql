-- One-time setup: the restricted role the application connects as.
--
-- Run this ONCE against the Railway database, as the superuser Railway gives
-- you, then point the app's DATABASE_URL at `together_app` instead.
--
-- Why bother, when the app is the only thing talking to this database? Because
-- the authorization model is now application code, and application code has
-- bugs. If a query ever escapes the gates in lib/server/db/, this is what
-- decides whether that is a bug or a breach: `together_app` can read and write
-- the five tables it needs and can do nothing else — no DDL, no other schema,
-- no reading pg_authid, no COPY to the filesystem.
--
-- The migration runner still needs DDL, so run migrations as the owner and the
-- app as this role. `db/migrate.mjs` reads DATABASE_URL, so give the deploy
-- step MIGRATE_DATABASE_URL (owner) and the runtime DATABASE_URL (this role).

-- 1. The role. Replace the password before running; do not reuse another one.
create role together_app with login password 'REPLACE_ME';

-- 2. It may use the schema, but not change it.
grant usage on schema public to together_app;
revoke create on schema public from together_app;

-- 3. Exactly the tables the application needs, and exactly the verbs.
grant select, insert, update, delete on
  sessions, rooms, room_members, room_players, media
to together_app;

-- 4. Nothing else, including anything added later by accident.
alter default privileges in schema public
  revoke all on tables from together_app;

-- 5. No access to the migration ledger — it is the owner's record.
revoke all on schema_migrations from together_app;

-- 6. Sequences: none of these tables use them (uuid primary keys), but be
--    explicit rather than relying on that staying true.
revoke all on all sequences in schema public from together_app;

-- 7. Confirm. Every row here should be a table from step 3.
--   select table_name, privilege_type
--     from information_schema.role_table_grants
--    where grantee = 'together_app'
--    order by table_name, privilege_type;
