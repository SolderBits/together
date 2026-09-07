/**
 * Attacks, and the proof they fail.
 *
 *   npm run test:security
 *
 * Every case here tries to do something it should not be able to do. That
 * matters more than it sounds: the rest of the suite proves the product works,
 * and a system can work perfectly while being wide open. Nothing below asserts
 * that a defence *exists* — each one performs the attack and asserts on what
 * came back.
 *
 * Route handlers are called directly with real `Request` objects. They read the
 * session from the request rather than from Next's context, so this is the same
 * code a deployment runs, with nothing stubbed between the attack and the check.
 */
process.env.SESSION_SECRET = "x".repeat(64);
process.env.NODE_ENV = "test";

import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { startPgSocket } from "./testing/pg-socket.mts";
import { SignJWT } from "jose";
import WebSocket from "ws";
import { migrate } from "../../db/migrate.mjs";

const storageDir = await mkdtemp(join(tmpdir(), "together-sec-"));
process.env.LOCAL_STORAGE_DIR = storageDir;

const db = await PGlite.create({ extensions: { pgcrypto } });
const pgSocket = await startPgSocket(db);
process.env.DATABASE_URL = pgSocket.url;
process.env.PGPOOL_MAX = "1";
await migrate(process.env.DATABASE_URL, { quiet: true });

const { attachRealtime, shutdownRealtime, realtimeStats } = await import("./ws/server");
const { createRoom, joinRoom, readRoom } = await import("./db/rooms");
const { createSession, deleteSession } = await import("./db/sessions");
const { mintToken, SESSION_COOKIE } = await import("./session-token");
const { query, closePool } = await import("./db/pool");
const { beginUpload, finishUpload } = await import("./media-service");
const { LocalObjectStore, verifyLocalSignature } = await import("./storage");
const { resetRateLimits } = await import("./rate-limit");
const { validateEnvironment, ConfigurationError } = await import("./env");

// The route handlers, called directly.
const sessionRoute = await import("../../app/api/session/route");
const roomsRoute = await import("../../app/api/rooms/route");
const mediaRoute = await import("../../app/api/media/route");
const mediaIdRoute = await import("../../app/api/media/[id]/route");
const blobRoute = await import("../../app/api/media/blob/route");
const healthRoute = await import("../../app/api/health/route");
const judgeRoute = await import("../../app/api/judge/route");
const { resetRateLimit, MAX_AI_CALLS_PER_WINDOW } = await import("../ai/guard");

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
const settle = (ms = 300) => new Promise((r) => setTimeout(r, ms));
const randomCode = () =>
  Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");

const req = (url: string, init: RequestInit & { token?: string } = {}) => {
  const headers = new Headers(init.headers);
  if (init.token) headers.set("cookie", `${SESSION_COOKIE}=${init.token}`);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  return new Request(`http://test.local${url}`, { ...init, headers });
};
const body = async (r: Response) => {
  try {
    return await r.clone().json();
  } catch {
    return { raw: await r.clone().text() };
  }
};

function jpeg(size: number) {
  const b = new Uint8Array(size);
  b.set([0xff, 0xd8, 0xff, 0xe0], 0);
  b.set([0xff, 0xd9], size - 2);
  return b;
}

const store = new LocalObjectStore();
async function putSigned(url: string, bytes: Uint8Array) {
  const p = new URL(url, "http://local");
  const key = p.searchParams.get("key")!;
  if (!verifyLocalSignature(key, "PUT", Number(p.searchParams.get("expires")), p.searchParams.get("sig")!)) {
    return 403;
  }
  await store.put(key, bytes);
  return 200;
}

// --- actors -----------------------------------------------------------------

const aliceId = (await createSession()).id;
const bobId = (await createSession()).id;
const malloryId = (await createSession()).id;
const alice = { sessionId: aliceId };
const bob = { sessionId: bobId };
const mallory = { sessionId: malloryId };

const aliceToken = await mintToken(aliceId);
const bobToken = await mintToken(bobId);
const malloryToken = await mintToken(malloryId);

const seed = (code: string, hostId: string) => ({
  code, experienceId: "know-me", status: "active" as const, hostId,
  hostSince: Date.now(), seed: "s", createdAt: Date.now(), startedAt: Date.now(),
  players: {}, data: { secret: "private to this room" },
});

