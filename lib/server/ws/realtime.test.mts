/**
 * Realtime security and behaviour, end to end.
 *
 *   npm run test:realtime
 *
 * Nothing here is mocked. A real Postgres (PGlite behind a real wire-protocol
 * socket) runs the real migrations; the real `pg` driver runs the real data
 * layer; a real Node HTTP server carries the real WebSocket server; and real
 * `ws` clients connect to it with real signed cookies.
 *
 * That matters because the claims being tested are negative ones — a non-member
 * receives *nothing* — and a negative claim is easy to satisfy accidentally with
 * a mock that was never wired up in the first place.
 */
process.env.SESSION_SECRET = "t".repeat(64);

import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import WebSocket from "ws";
import { migrate } from "../../../db/migrate.mjs";

// --- a real Postgres on a real socket --------------------------------------

const db = await PGlite.create({ extensions: { pgcrypto } });
const PG_PORT = 55_432 + Math.floor(Math.random() * 200);
const pgServer = new PGLiteSocketServer({ db, port: PG_PORT, host: "127.0.0.1" });
await pgServer.start();

process.env.DATABASE_URL = `postgres://postgres:postgres@127.0.0.1:${PG_PORT}/postgres`;
// PGlite's wire server serves one connection at a time, so the pool is pinned to
// one here. Concurrency is still exercised — the compare-and-set tests interleave
// two clients' writes — it is just serialised at the socket rather than the pool.
process.env.PGPOOL_MAX = "1";

await migrate(process.env.DATABASE_URL, { quiet: true });

// Imported only after DATABASE_URL exists, because the pool reads it on first use.
const { attachRealtime, shutdownRealtime, realtimeStats } = await import("./server");
const { createRoom, joinRoom, readRoom } = await import("../db/rooms");
const { createSession } = await import("../db/sessions");
const { mintToken, SESSION_COOKIE } = await import("../session-token");
const { query } = await import("../db/pool");

// --- the server under test --------------------------------------------------

const http: Server = createServer((_req, res) => res.end("ok"));
attachRealtime(http, "/ws");
await new Promise<void>((r) => http.listen(0, "127.0.0.1", () => r()));
const WS_PORT = (http.address() as AddressInfo).port;
const WS_URL = `ws://127.0.0.1:${WS_PORT}/ws`;

// --- rig --------------------------------------------------------------------

let pass = 0;
const failures: string[] = [];

function check(label: string, condition: boolean, detail = "") {
  if (condition) {
    pass++;
    console.log(`  ok    ${label}`);
  } else {
    failures.push(`${label}${detail ? ` — ${detail}` : ""}`);
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

interface Client {
  ws: WebSocket;
  inbox: Record<string, unknown>[];
  /** Waits for a matching message, or resolves null on timeout. */
  await(pred: (m: Record<string, unknown>) => boolean, ms?: number): Promise<Record<string, unknown> | null>;
  /**
   * Waits for a matching message that arrives *after this call*.
   *
   * The difference matters more than it looks: `await` is satisfied by anything
   * already in the inbox, so a second "was that rejected?" assertion in a row
   * passes on the *first* rejection and never actually waits for the second.
   * Several assertions here were quietly doing that.
   */
  next(pred: (m: Record<string, unknown>) => boolean, ms?: number): Promise<Record<string, unknown> | null>;
  /** Everything received so far of a given type. */
  all(t: string): Record<string, unknown>[];
  /** The most recent message of a type. */
  last(t: string): Record<string, unknown> | undefined;
  send(m: unknown): void;
  close(): void;
}

async function connect(token: string | null, { expectFail = false } = {}): Promise<Client | null> {
  const ws = new WebSocket(WS_URL, {
    headers: token ? { Cookie: `${SESSION_COOKIE}=${token}` } : {},
  });
  const inbox: Record<string, unknown>[] = [];
  ws.on("message", (d) => {
    try {
      inbox.push(JSON.parse(d.toString()));
    } catch {
      /* ignore non-JSON, of which the server sends none */
    }
  });

  const opened = await new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), 4000);
    ws.once("open", () => {
      clearTimeout(timer);
      resolve(true);
    });
    ws.once("error", () => {
      clearTimeout(timer);
      resolve(false);
    });
    ws.once("unexpected-response", () => {
      clearTimeout(timer);
      resolve(false);
    });
  });

  if (!opened) {
    if (!expectFail) console.log("      (connection refused)");
    return null;
  }

  const client: Client = {
    ws,
    inbox,
    async await(pred, ms = 2500) {
      const deadline = Date.now() + ms;
      for (;;) {
        const hit = inbox.find(pred);
        if (hit) return hit;
        if (Date.now() > deadline) return null;
        await new Promise((r) => setTimeout(r, 25));
      }
    },
    async next(pred, ms = 2500) {
      const from = inbox.length;
      const deadline = Date.now() + ms;
      for (;;) {
        const hit = inbox.slice(from).find(pred);
        if (hit) return hit;
        if (Date.now() > deadline) return null;
        await new Promise((r) => setTimeout(r, 25));
      }
    },
    all: (t) => inbox.filter((m) => m.t === t),
    last: (t) => [...inbox].reverse().find((m) => m.t === t),
    send: (m) => ws.send(JSON.stringify(m)),
    close: () => ws.close(),
  };

  await client.await((m) => m.t === "hello");
  return client;
}

