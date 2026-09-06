/**
 * RLS test matrix.
 *
 * Runs `schema.sql` against a real Postgres (PGlite, in-process) and then acts
 * as each kind of caller in turn, asserting what they can and cannot do. The
 * point is to check the *policies*, not the application: every statement here
 * goes straight to the database as the role in question, with no client library
 * in between to be fooled.
 *
 *   node supabase/rls.test.mjs
 *
 * Supabase's own objects — the `auth` and `storage` schemas, the `anon` and
 * `authenticated` roles, `auth.uid()` — are recreated below exactly as Supabase
 * defines them, because `schema.sql` is written against them.
 */
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

const PRELUDE = `
create extension if not exists "pgcrypto";
create schema if not exists auth;
create schema if not exists storage;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;

grant usage on schema public to anon, authenticated;
grant usage on schema storage to anon, authenticated;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  is_anonymous boolean not null default false
);

-- Supabase reads the subject out of the request JWT. A GUC stands in for it.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
grant execute on function auth.uid() to anon, authenticated;

create table if not exists storage.buckets (
  id text primary key, name text not null, public boolean not null default false
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text not null,
  owner uuid
);
alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects to authenticated;
grant select on storage.objects to anon;

create or replace function storage.foldername(name text) returns text[]
language sql immutable as $$
  select string_to_array(name, '/');
$$;
grant execute on function storage.foldername(text) to anon, authenticated;

create publication supabase_realtime;
`;

const db = await PGlite.create({ extensions: { pgcrypto } });
await db.exec(PRELUDE);

// schema.sql assumes Supabase's default privileges on new tables.
const schema = readFileSync(join(here, "schema.sql"), "utf8");
await db.exec(schema);

// ---------------------------------------------------------------- test rig --

let pass = 0;
const failures = [];

/** Runs `sql` as `role`, acting as `uid` (null = signed out). */
async function as(role, uid, sql, params = []) {
  await db.exec("reset role;");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid ?? ""]);
  await db.exec(`set role ${role};`);
  try {
    const result = await db.query(sql, params);
    return { ok: true, rows: result.rows, count: result.rows.length, affected: result.affectedRows };
  } catch (error) {
    return { ok: false, error: String(error.message ?? error) };
  } finally {
    await db.exec("reset role;");
  }
}