const CODE = randomCode();
const room = await createRoom(alice, { code: CODE, experienceId: "know-me", playerId: "p_alice", state: seed(CODE, "p_alice") as never });
await joinRoom(bob, { code: CODE, playerId: "p_bob" });

const OTHER = randomCode();
const otherRoom = await createRoom(mallory, { code: OTHER, experienceId: "debate", playerId: "p_m", state: seed(OTHER, "p_m") as never });

// ============================================================ 1. HTTP API ===

console.log("\n=== Unauthenticated HTTP access ===");

denyStatus("media ticket without a session", await mediaRoute.POST(req("/api/media", { method: "POST", body: JSON.stringify({ code: CODE, playerId: "p_alice" }) })), 401);
denyStatus(
  "media download without a session",
  await mediaIdRoute.GET(req(`/api/media/${room.id}`), { params: Promise.resolve({ id: "11111111-1111-1111-1111-111111111111" }) }),
  401,
);

function denyStatus(label: string, response: Response, expected: number) {
  check(label, response.status === expected, `got ${response.status}`);
}

console.log("\n=== Forged and stale sessions ===");

const forged = await new SignJWT({})
  .setProtectedHeader({ alg: "HS256" }).setSubject(aliceId)
  .setIssuer("together").setAudience("together:guest")
  .setIssuedAt().setExpirationTime("30d")
  .sign(new TextEncoder().encode("attacker".padEnd(64, "!")));
denyStatus("a token signed with another key is refused", await mediaRoute.POST(req("/api/media", { method: "POST", token: forged, body: "{}" })), 401);

const doomedId = (await createSession()).id;
const doomedToken = await mintToken(doomedId);
await deleteSession(doomedId);
denyStatus(
  "a validly signed token for a deleted session is refused",
  await mediaRoute.POST(req("/api/media", { method: "POST", token: doomedToken, body: "{}" })),
  401,
);

const noneAlg = `${Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url")}.${Buffer.from(
  JSON.stringify({ sub: aliceId, iss: "together", aud: "together:guest", exp: 9999999999 }),
).toString("base64url")}.`;
denyStatus("an alg:none token is refused", await mediaRoute.POST(req("/api/media", { method: "POST", token: noneAlg, body: "{}" })), 401);

// A cookie header that is not a cookie header.
for (const junk of ["", "=", ";;;", "together_session", "together_session=", "a=b; c=d"]) {
  const r = await sessionRoute.GET(new Request("http://test.local/api/session", { headers: { cookie: junk } }));
  check(`a malformed cookie (${JSON.stringify(junk).slice(0, 14)}) is handled, not crashed`, r.status === 200 && (await body(r)).sessionId === null);
}

console.log("\n=== Room authorization over HTTP ===");

const strangerJoin = await roomsRoute.POST(req("/api/rooms", { method: "POST", token: malloryToken, body: JSON.stringify({ code: CODE, playerId: "p_alice" }) }));
check("taking a seat another session holds is refused", strangerJoin.status === 409, `got ${strangerJoin.status}`);

const madeUp = await roomsRoute.POST(req("/api/rooms", { method: "POST", token: malloryToken, body: JSON.stringify({ code: randomCode(), playerId: "p_x" }) }));
check("joining a room that does not exist fails", madeUp.status === 404, `got ${madeUp.status}`);
check(
  "and says nothing about whether the code exists",
  /no such room/i.test((await body(madeUp)).error ?? ""),
  (await body(madeUp)).error,
);

console.log("\n=== Malformed and oversized HTTP input ===");

for (const [label, payload] of [
  ["not JSON", "}{"],
  ["a bare string", '"hello"'],
  ["an array", "[1,2,3]"],
  ["null", "null"],
] as const) {
  const r = await roomsRoute.POST(req("/api/rooms", { method: "POST", token: aliceToken, body: payload }));
  check(`${label} is rejected`, r.status === 400, `got ${r.status}`);
}

const huge = JSON.stringify({ code: CODE, playerId: "p_alice", state: { blob: "A".repeat(600 * 1024) } });
const oversize = await roomsRoute.POST(req("/api/rooms", { method: "POST", token: aliceToken, body: huge, headers: { "content-length": String(huge.length) } }));
check("an oversized body is rejected", oversize.status === 413, `got ${oversize.status}`);