async function newVisitor() {
  const row = await createSession();
  return { id: row.id, token: await mintToken(row.id) };
}

const randomCode = () =>
  Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");

const baseState = (hostId: string) => ({
  code: "",
  experienceId: "know-me",
  status: "lobby" as const,
  hostId,
  hostSince: Date.now(),
  seed: "s_test",
  createdAt: Date.now(),
  startedAt: null,
  players: {},
  data: {},
});

// --- 1. connection authentication ------------------------------------------

console.log("\n=== Connection authentication ===");

check("a connection with no cookie is refused", (await connect(null, { expectFail: true })) === null);
check(
  "a connection with a garbage cookie is refused",
  (await connect("not-a-token", { expectFail: true })) === null,
);

const forged = await (async () => {
  const { SignJWT } = await import("jose");
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("99999999-9999-9999-9999-999999999999")
    .setIssuer("together")
    .setAudience("together:guest")
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(new TextEncoder().encode("wrong-secret".padEnd(64, "x")));
})();
check(
  "a token signed with another key is refused",
  (await connect(forged, { expectFail: true })) === null,
);

// A correctly signed token whose session row does not exist.
const orphanToken = await mintToken("88888888-8888-8888-8888-888888888888");
check(
  "a validly signed token for a deleted session is refused",
  (await connect(orphanToken, { expectFail: true })) === null,
  "signature alone is not enough — the session must still be live",
);

const alice = await newVisitor();
const bob = await newVisitor();
const mallory = await newVisitor();

const a = (await connect(alice.token))!;
check("a valid session connects", Boolean(a));
check("and is told who it is", (await a.await((m) => m.t === "hello"))?.sessionId === alice.id);

// --- 2. room subscription authorization ------------------------------------

console.log("\n=== Room subscription authorization ===");

const code = randomCode();
const room = await createRoom({ sessionId: alice.id }, {
  code,
  experienceId: "know-me",
  playerId: "p_alice",
  state: { ...baseState("p_alice"), code } as never,
});
await joinRoom({ sessionId: bob.id }, { code, playerId: "p_bob" });

const m = (await connect(mallory.token))!;
m.send({ t: "subscribe", code, playerId: "p_mallory" });
const denial = await m.await((x) => x.t === "denied");
check("a non-member's subscribe is denied", denial !== null, JSON.stringify(denial));
check(
  "and they receive no room state at all",
  m.all("state").length === 0,
  `received ${m.all("state").length} state message(s)`,
);

// Naming a seat that exists but belongs to someone else.
m.send({ t: "subscribe", code, playerId: "p_alice" });
await m.await((x) => x.t === "denied", 1500);
check(
  "a non-member cannot subscribe by naming another player's seat",
  m.all("state").length === 0,
);

