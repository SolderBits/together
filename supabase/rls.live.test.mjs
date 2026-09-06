/**
 * The same RLS matrix, against your actual Supabase project.
 *
 *   node supabase/rls.live.test.mjs
 *
 * `rls.test.mjs` proves the policies are correct *as written*, by running
 * schema.sql in an in-process Postgres. This proves they are correct *as
 * deployed* — that the SQL actually ran, that anonymous sign-in is on, that
 * PostgREST is enforcing what the policy file says, and that the grants and
 * function privileges survived the trip. Those are different claims, and only
 * this one can be made after the setup step.
 *
 * It uses nothing but the anon key: exactly what a browser has, and exactly
 * what an attacker would have. Everything it creates is cleaned up at the end.
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY from
 * .env.local, or from the environment.
 */
import { createClient } from "@supabase/supabase-js";
// Node 20 has no global WebSocket, and supabase-js builds a realtime client
// eagerly — without this, creating a client throws before any test can run.
import ws from "ws";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// --- config ----------------------------------------------------------------

function loadEnv() {
  const file = join(root, ".env.local");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error(
    "No Supabase credentials found.\n\n" +
      "Put NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local\n" +
      "(Project Settings → API), then run this again.",
  );
  process.exit(1);
}

if (/SERVICE_ROLE/i.test(anonKey) || anonKey.includes("service_role")) {
  console.error("That looks like a service-role key. Use the anon key — the point is to test what a browser can do.");
  process.exit(1);
}

// --- rig -------------------------------------------------------------------

let pass = 0;
const failures = [];
const cleanup = [];

function check(label, condition, detail = "") {
  if (condition) {
    pass++;
    console.log(`  ok    ${label}`);
  } else {
    failures.push(`${label}${detail ? ` — ${detail}` : ""}`);
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

/** A read that must come back empty (RLS filters rather than errors on select). */
function denied(label, { data, error }) {
  const rows = Array.isArray(data) ? data.length : data ? 1 : 0;
  check(label, Boolean(error) || rows === 0, error ? "" : `returned ${rows} row(s)`);
}

/** A write that must be refused. */
function blocked(label, { data, error }) {
  const rows = Array.isArray(data) ? data.length : data ? 1 : 0;
  check(label, Boolean(error) || rows === 0, error ? "" : `wrote ${rows} row(s)`);
}

function allowed(label, { data, error }, minRows = 1) {
  const rows = Array.isArray(data) ? data.length : data ? 1 : 0;
  check(label, !error && rows >= minRows, error ? error.message : `got ${rows}`);
}

/** A fresh anonymous browser. */
async function newVisitor(name) {
  let client;
  try {
    client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { transport: ws },
    });
  } catch (error) {
    console.error(
      `\nCould not build a Supabase client: ${error.message}\n\n` +
        "Check that NEXT_PUBLIC_SUPABASE_URL is the full https://<ref>.supabase.co URL\n" +
        "and that NEXT_PUBLIC_SUPABASE_ANON_KEY was copied whole (Project Settings → API).",
    );
    process.exit(1);
  }
  const { data, error } = await client.auth.signInAnonymously();
  if (error) {
    const unreachable = /fetch failed|ENOTFOUND|ECONNREFUSED|network/i.test(error.message);
    console.error(
      `\nCould not create an anonymous session for ${name}: ${error.message}\n\n` +
        (unreachable
          ? `The project did not answer. Check NEXT_PUBLIC_SUPABASE_URL is right\n(${url}) and that the project is not paused.`
          : "Anonymous sign-in is what gives guests an auth.uid() for the policies to\n" +
            "check. Turn it on: Authentication → Providers → Anonymous sign-ins.\n" +
            "Without it every room query fails and none of this can be tested."),
    );
    process.exit(1);
  }
  return { client, id: data.user.id, name };
}

const randomCode = () =>
  Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");

// --- run -------------------------------------------------------------------

console.log(`\nTesting ${url}\n`);

console.log("=== Prerequisites ===");
const alice = await newVisitor("alice");
check("anonymous sign-in is enabled", Boolean(alice.id), "");
const bob = await newVisitor("bob");
const mallory = await newVisitor("mallory");
check("three independent visitors get three different ids",
  new Set([alice.id, bob.id, mallory.id]).size === 3);