const lyingLength = await roomsRoute.POST(req("/api/rooms", { method: "POST", token: aliceToken, body: huge }));
check("an oversized body with no content-length is still rejected", lyingLength.status === 413, `got ${lyingLength.status}`);

console.log("\n=== SQL-injection-shaped input ===");

for (const evil of ["' OR '1'='1", "'; drop table rooms; --", "\\'; select pg_sleep(5); --", "ABC123' UNION SELECT null--"]) {
  const r = await roomsRoute.POST(req("/api/rooms", { method: "POST", token: aliceToken, body: JSON.stringify({ code: evil, playerId: "p_alice" }) }));
  check(`a code of ${JSON.stringify(evil).slice(0, 22)}… is refused`, r.status >= 400 && r.status < 500, `got ${r.status}`);
}
const tablesStillThere = await query<{ n: string }>(`select count(*) as n from rooms`);
check("and the tables are all still there", Number(tablesStillThere.rows[0].n) >= 2);

for (const evil of ["../../etc/passwd", "p_alice'; --", " null"]) {
  const r = await roomsRoute.POST(req("/api/rooms", { method: "POST", token: aliceToken, body: JSON.stringify({ code: CODE, playerId: evil }) }));
  check(`a player id of ${JSON.stringify(evil).slice(0, 20)}… is refused`, r.status >= 400, `got ${r.status}`);
}

console.log("\n=== Error responses give nothing away ===");

const errorBodies: string[] = [];
for (const r of [strangerJoin, madeUp, oversize, await mediaRoute.POST(req("/api/media", { method: "POST", token: malloryToken, body: JSON.stringify({ code: CODE, playerId: "p_m" }) }))]) {
  errorBodies.push(JSON.stringify(await body(r)));
}
const joined = errorBodies.join(" ");
check("no stack traces", !/\bat \w+ \(|\.ts:\d+|node_modules/.test(joined));
check("no SQL or table names", !/relation|column|constraint|pg_|postgres|select |insert /i.test(joined));
check("no connection strings or secrets", !/postgres:\/\/|SESSION_SECRET|R2_|password/i.test(joined));
check("no file paths", !/\/Users\/|\/home\/|[A-Z]:\\\\/.test(joined));

console.log("\n=== Rate limits ===");

resetRateLimits();
let firstBlock = -1;
for (let i = 0; i < 60; i++) {
  const r = await roomsRoute.POST(req("/api/rooms", { method: "POST", token: aliceToken, headers: { "x-forwarded-for": "203.0.113.5" }, body: JSON.stringify({ code: CODE, playerId: "p_alice" }) }));
  if (r.status === 429) { firstBlock = i; break; }
}
check("room creation is rate limited", firstBlock > 0 && firstBlock <= 35, `blocked after ${firstBlock}`);

resetRateLimits();
let sessionBlocked = false;
for (let i = 0; i < 40; i++) {
  const r = await sessionRoute.POST(new Request("http://test.local/api/session", { method: "POST", headers: { "x-forwarded-for": "198.51.100.9" } }));
  if (r.status === 429) { sessionBlocked = true; break; }
}
check("anonymous session creation is rate limited", sessionBlocked);
check(
  "and a different caller is unaffected",
  (await sessionRoute.POST(new Request("http://test.local/api/session", { method: "POST", headers: { "x-forwarded-for": "198.51.100.10" } }))).status === 200,
);
resetRateLimits();

console.log("\n=== Spending someone else's money ===");

/*
 * The judging endpoint has no sign-in — two people playing a game are never
 * asked for one — so its per-caller limit counts against `x-forwarded-for`,
 * which the caller writes. This sends the attack: one client, a fresh address
 * on every request, far more requests than any limit allows.
 *
 * `fetch` is substituted here, and only here. What is faked is Anthropic's
 * endpoint — the thing that must not be called for real in a test — while the
 * limit being tested is the real one. What the counter measures is the only
 * number that matters: how many paid calls the attack actually produced.
 */
const realFetch = globalThis.fetch;
let upstreamCalls = 0;
process.env.ANTHROPIC_API_KEY = "sk-ant-test-key-not-real";
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (String(input).includes("api.anthropic.com")) {
    upstreamCalls++;
    return new Response(
      JSON.stringify({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              headline: "h", reasoning: "r", winnerName: null,
              players: [{ name: "A", argument: 5, evidence: 5, creativity: 5, persuasiveness: 5 }],
            }),
          },
        ],
      }),
      { status: 200 },
    );
  }
  return realFetch(input as RequestInfo, init);
}) as typeof fetch;