// A member of *this* room trying a different room they are not in.
const otherCode = randomCode();
await createRoom({ sessionId: mallory.id }, {
  code: otherCode,
  experienceId: "debate",
  playerId: "p_m2",
  state: { ...baseState("p_m2"), code: otherCode } as never,
});
a.send({ t: "subscribe", code: otherCode, playerId: "p_alice" });
await a.await((x) => x.t === "denied", 1500);
check(
  "a member of one room cannot subscribe to another",
  a.all("state").filter((s) => s.code === otherCode).length === 0,
);

a.send({ t: "subscribe", code, playerId: "p_alice" });
const firstState = await a.await((x) => x.t === "state");
check("a member's subscribe returns the room", firstState !== null);
check("with the version", typeof firstState?.version === "number");

// Seat ownership: alice is a member, but p_bob is not her seat.
a.send({ t: "subscribe", code, playerId: "p_bob" });
const seatDenial = await a.await((x) => x.t === "denied" && /seat/i.test(String(x.reason)), 2000);
check("a member cannot claim another member's seat", seatDenial !== null);

const b = (await connect(bob.token))!;
b.send({ t: "subscribe", code, playerId: "p_bob" });
check("the second member subscribes", (await b.await((x) => x.t === "state")) !== null);

// --- 3. events --------------------------------------------------------------

console.log("\n=== Events ===");

const beforeEvents = m.all("event").length;
b.send({ t: "event", code, playerId: "p_bob", eventType: "draw:stroke", payload: { n: 1 } });
const receivedByA = await a.await((x) => x.t === "event" && x.eventType === "draw:stroke");
check("a member's event reaches the other member", receivedByA !== null);
check("the sender is stamped by the server", receivedByA?.from === "p_bob");
check("and carries a server-generated id", typeof receivedByA?.id === "string");
check(
  "the sender does not receive their own event back",
  b.all("event").filter((e) => e.eventType === "draw:stroke").length === 0,
);
await new Promise((r) => setTimeout(r, 300));
check(
  "a non-member receives no events",
  m.all("event").length === beforeEvents,
  `received ${m.all("event").length - beforeEvents}`,
);

// Publishing without a subscription.
const m2 = (await connect(mallory.token))!;
m2.send({ t: "event", code, playerId: "p_mallory", eventType: "draw:clear", payload: {} });
await m2.await((x) => x.t === "denied", 1500);
const aStrokes = a.all("event").length;
await new Promise((r) => setTimeout(r, 300));
check("a non-member cannot publish into a room", a.all("event").length === aStrokes);

// Spoofing another player's identity while genuinely subscribed.
b.send({ t: "event", code, playerId: "p_alice", eventType: "draw:clear", payload: {} });
await b.await((x) => x.t === "denied", 1500);
check(
  "a member cannot publish as another player",
  a.all("event").filter((e) => e.eventType === "draw:clear").length === 0,
);

// --- 4. malformed and oversized ---------------------------------------------

console.log("\n=== Malformed and oversized messages ===");

// Each probe gets its own session and seat. Sharing `p_alice` would have them
// supersede one another — and kick `a` off its seat — because the server allows
// exactly one socket per seat, which is the behaviour tested further down.
const probeVisitor = await newVisitor();
await joinRoom({ sessionId: probeVisitor.id }, { code, playerId: "p_probe" });

const probe = (await connect(probeVisitor.token))!;
probe.send({ t: "subscribe", code, playerId: "p_probe" });
await probe.await((x) => x.t === "state");

probe.ws.send("not json at all");
check("a non-JSON frame is rejected", (await probe.await((x) => x.t === "error")) !== null);