const schemaCheck = await alice.client.rpc("create_room", {
  p_code: randomCode(), p_experience_id: "know-me", p_player_id: "p_probe", p_state: {},
});
if (schemaCheck.error && /does not exist|schema cache/i.test(schemaCheck.error.message)) {
  console.error(
    `\nThe schema has not been applied: ${schemaCheck.error.message}\n\n` +
      "Open the SQL editor and run supabase/schema.sql, then try again.",
  );
  process.exit(1);
}
check("schema.sql has been applied (create_room exists)", !schemaCheck.error,
  schemaCheck.error?.message);
if (schemaCheck.data?.id) cleanup.push(schemaCheck.data.id);

console.log("\n=== Setup: alice hosts, bob joins, mallory does not ===");
const code = randomCode();
const created = await alice.client.rpc("create_room", {
  p_code: code,
  p_experience_id: "know-me",
  p_player_id: "p_alice",
  p_state: { secret: "alice private answers", players: {} },
});
check("alice can create a room", !created.error, created.error?.message);
const roomId = created.data?.id;
if (roomId) cleanup.push(roomId);

const joined = await bob.client.rpc("join_room", { p_code: code, p_player_id: "p_bob" });
check("bob can join with the code", !joined.error, joined.error?.message);

console.log("\n=== ANONYMOUS-BUT-UNJOINED (what an attacker holds) ===");
denied("cannot enumerate rooms", await mallory.client.from("rooms").select("*"));
denied("cannot read room state", await mallory.client.from("rooms").select("state"));
denied("cannot read a room by its code",
  await mallory.client.from("rooms").select("*").eq("code", code));
denied("cannot read a room by its uuid",
  await mallory.client.from("rooms").select("*").eq("id", roomId ?? "00000000-0000-0000-0000-000000000000"));
denied("cannot read membership", await mallory.client.from("room_members").select("*"));
denied("cannot read presence", await mallory.client.from("room_players").select("*"));
denied("cannot read answers", await mallory.client.from("game_answers").select("*"));
denied("cannot read sessions", await mallory.client.from("game_sessions").select("*"));
denied("cannot read drawings", await mallory.client.from("drawings").select("*"));
denied("cannot read letters", await mallory.client.from("letters").select("*"));
denied("cannot read gift pages", await mallory.client.from("gift_pages").select("*"));
denied("cannot read scrapbook items", await mallory.client.from("scrapbook_items").select("*"));
denied("cannot read photos", await mallory.client.from("photos").select("*"));
denied("cannot read couples", await mallory.client.from("couples").select("*"));

blocked("cannot overwrite room state",
  await mallory.client.from("rooms").update({ state: { pwned: true } }).eq("code", code).select());
blocked("cannot insert a room directly",
  await mallory.client.from("rooms")
    .insert({ code: randomCode(), experience_id: "x", host_id: "p_x", state: {} }).select());
blocked("cannot grant itself membership",
  await mallory.client.from("room_members")
    .insert({ room_id: roomId, user_id: mallory.id, player_id: "p_m" }).select());
blocked("cannot delete the room",
  await mallory.client.from("rooms").delete().eq("code", code).select());

console.log("\n=== ROOM MEMBER ===");
allowed("bob reads the room he joined",
  await bob.client.from("rooms").select("state").eq("code", code));
const bobWrite = await bob.client.from("rooms")
  .update({ state: { secret: "alice private answers", bob: "played" } })
  .eq("code", code).select("version");
check("bob updates the room he joined", !bobWrite.error && bobWrite.data?.length === 1,
  bobWrite.error?.message);

const otherCode = randomCode();
const otherRoom = await alice.client.rpc("create_room", {
  p_code: otherCode, p_experience_id: "debate", p_player_id: "p_alice", p_state: { secret: "elsewhere" },
});
if (otherRoom.data?.id) cleanup.push(otherRoom.data.id);
denied("bob cannot read a room he did not join",
  await bob.client.from("rooms").select("*").eq("code", otherCode));

console.log("\n=== JOIN GATE ===");
const noSuch = await mallory.client.rpc("join_room", { p_code: randomCode(), p_player_id: "p_m" });
check("joining a nonexistent room fails", Boolean(noSuch.error));
check("the error does not reveal whether the code exists",
  Boolean(noSuch.error) && /no such room/i.test(noSuch.error.message), noSuch.error?.message);
const injection = await mallory.client.rpc("join_room", { p_code: "' or '1'='1", p_player_id: "p_m" });
check("a malformed code is rejected", Boolean(injection.error));
const badPlayer = await mallory.client.rpc("join_room", {
  p_code: code, p_player_id: "'; drop table rooms; --",
});
check("a malformed player id is rejected", Boolean(badPlayer.error));