resetRateLimit();
const ATTEMPTS = 400;
let verdicts = 0;
for (let i = 0; i < ATTEMPTS; i++) {
  const r = await judgeRoute.POST(
    new Request("http://test.local/api/judge", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `10.0.${(i / 256) | 0}.${i % 256}` },
      body: JSON.stringify({ kind: "debate", topic: "pineapple", submissions: [{ playerId: "p", name: "A", side: "for", argument: "yes" }] }),
    }),
  );
  if (r.status === 200) verdicts++;
}
globalThis.fetch = realFetch;
delete process.env.ANTHROPIC_API_KEY;

check(
  "rotating the forwarded-for header does not buy unlimited paid calls",
  upstreamCalls <= MAX_AI_CALLS_PER_WINDOW,
  `${upstreamCalls} upstream calls from ${ATTEMPTS} spoofed requests, ceiling ${MAX_AI_CALLS_PER_WINDOW}`,
);
check(
  "and every player still got a verdict",
  verdicts === ATTEMPTS,
  `${verdicts} of ${ATTEMPTS}`,
);
resetRateLimit();

console.log("\n=== Caching ===");

for (const [label, r] of [
  ["health", await healthRoute.GET()],
  ["session", await sessionRoute.GET(req("/api/session", { token: aliceToken }))],
] as const) {
  check(`${label} is uncacheable`, /no-store/.test(r.headers.get("cache-control") ?? ""), r.headers.get("cache-control") ?? "none");
}

// ============================================================== 2. MEDIA ===

console.log("\n=== Media authorization ===");

const ticket = await beginUpload(alice, { code: CODE, playerId: "p_alice", kind: "booth", contentType: "image/jpeg" });
await putSigned(ticket.url, jpeg(4096));
await finishUpload(alice, ticket.mediaId);

const crossRoom = await mediaIdRoute.GET(req(`/api/media/${ticket.mediaId}`, { token: malloryToken }), { params: Promise.resolve({ id: ticket.mediaId }) });
check("a non-member cannot get a URL for another room's media", crossRoom.status === 404, `got ${crossRoom.status}`);
check(
  "and the refusal is identical to one for media that does not exist",
  JSON.stringify(await body(crossRoom)) ===
    JSON.stringify(await body(await mediaIdRoute.GET(req("/api/media/x", { token: malloryToken }), { params: Promise.resolve({ id: "99999999-9999-9999-9999-999999999999" }) }))),
);

const memberRead = await mediaIdRoute.GET(req(`/api/media/${ticket.mediaId}`, { token: bobToken }), { params: Promise.resolve({ id: ticket.mediaId }) });
check("a member of the same room can", memberRead.status === 200);

const uploadElsewhere = await mediaRoute.POST(req("/api/media", { method: "POST", token: malloryToken, body: JSON.stringify({ code: CODE, playerId: "p_m", kind: "booth", contentType: "image/jpeg" }) }));
check("a non-member cannot get an upload ticket for a room", uploadElsewhere.status >= 400, `got ${uploadElsewhere.status}`);

const seatSpoofUpload = await mediaRoute.POST(req("/api/media", { method: "POST", token: bobToken, body: JSON.stringify({ code: CODE, playerId: "p_alice", kind: "booth", contentType: "image/jpeg" }) }));
check("a member cannot upload as another player", seatSpoofUpload.status >= 400, `got ${seatSpoofUpload.status}`);

console.log("\n=== Signed URLs ===");