const probe2Visitor = await newVisitor();
await joinRoom({ sessionId: probe2Visitor.id }, { code, playerId: "p_probe2" });
const probe2 = (await connect(probe2Visitor.token))!;
for (const [label, frame] of [
  ["an array body", JSON.stringify([1, 2, 3])],
  ["a missing type", JSON.stringify({ code })],
  ["an unknown type", JSON.stringify({ t: "drop-tables" })],
  ["a malformed room code", JSON.stringify({ t: "subscribe", code: "'; drop --", playerId: "p_a" })],
  ["a malformed player id", JSON.stringify({ t: "subscribe", code, playerId: "../../etc" })],
  ["a negative version", JSON.stringify({ t: "patch", code, playerId: "p_probe2", version: -1, state: {} })],
  ["a non-integer version", JSON.stringify({ t: "patch", code, playerId: "p_probe2", version: 1.5, state: {} })],
  ["a non-object state", JSON.stringify({ t: "patch", code, playerId: "p_probe2", version: 0, state: "x" })],
  ["a malformed event type", JSON.stringify({ t: "event", code, playerId: "p_probe2", eventType: "A B C", payload: {} })],
] as const) {
  const settled = probe2.next((x) => x.t === "error", 1500);
  probe2.ws.send(frame);
  check(`${label} is rejected`, (await settled) !== null);
}

// A 400 KB photo — exactly what must not travel this way. `ws` enforces the
// payload cap at the frame level, so it never reaches application code at all
// and the connection is closed. Better than an application-level error.
const probe3Visitor = await newVisitor();
await joinRoom({ sessionId: probe3Visitor.id }, { code, playerId: "p_probe3" });
const probe3 = (await connect(probe3Visitor.token))!;
probe3.send({ t: "subscribe", code, playerId: "p_probe3" });
await probe3.await((x) => x.t === "state");

const oversizeClosed = new Promise<number>((resolve) => {
  probe3.ws.once("close", (c) => resolve(c));
  setTimeout(() => resolve(-1), 3000);
});
const bigPhoto = "data:image/jpeg;base64," + "A".repeat(400 * 1024);
probe3.ws.send(JSON.stringify({ t: "event", code, playerId: "p_probe3", eventType: "booth:shot", payload: { dataUrl: bigPhoto } }));
const oversizeCode = await oversizeClosed;
check(
  "a 400 KB photo over the socket is refused at the frame level",
  oversizeCode === 1009,
  `close code ${oversizeCode}`,
);

// The same photo just under the frame cap still has to be rejected, this time by
// the payload inspector — otherwise the media rule would only hold by accident.
const probe4Visitor = await newVisitor();
await joinRoom({ sessionId: probe4Visitor.id }, { code, playerId: "p_probe4" });
const probe4 = (await connect(probe4Visitor.token))!;
probe4.send({ t: "subscribe", code, playerId: "p_probe4" });
await probe4.await((x) => x.t === "state");

const mediumPhoto = "data:image/jpeg;base64," + "A".repeat(100 * 1024);
const inlinePending = probe4.next((x) => x.t === "error" && /object storage/i.test(String(x.reason)), 2500);
probe4.send({ t: "event", code, playerId: "p_probe4", eventType: "hunt:photo", payload: { dataUrl: mediumPhoto } });
check("a 100 KB inline photo is rejected with an explanation", (await inlinePending) !== null);

// A small preview frame is legitimate and must still work.
const smallFrame = "data:image/jpeg;base64," + "A".repeat(7 * 1024);
probe4.send({ t: "event", code, playerId: "p_probe4", eventType: "booth:frame", payload: { frame: smallFrame } });
const frameSeen = await b.await((x) => x.t === "event" && x.eventType === "booth:frame", 2500);
check("a 7 KB live preview frame still passes", frameSeen !== null);

// Deeply nested payload.
let nested: unknown = { end: true };
for (let i = 0; i < 30; i++) nested = { nested };
const nestedRejected = probe4.next((x) => x.t === "error", 1500);
probe4.send({ t: "event", code, playerId: "p_probe4", eventType: "x:deep", payload: nested });
check("a deeply nested payload is rejected", (await nestedRejected) !== null);

// --- 5. compare-and-set -----------------------------------------------------

console.log("\n=== Concurrent writes ===");

const current = await readRoom({ sessionId: alice.id }, code);
const v = current.version;