console.log("\n=== CONCURRENCY ===");
const before = await alice.client.from("rooms").select("version, state").eq("code", code).single();
const v = before.data?.version;
const w1 = await alice.client.from("rooms")
  .update({ state: { ...before.data.state, alice: "answered" }, version: v + 1 })
  .eq("code", code).eq("version", v).select("version");
const w2 = await bob.client.from("rooms")
  .update({ state: { ...before.data.state, bob: "answered" }, version: v + 1 })
  .eq("code", code).eq("version", v).select("version");
check("the first writer lands", !w1.error && w1.data?.length === 1, w1.error?.message);
check("the second writer is rejected rather than clobbering",
  !w2.error && w2.data?.length === 0, `wrote ${w2.data?.length}`);

console.log("\n=== GIFTS ===");
const gift = await alice.client.from("gift_pages").insert({
  owner_id: alice.id, title: "For you", recipient: "sam", sender: "alice",
  message: "not yet", reveal_on: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
}).select("id, share_token").single();
check("alice can create a gift", !gift.error, gift.error?.message);
const token = gift.data?.share_token;
check("the gift gets an unguessable token", typeof token === "string" && token.length >= 32);

denied("mallory cannot list gift pages", await mallory.client.from("gift_pages").select("*"));
const early = await mallory.client.rpc("get_gift", { p_token: token });
check("an unrevealed gift stays shut even with the token", Boolean(early.error));

await alice.client.from("gift_pages")
  .update({ reveal_on: new Date().toISOString().slice(0, 10) }).eq("id", gift.data?.id);
const opened = await mallory.client.rpc("get_gift", { p_token: token });
check("the gift opens on its date", !opened.error && opened.data?.title === "For you",
  opened.error?.message);
const madeUp = await mallory.client.rpc("get_gift", { p_token: "0".repeat(48) });
check("a made-up token opens nothing", Boolean(madeUp.error));

console.log("\n=== PRIVATE KEEPSAKES ===");
const note = await alice.client.from("scrapbook_items")
  .insert({ owner_id: alice.id, kind: "note", title: "alice private note" }).select("id").single();
check("alice can write her own scrapbook", !note.error, note.error?.message);
allowed("alice reads it back", await alice.client.from("scrapbook_items").select("*"));
denied("bob reads none of it", await bob.client.from("scrapbook_items").select("*"));
blocked("bob cannot forge a row owned by alice",
  await bob.client.from("scrapbook_items")
    .insert({ owner_id: alice.id, kind: "note", title: "forged" }).select());

console.log("\n=== REALTIME ===");
// The transport subscribes to postgres_changes on rooms; realtime honours RLS,
// so a non-member must not receive another room's changes.
const realtimeReached = await new Promise((resolve) => {
  const channel = mallory.client.channel(`probe:${code}`).on(
    "postgres_changes",
    { event: "*", schema: "public", table: "rooms", filter: `code=eq.${code}` },
    () => resolve(true),
  );
  channel.subscribe();
  setTimeout(async () => {
    await alice.client.from("rooms").update({ state: { ping: Date.now() } }).eq("code", code);
    setTimeout(() => { mallory.client.removeChannel(channel); resolve(false); }, 4000);
  }, 1500);
});
check("a non-member receives no realtime changes for a room they are not in", !realtimeReached);

// --- cleanup ---------------------------------------------------------------

console.log("\n=== Cleanup ===");
if (note.data?.id) await alice.client.from("scrapbook_items").delete().eq("id", note.data.id);
if (gift.data?.id) await alice.client.from("gift_pages").delete().eq("id", gift.data.id);
for (const id of cleanup) await alice.client.from("rooms").delete().eq("id", id);
const leftovers = await alice.client.from("rooms").select("id").in("id", cleanup);
check("test rooms removed", !leftovers.error && (leftovers.data?.length ?? 0) === 0,
  `${leftovers.data?.length} left`);

await Promise.all([alice, bob, mallory].map((v) => v.client.auth.signOut()));

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFailures:");
  failures.forEach((f) => console.log(`  - ${f}`));
  console.log(
    "\nDo not deploy with these failing. Re-run supabase/schema.sql — it is written to be\n" +
      "safe to run again — and check that anonymous sign-in is enabled.",
  );
  process.exit(1);
}
console.log("\nThe deployed policies match the tested ones. Safe to move on.\n");