const probe = await store.presignUpload("rooms/probe/a.jpg", "image/jpeg");
const tampered = probe.url.replace(encodeURIComponent("rooms/probe/a.jpg"), encodeURIComponent("rooms/elsewhere/a.jpg"));
check("a tampered key is refused", (await putSigned(tampered, jpeg(256))) === 403);
check("an expired URL is refused", (await putSigned(probe.url.replace(/expires=\d+/, `expires=${Date.now() - 1}`), jpeg(256))) === 403);
check("an upload URL cannot be replayed as a download", (await blobRoute.GET(req(`/api/media/blob?${new URL(probe.url, "http://x").searchParams}`))).status === 403);

const unsigned = await blobRoute.GET(req(`/api/media/blob?key=rooms/probe/a.jpg&expires=${Date.now() + 60000}&sig=guessed`));
check("guessing an object key without a signature is refused", unsigned.status === 403);

const traversal = await blobRoute.PUT(req(`/api/media/blob?key=${encodeURIComponent("../../../etc/passwd")}&expires=${Date.now() + 60000}&sig=x`, { method: "PUT", body: "x" }));
check("a traversal key is refused", traversal.status >= 400, `got ${traversal.status}`);

check("a correctly signed upload is accepted", (await putSigned(probe.url, jpeg(512))) === 200);
const blobRead = await blobRoute.GET(req(`/api/media/blob?${new URL(await store.presignDownload("rooms/probe/a.jpg", 60), "http://x").searchParams}`));
check("blob responses forbid content sniffing", blobRead.headers.get("x-content-type-options") === "nosniff", blobRead.headers.get("x-content-type-options") ?? "absent");

// ========================================================== 3. WEBSOCKET ===

console.log("\n=== WebSocket ===");

const http: Server = createServer((_q, s) => s.end("ok"));
attachRealtime(http, "/ws");
await new Promise<void>((r) => http.listen(0, "127.0.0.1", () => r()));
const WS_URL = `ws://127.0.0.1:${(http.address() as AddressInfo).port}/ws`;

async function connect(token: string | null) {
  const ws = new WebSocket(WS_URL, { headers: token ? { Cookie: `${SESSION_COOKIE}=${token}` } : {} });
  const inbox: Record<string, unknown>[] = [];
  ws.on("message", (d) => {
    try { inbox.push(JSON.parse(d.toString())); } catch { /* server sends only JSON */ }
  });
  const ok = await new Promise<boolean>((resolve) => {
    const t = setTimeout(() => resolve(false), 3000);
    ws.once("open", () => { clearTimeout(t); resolve(true); });
    ws.once("error", () => { clearTimeout(t); resolve(false); });
    ws.once("unexpected-response", () => { clearTimeout(t); resolve(false); });
  });
  if (!ok) return null;
  await settle(120);
  return { ws, inbox, send: (m: unknown) => ws.send(JSON.stringify(m)) };
}

check("an upgrade with no session is refused", (await connect(null)) === null);
check("an upgrade with a forged token is refused", (await connect(forged)) === null);
check("an upgrade for a deleted session is refused", (await connect(doomedToken)) === null);

const mal = (await connect(malloryToken))!;
mal.send({ t: "subscribe", code: CODE, playerId: "p_m" });
await settle(600);
check("a non-member's subscribe is denied", mal.inbox.some((m) => m.t === "denied"));
check("and no room state reaches them", !mal.inbox.some((m) => m.t === "state"), `${mal.inbox.filter((m) => m.t === "state").length} state frames`);

const al = (await connect(aliceToken))!;
al.send({ t: "subscribe", code: CODE, playerId: "p_alice" });
await settle(500);
check("a member's subscribe succeeds", al.inbox.some((m) => m.t === "state"));

// Cross-room leakage: mallory is in OTHER, alice is in CODE.
const malOwn = (await connect(malloryToken))!;
malOwn.send({ t: "subscribe", code: OTHER, playerId: "p_m" });
await settle(400);
// Without this, the assertion below would pass just as happily against a
// listener that never got connected at all.
check(
  "the listener really is subscribed to its own room",
  malOwn.inbox.some((m) => m.t === "state"),
);
const beforeLeak = malOwn.inbox.length;
al.send({ t: "event", code: CODE, playerId: "p_alice", eventType: "draw:stroke", payload: { secret: true } });
await settle(500);
check(
  "an event in one room never reaches a member of another",
  !malOwn.inbox.slice(beforeLeak).some((m) => m.t === "event"),
);