a.send({ t: "patch", code, playerId: "p_alice", version: v, state: { ...current.state, alice: "first" } });
const okState = await a.await((x) => x.t === "state" && (x.state as Record<string, unknown>)?.alice === "first");
check("the first writer lands", okState !== null);

// Bob writes from the version he read before Alice's patch.
b.send({ t: "patch", code, playerId: "p_bob", version: v, state: { ...current.state, bob: "second" } });
const conflict = await b.await((x) => x.t === "conflict");
check("the second writer is told it conflicted", conflict !== null);
check(
  "and is handed the current document to retry from",
  (conflict?.state as Record<string, unknown>)?.alice === "first",
);

const after = await readRoom({ sessionId: alice.id }, code);
check("the stored document is the first writer's, not a blend", (after.state as Record<string, unknown>).alice === "first" && (after.state as Record<string, unknown>).bob === undefined);
check("the version moved exactly once", after.version === v + 1);

// A member patching a room they are in, but as a seat they do not hold.
const hijackDenied = b.next((x) => x.t === "denied", 2000);
b.send({ t: "patch", code, playerId: "p_alice", version: after.version, state: { hijack: true } });
check("a member cannot patch as another player", (await hijackDenied) !== null);

// --- 6. presence does not rewrite the document ------------------------------

console.log("\n=== Presence ===");

const versionBeforeBeats = (await readRoom({ sessionId: alice.id }, code)).version;
for (let i = 0; i < 5; i++) {
  a.send({ t: "presence", code, playerId: "p_alice" });
  await new Promise((r) => setTimeout(r, 60));
}
const versionAfterBeats = (await readRoom({ sessionId: alice.id }, code)).version;
check(
  "five heartbeats do not touch the room document",
  versionAfterBeats === versionBeforeBeats,
  `${versionBeforeBeats} -> ${versionAfterBeats}`,
);

const presenceRows = await query<{ n: string }>(
  `select count(*) as n from room_players where room_id = $1`,
  [room.id],
);
check("presence is recorded in room_players instead", Number(presenceRows.rows[0].n) >= 2);

const stateWithRoster = a.last("state");
check(
  "the roster still arrives inside RoomState.players, so experiences are unchanged",
  Object.keys(((stateWithRoster?.state as Record<string, unknown>)?.players ?? {}) as object).length >= 2,
  `saw ${Object.keys(((stateWithRoster?.state as Record<string, unknown>)?.players ?? {}) as object).length} player(s)`,
);

// --- 7. reconnect and late join ---------------------------------------------

console.log("\n=== Reconnect and late join ===");

b.close();
await new Promise((r) => setTimeout(r, 250));

const bAgain = (await connect(bob.token))!;
bAgain.send({ t: "subscribe", code, playerId: "p_bob" });
const resumed = await bAgain.await((x) => x.t === "state");
check("a reconnecting member gets the current document", resumed !== null);
check(
  "including the state written while they were away",
  (resumed?.state as Record<string, unknown>)?.alice === "first",
);

// A brand new connection joining a room mid-game.
await joinRoom({ sessionId: mallory.id }, { code, playerId: "p_late" });
const late = (await connect(mallory.token))!;
late.send({ t: "subscribe", code, playerId: "p_late" });
const lateState = await late.await((x) => x.t === "state");
check("a late joiner receives the full current state", (lateState?.state as Record<string, unknown>)?.alice === "first");

// Duplicate connection for the same seat.
const dup = (await connect(bob.token))!;
dup.send({ t: "subscribe", code, playerId: "p_bob" });
await dup.await((x) => x.t === "state");
const supersededMsg = await bAgain.await((x) => x.t === "denied" && /taken over/i.test(String(x.reason)), 2000);
check("a duplicate connection for one seat supersedes the older one", supersededMsg !== null);

// --- 8. host migration ------------------------------------------------------

console.log("\n=== Host migration ===");