function check(label, condition, detail = "") {
  if (condition) {
    pass++;
    console.log(`  ok    ${label}`);
  } else {
    failures.push(`${label}${detail ? ` — ${detail}` : ""}`);
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

/** A read that must return nothing (or be refused outright). */
function denied(label, result) {
  check(
    label,
    !result.ok || result.count === 0,
    result.ok ? `returned ${result.count} row(s)` : "",
  );
}

/** A write that must be refused, or silently affect no rows. */
function blocked(label, result) {
  check(
    label,
    !result.ok || result.affected === 0,
    result.ok ? `affected ${result.affected} row(s)` : "",
  );
}

function allowed(label, result, minRows = 1) {
  check(label, result.ok && result.count >= minRows, result.ok ? `got ${result.count}` : result.error);
}

// ------------------------------------------------------------------ actors --

const ids = {};
for (const who of ["alice", "bob", "mallory", "recipient"]) {
  const r = await db.query(
    "insert into auth.users (email, is_anonymous) values ($1, false) returning id",
    [`${who}@example.test`],
  );
  ids[who] = r.rows[0].id;
}
// The trigger creates profiles; make sure they exist even if it did not fire.
for (const [who, id] of Object.entries(ids)) {
  await db.query(
    "insert into public.profiles (id, display_name) values ($1, $2) on conflict (id) do nothing",
    [id, who],
  );
}

console.log("\n=== Setup: alice hosts a room, bob joins, mallory does not ===");

const created = await as(
  "authenticated",
  ids.alice,
  "select * from public.create_room($1, $2, $3, $4)",
  ["ROOMAA", "know-me", "p_alice", JSON.stringify({ secret: "alice private answers" })],
);
check("alice can create a room", created.ok, created.error);
const roomId = created.rows?.[0]?.id;

const joined = await as("authenticated", ids.bob, "select * from public.join_room($1, $2)", [
  "ROOMAA",
  "p_bob",
]);
check("bob can join with the code", joined.ok, joined.error);

console.log("\n=== ANONYMOUS (signed out, role anon) ===");
denied("cannot list rooms", await as("anon", null, "select * from public.rooms"));
denied("cannot read room state", await as("anon", null, "select state from public.rooms"));
denied("cannot read room members", await as("anon", null, "select * from public.room_members"));
denied("cannot read profiles", await as("anon", null, "select * from public.profiles"));
denied("cannot read letters", await as("anon", null, "select * from public.letters"));
denied("cannot read gift pages", await as("anon", null, "select * from public.gift_pages"));
denied("cannot read scrapbook", await as("anon", null, "select * from public.scrapbook_items"));
denied("cannot read drawings", await as("anon", null, "select * from public.drawings"));
denied("cannot read answers", await as("anon", null, "select * from public.game_answers"));
blocked(
  "cannot overwrite room state",
  await as("anon", null, "update public.rooms set state = '{\"pwned\":true}'::jsonb"),
);
blocked("cannot insert a room", await as("anon", null,
  "insert into public.rooms (code, experience_id, host_id, state) values ('EVILAA','x','p_x','{}'::jsonb)"));
blocked("cannot enrol itself as a member", await as("anon", null,
  `insert into public.room_members (room_id, user_id, player_id) values ('${roomId}', '${ids.mallory}', 'p_m')`));
check(
  "cannot call join_room",
  !(await as("anon", null, "select public.join_room('ROOMAA','p_anon')")).ok,
);
allowed("can read the experience catalogue", await as("anon", null,
  "select 1 where exists (select 1 from pg_policies where tablename='experiences')"));

console.log("\n=== RANDOM ATTACKER (authenticated, never joined) ===");
denied("cannot enumerate rooms", await as("authenticated", ids.mallory, "select * from public.rooms"));
denied(
  "cannot read a room by its uuid",
  await as("authenticated", ids.mallory, "select * from public.rooms where id = $1", [roomId]),
);
denied(
  "cannot read a room by its code",
  await as("authenticated", ids.mallory, "select * from public.rooms where code = 'ROOMAA'"),
);
denied("cannot read membership", await as("authenticated", ids.mallory, "select * from public.room_members"));
denied("cannot read presence", await as("authenticated", ids.mallory, "select * from public.room_players"));
blocked(
  "cannot overwrite room state",
  await as("authenticated", ids.mallory, "update public.rooms set state = '{\"pwned\":true}'::jsonb"),
);
blocked(
  "cannot delete the room",
  await as("authenticated", ids.mallory, "delete from public.rooms where id = $1", [roomId]),
);
blocked(
  "cannot grant itself membership",
  await as("authenticated", ids.mallory,
    "insert into public.room_members (room_id, user_id, player_id) values ($1, $2, 'p_m')",
    [roomId, ids.mallory]),
);
denied(
  "cannot read alice's profile (no shared room or couple)",
  await as("authenticated", ids.mallory, "select * from public.profiles where id = $1", [ids.alice]),
);

console.log("\n=== ROOM MEMBER (bob) ===");
allowed(
  "can read the room he joined",
  await as("authenticated", ids.bob, "select state from public.rooms where id = $1", [roomId]),
);
const bobUpdate = await as(
  "authenticated",
  ids.bob,
  "update public.rooms set state = $2 where id = $1",
  [roomId, JSON.stringify({ secret: "alice private answers", bob: "played" })],
);
check("can update the room he joined", bobUpdate.ok && bobUpdate.affected === 1, bobUpdate.error);
allowed(
  "can read alice's profile (shared room)",
  await as("authenticated", ids.bob, "select * from public.profiles where id = $1", [ids.alice]),
);
blocked(
  "cannot delete a room he does not own",
  await as("authenticated", ids.bob, "delete from public.rooms where id = $1", [roomId]),
);

// A second room bob is not in.
const other = await as("authenticated", ids.alice, "select * from public.create_room($1,$2,$3,$4)", [
  "ROOMBB",
  "debate",
  "p_alice",
  JSON.stringify({ secret: "a different room" }),
]);
const otherRoomId = other.rows?.[0]?.id;
denied(
  "cannot read a room he did not join",
  await as("authenticated", ids.bob, "select * from public.rooms where id = $1", [otherRoomId]),
);

console.log("\n=== NON-MEMBER vs gameplay tables ===");
await as("authenticated", ids.alice,
  "insert into public.game_sessions (id, room_id, experience_id, seed) values ('11111111-1111-1111-1111-111111111111', $1, 'know-me', 's')",
  [roomId]);
await as("authenticated", ids.alice,
  "insert into public.game_answers (session_id, question_id, player_id, answer) values ('11111111-1111-1111-1111-111111111111','q1','p_alice','{\"choice\":2}'::jsonb)");
allowed(
  "member reads answers in their room",
  await as("authenticated", ids.bob, "select * from public.game_answers"),
);
denied(
  "non-member reads no answers",
  await as("authenticated", ids.mallory, "select * from public.game_answers"),
);
denied(
  "non-member reads no sessions",
  await as("authenticated", ids.mallory, "select * from public.game_sessions"),
);
blocked(
  "non-member cannot write an answer",
  await as("authenticated", ids.mallory,
    "insert into public.game_answers (session_id, question_id, player_id, answer) values ('11111111-1111-1111-1111-111111111111','q2','p_m','{}'::jsonb)"),
);

console.log("\n=== USER A vs USER B — private keepsakes ===");
await as("authenticated", ids.alice,
  "insert into public.scrapbook_items (owner_id, kind, title) values ($1, 'note', 'alice private note')",
  [ids.alice]);
await as("authenticated", ids.alice,
  "insert into public.letters (owner_id, recipient, sender, body, deliver_on) values ($1,'bob','alice','sealed words', current_date + 30)",
  [ids.alice]);

allowed("alice reads her own scrapbook", await as("authenticated", ids.alice, "select * from public.scrapbook_items"));
denied("bob reads none of alice's scrapbook", await as("authenticated", ids.bob, "select * from public.scrapbook_items"));
denied("mallory reads none of alice's scrapbook", await as("authenticated", ids.mallory, "select * from public.scrapbook_items"));
allowed("alice reads her own letter", await as("authenticated", ids.alice, "select * from public.letters"));
denied("bob cannot read alice's letter", await as("authenticated", ids.bob, "select * from public.letters"));
blocked(
  "bob cannot edit alice's scrapbook",
  await as("authenticated", ids.bob, "update public.scrapbook_items set title = 'defaced'"),
);
blocked(
  "bob cannot delete alice's letters",
  await as("authenticated", ids.bob, "delete from public.letters"),
);
blocked(
  "bob cannot forge a row owned by alice",
  await as("authenticated", ids.bob,
    "insert into public.scrapbook_items (owner_id, kind, title) values ($1,'note','forged')", [ids.alice]),
);

console.log("\n=== COUPLE-SHARED — alice + bob, sealed letters ===");
const couple = await as("authenticated", ids.alice,
  "insert into public.couples (partner_one, partner_two) values ($1,$2) returning id", [ids.alice, ids.bob]);
const coupleId = couple.rows?.[0]?.id;
await as("authenticated", ids.alice, "update public.letters set couple_id = $1", [coupleId]);

denied(
  "partner cannot read a letter before its date",
  await as("authenticated", ids.bob, "select * from public.letters"),
);
await as("authenticated", ids.alice, "update public.letters set deliver_on = current_date - 1");
allowed(
  "partner can read it once the date arrives",
  await as("authenticated", ids.bob, "select * from public.letters"),
);
denied(
  "mallory still cannot read it",
  await as("authenticated", ids.mallory, "select * from public.letters"),
);
denied(
  "mallory cannot read the couple row",
  await as("authenticated", ids.mallory, "select * from public.couples"),
);

console.log("\n=== GIFT RECIPIENT — capability, not enumeration ===");
const gift = await as("authenticated", ids.alice,
  "insert into public.gift_pages (owner_id, title, recipient, sender, message, reveal_on) values ($1,'For you','recipient','alice','happy birthday', current_date + 7) returning id, share_token",
  [ids.alice]);
const token = gift.rows?.[0]?.share_token;
check("a gift gets an unguessable token", typeof token === "string" && token.length >= 32, token);

const secondGift = await as("authenticated", ids.alice,
  "insert into public.gift_pages (owner_id, title, recipient, sender, message, reveal_on) values ($1,'Other','someone','alice','not yours', current_date - 1) returning share_token",
  [ids.alice]);
const otherToken = secondGift.rows?.[0]?.share_token;

denied("recipient cannot list gift pages", await as("authenticated", ids.recipient, "select * from public.gift_pages"));
denied("mallory cannot list gift pages", await as("authenticated", ids.mallory, "select * from public.gift_pages"));
denied("anon cannot list gift pages", await as("anon", null, "select * from public.gift_pages"));

const early = await as("authenticated", ids.recipient, "select * from public.get_gift($1)", [token]);
check("an unrevealed gift stays shut, even with the token", !early.ok, early.ok ? "it opened" : "");

await as("authenticated", ids.alice, "update public.gift_pages set reveal_on = current_date where share_token = $1", [token]);
const opened = await as("authenticated", ids.recipient, "select * from public.get_gift($1)", [token]);
check("the intended gift opens on its date", opened.ok && opened.rows[0].title === "For you", opened.error);

const wrongToken = await as("authenticated", ids.recipient, "select * from public.get_gift($1)", ["deadbeef".repeat(6)]);
check("a made-up token opens nothing", !wrongToken.ok);

const neighbour = await as("authenticated", ids.recipient, "select * from public.get_gift($1)", [otherToken]);
check(
  "holding one token does not expose another gift's contents by listing",
  neighbour.ok && neighbour.rows.length === 1 && neighbour.rows[0].title === "Other",
  "get_gift returns only the gift the token names",
);
blocked(
  "recipient cannot alter the gift",
  await as("authenticated", ids.recipient, "update public.gift_pages set message = 'edited'"),
);

console.log("\n=== STORAGE OBJECTS ===");
await db.exec("reset role;");
await db.query(
  "insert into storage.objects (bucket_id, name, owner) values ('photos', $1, $2)",
  [`${ids.alice}/strip.png`, ids.alice],
);
allowed(
  "alice reads her own object",
  await as("authenticated", ids.alice, "select * from storage.objects"),
);
allowed(
  "her partner reads it",
  await as("authenticated", ids.bob, "select * from storage.objects"),
);
denied("mallory reads no objects", await as("authenticated", ids.mallory, "select * from storage.objects"));
denied("anon reads no objects", await as("anon", null, "select * from storage.objects"));
blocked(
  "mallory cannot upload into alice's folder",
  await as("authenticated", ids.mallory,
    "insert into storage.objects (bucket_id, name) values ('photos', $1)", [`${ids.alice}/evil.png`]),
);
blocked(
  "mallory cannot delete alice's object",
  await as("authenticated", ids.mallory, "delete from storage.objects"),
);
blocked(
  "even her partner cannot delete her object",
  await as("authenticated", ids.bob, "delete from storage.objects"),
);

console.log("\n=== JOIN GATE ===");
const badCode = await as("authenticated", ids.mallory, "select public.join_room($1,$2)", ["NOPE12", "p_m"]);
check("joining a nonexistent room fails", !badCode.ok);
check(
  "the failure does not reveal whether the code exists",
  !badCode.ok && /no such room/.test(badCode.error),
  badCode.error,
);
const injection = await as("authenticated", ids.mallory, "select public.join_room($1,$2)", ["' or '1'='1", "p_m"]);
check("a malformed code is rejected", !injection.ok);
const badPlayer = await as("authenticated", ids.mallory, "select public.join_room($1,$2)", ["ROOMAA", "'; drop table rooms; --"]);
check("a malformed player id is rejected", !badPlayer.ok);

const expired = await as("authenticated", ids.alice, "select * from public.create_room($1,$2,$3,$4)", [
  "OLDAAA", "know-me", "p_alice", "{}",
]);
await db.exec("reset role;");
await db.query("update public.rooms set updated_at = now() - interval '48 hours' where code = 'OLDAAA'");
const stale = await as("authenticated", ids.mallory, "select public.join_room($1,$2)", ["OLDAAA", "p_m"]);
check("an expired room cannot be joined", !stale.ok, expired.error);

console.log("\n=== CONCURRENT WRITES — no lost updates ===");
await db.exec("reset role;");
const v0 = (await db.query("select version, state from public.rooms where id = $1", [roomId])).rows[0];

// Two members read the same version and both try to write from it.
const firstWrite = await as("authenticated", ids.alice,
  "update public.rooms set state = $2, version = version + 1 where id = $1 and version = $3 returning version",
  [roomId, JSON.stringify({ ...v0.state, alice: "answered" }), v0.version]);
const secondWrite = await as("authenticated", ids.bob,
  "update public.rooms set state = $2, version = version + 1 where id = $1 and version = $3 returning version",
  [roomId, JSON.stringify({ ...v0.state, bob: "answered" }), v0.version]);

check("the first writer lands", firstWrite.ok && firstWrite.count === 1, firstWrite.error);
check(
  "the second writer is rejected rather than clobbering it",
  secondWrite.ok && secondWrite.count === 0,
  `affected ${secondWrite.count}`,
);
const afterRace = (await db.query("select state from public.rooms where id = $1", [roomId])).rows[0];
check(
  "the surviving document is the first writer's, not a blend",
  afterRace.state.alice === "answered"
    && afterRace.state.bob === v0.state.bob
    && afterRace.state.secret === v0.state.secret,
  JSON.stringify(afterRace.state),
);
const bumped = (await db.query("select version from public.rooms where id = $1", [roomId])).rows[0];
check("the version moved exactly once", Number(bumped.version) === Number(v0.version) + 1,
  `${v0.version} -> ${bumped.version}`);

// -------------------------------------------------------------- policy sweep --

console.log("\n=== POLICY SWEEP ===");
await db.exec("reset role;");
// An INSERT policy has no `qual` at all — only `with_check` — so it must not be
// counted as an unconditional read. What matters is any policy that can return
// rows (SELECT, UPDATE, DELETE, ALL) whose USING clause is simply true.
const permissive = await db.query(`
  select tablename, policyname, cmd
  from pg_policies
  where schemaname in ('public','storage')
    and cmd in ('SELECT','UPDATE','DELETE','ALL')
    and qual = 'true'
    and tablename <> 'experiences'
`);
check(
  "no table but the catalogue has an unconditional read policy",
  permissive.rows.length === 0,
  permissive.rows.map((r) => `${r.tablename}.${r.policyname} (${r.cmd})`).join(", "),
);

// And nothing may be written unconditionally either.
const openWrites = await db.query(`
  select tablename, policyname, cmd
  from pg_policies
  where schemaname in ('public','storage')
    and with_check = 'true'
    and tablename <> 'experiences'
`);
check(
  "no table accepts an unconditional write",
  openWrites.rows.length === 0,
  openWrites.rows.map((r) => `${r.tablename}.${r.policyname} (${r.cmd})`).join(", "),
);

// Every policy is scoped to a role rather than PUBLIC.
const unscoped = await db.query(`
  select tablename, policyname
  from pg_policies
  where schemaname in ('public','storage') and roles::text = '{public}'
`);
check(
  "every policy names the roles it applies to",
  unscoped.rows.length === 0,
  unscoped.rows.map((r) => `${r.tablename}.${r.policyname}`).join(", "),
);

const unprotected = await db.query(`
  select c.relname
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
`);
check(
  "row level security is on for every public table",
  unprotected.rows.length === 0,
  unprotected.rows.map((r) => r.relname).join(", "),
);

const noPolicy = await db.query(`
  select c.relname
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
    and not exists (select 1 from pg_policies p where p.tablename = c.relname and p.schemaname = 'public')
`);
check(
  "no table is left with RLS on and no policy at all",
  noPolicy.rows.length === 0,
  noPolicy.rows.map((r) => r.relname).join(", "),
);

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFailures:");
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