console.log("\n=== Presence cannot be rewritten by a socket that lost its seat ===");

// The failure this guards: a replaced connection's close handler marks its
// former seat offline *after* the replacement announced itself, and a player
// who is sitting right there goes grey.
const first = (await connect(aliceToken))!;
first.send({ t: "subscribe", code: CODE, playerId: "p_alice" });
await settle(400);
const second = (await connect(aliceToken))!;
second.send({ t: "subscribe", code: CODE, playerId: "p_alice" });
await settle(900);
// Offline is recorded by winding `last_seen` back to the epoch.
const presence = await query<{ stale: boolean }>(
  `select p.last_seen < now() - interval '1 hour' as stale
     from room_players p
     join rooms r on r.id = p.room_id
    where r.code = $1 and p.player_id = 'p_alice'`,
  [CODE],
);
check(
  "a superseded socket closing does not mark the live seat offline",
  presence.rows.length > 0 && presence.rows[0].stale === false,
  JSON.stringify(presence.rows),
);
first.ws.close();
second.ws.close();
await settle(300);

console.log("\n=== Connection limits ===");

const flood = [];
for (let i = 0; i < 16; i++) flood.push(await connect(malloryToken));
const opened = flood.filter(Boolean).length;
check("sockets per session are capped", opened <= realtimeStats().limits.perSession, `${opened} opened`);
check("and the cap is enforced at the handshake", opened < 16, `${opened} of 16 opened`);
for (const c of flood) c?.ws.close();
await settle(400);

// ======================================================== 4. STRUCTURAL ===

console.log("\n=== Startup configuration ===");

const badConfigs: Array<[string, NodeJS.ProcessEnv]> = [
  ["a missing SESSION_SECRET", { DATABASE_URL: "postgres://x/y" }],
  ["a short SESSION_SECRET", { DATABASE_URL: "postgres://x/y", SESSION_SECRET: "tooshort" }],
  ["a DATABASE_URL that is not one", { DATABASE_URL: "not-a-url", SESSION_SECRET: "x".repeat(40) }],
  ["half-configured object storage", { DATABASE_URL: "postgres://x/y", SESSION_SECRET: "x".repeat(40), R2_BUCKET: "b" }],
  ["ws:// in production", { NODE_ENV: "production", DATABASE_URL: "postgres://x/y", SESSION_SECRET: "x".repeat(40), NEXT_PUBLIC_WS_URL: "ws://example.com/ws" }],
  ["a secret behind a NEXT_PUBLIC_ name", { DATABASE_URL: "postgres://x/y", SESSION_SECRET: "x".repeat(40), NEXT_PUBLIC_SESSION_SECRET: "leaked" }],
  ["a localhost websocket URL in production", { NODE_ENV: "production", DATABASE_URL: "postgres://x/y", SESSION_SECRET: "x".repeat(40), NEXT_PUBLIC_WS_URL: "wss://localhost:3000/ws" }],
  ["a 127.0.0.1 site URL in production", { NODE_ENV: "production", DATABASE_URL: "postgres://x/y", SESSION_SECRET: "x".repeat(40), NEXT_PUBLIC_WS_URL: "wss://real.example.com/ws", NEXT_PUBLIC_SITE_URL: "https://127.0.0.1:3000" }],
];
for (const [label, env] of badConfigs) {
  let threw = false;
  try { validateEnvironment(env); } catch (e) { threw = e instanceof ConfigurationError; }
  check(`startup refuses ${label}`, threw);
}
let good = false;
try {
  const report = validateEnvironment({ DATABASE_URL: "postgres://x/y", SESSION_SECRET: "x".repeat(64), NEXT_PUBLIC_WS_URL: "wss://x/ws" });
  good = report.mode === "hosted";
} catch { /* should not happen */ }
check("and accepts a good one", good);

// --- teardown ---------------------------------------------------------------

for (const c of [mal, al, malOwn]) c?.ws.close();
await shutdownRealtime("done");
await new Promise<void>((r) => http.close(() => r()));
await closePool();
await pgSocket.server.stop();
await db.close();
await rm(storageDir, { recursive: true, force: true });

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFailures:");
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
process.exit(0);