// Make alice look long gone, and make sure the cooldown has elapsed.
await query(`update room_players set last_seen = now() - interval '90 seconds' where room_id = $1 and player_id = $2`, [room.id, "p_alice"]);
await query(`update rooms set state = jsonb_set(state, '{hostSince}', to_jsonb(0)) where id = $1`, [room.id]);
dup.send({ t: "presence", code, playerId: "p_bob" });
await new Promise((r) => setTimeout(r, 200));

const beforeMigration = await readRoom({ sessionId: bob.id }, code);
dup.send({
  t: "patch",
  code,
  playerId: "p_bob",
  version: beforeMigration.version,
  state: { ...beforeMigration.state, hostId: "p_bob", hostSince: Date.now() },
});
await dup.await((x) => x.t === "state" && (x.state as Record<string, unknown>)?.hostId === "p_bob", 2500);
const migrated = await query<{ host_id: string }>(`select host_id from rooms where id = $1`, [room.id]);
check("a legitimate claim moves the host seat", migrated.rows[0].host_id === "p_bob");

// Now the illegitimate ones. Alice is back and healthy.
await query(`update room_players set last_seen = now() where room_id = $1 and player_id = $2`, [room.id, "p_alice"]);
await query(`update rooms set state = jsonb_set(state, '{hostSince}', to_jsonb(0)) where id = $1`, [room.id]);

const healthy = await readRoom({ sessionId: mallory.id }, code);
const aliveClaimDenied = late.next((x) => x.t === "denied", 2500);
late.send({
  t: "patch",
  code,
  playerId: "p_late",
  version: healthy.version,
  state: { ...healthy.state, hostId: "p_late" },
});
check("a claim while the host is alive is refused", (await aliveClaimDenied) !== null);
const stillBob = await query<{ host_id: string }>(`select host_id from rooms where id = $1`, [room.id]);
check("and the host seat did not move", stillBob.rows[0].host_id === "p_bob");

// Claiming the seat *for someone else*.
await query(`update room_players set last_seen = now() - interval '90 seconds' where room_id = $1`, [room.id]);
await query(`update room_players set last_seen = now() where room_id = $1 and player_id = $2`, [room.id, "p_late"]);
const forOther = await readRoom({ sessionId: mallory.id }, code);
const forOtherDenied = late.next((x) => x.t === "denied", 2500);
late.send({
  t: "patch",
  code,
  playerId: "p_late",
  version: forOther.version,
  state: { ...forOther.state, hostId: "p_alice" },
});
check("a player cannot hand the host seat to someone else", (await forOtherDenied) !== null);

// --- 9. rate limiting -------------------------------------------------------

console.log("\n=== Rate limiting ===");

const flood = (await connect(alice.token))!;
const closed = new Promise<number>((resolve) => flood.ws.once("close", (c) => resolve(c)));
for (let i = 0; i < 300; i++) flood.ws.send(JSON.stringify({ t: "ping" }));
const closeCode = await Promise.race([
  closed,
  new Promise<number>((r) => setTimeout(() => r(-1), 4000)),
]);
check("a flood of messages closes the connection", closeCode === 1008, `close code ${closeCode}`);

// --- 10. graceful shutdown --------------------------------------------------

console.log("\n=== Graceful shutdown ===");

const survivor = (await connect(alice.token))!;
survivor.send({ t: "subscribe", code, playerId: "p_alice" });
await survivor.await((x) => x.t === "state");
check("connections are tracked", realtimeStats().connections > 0);

const shutdownSeen = survivor.await((x) => x.t === "closing", 3000);
await shutdownRealtime("test shutdown");
check("clients are told before the socket closes", (await shutdownSeen) !== null);
check("and the server lets go of its state", realtimeStats().rooms === 0);

// --- teardown ---------------------------------------------------------------

for (const c of [a, m, m2, probe, probe2, probe3, probe4, bAgain, late, dup, flood, survivor]) {
  try {
    c.close();
  } catch {
    /* already gone */
  }
}
await new Promise<void>((r) => http.close(() => r()));
await pgServer.stop();
await db.close();

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFailures:");
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
process.exit(0);
