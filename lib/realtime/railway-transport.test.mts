/**
 * RailwayRoomTransport, against the real thing.
 *
 *   npm run test:transport
 *
 * The stage 4 WebSocket server, the real data layer, a real Postgres, and a
 * small real HTTP server standing in for the two Next.js route handlers the
 * transport calls. No mocks — the point of a transport test is that the wiring
 * is right, and a mocked socket proves only that the mock matches my
 * assumptions.
 */
process.env.SESSION_SECRET = "r".repeat(64);

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { startPgSocket } from "../server/testing/pg-socket.mts";
import WebSocket from "ws";
import type { RoomState } from "../rooms/types";
import { migrate } from "../../db/migrate.mjs";

// --- a real Postgres --------------------------------------------------------

const db = await PGlite.create({ extensions: { pgcrypto } });
const pgSocket = await startPgSocket(db);
process.env.DATABASE_URL = pgSocket.url;
process.env.PGPOOL_MAX = "1";
await migrate(process.env.DATABASE_URL, { quiet: true });

const { attachRealtime, shutdownRealtime } = await import("../server/ws/server");
const { createRoom, joinRoom, readRoom } = await import("../server/db/rooms");
const { createSession } = await import("../server/db/sessions");
const { mintToken, SESSION_COOKIE } = await import("../server/session-token");
const { query } = await import("../server/db/pool");
const { RailwayRoomTransport, RailwayConnectionError } = await import("./railway-transport");

// --- the two HTTP routes the transport uses ---------------------------------
//
// Next.js route handlers cannot be invoked outside a Next server, so these
// reimplement the same two calls against the same data layer. What is under
// test is the transport's use of them, not Next's routing.

function readCookieSession(req: IncomingMessage): string | null {
  const raw = req.headers.cookie ?? "";
  const part = raw.split(";").map((s) => s.trim()).find((s) => s.startsWith(`${SESSION_COOKIE}=`));
  return part ? decodeURIComponent(part.slice(SESSION_COOKIE.length + 1)) : null;
}

const { verifyToken } = await import("../server/session-token");
const { loadSession } = await import("../server/db/sessions");

const http: Server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const json = (status: number, body: unknown, cookie?: string) => {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (cookie) headers["set-cookie"] = cookie;
    res.writeHead(status, headers);
    res.end(JSON.stringify(body));
  };

  const token = readCookieSession(req);
  let sessionId = token ? await verifyToken(token) : null;
  if (sessionId && !(await loadSession(sessionId))) sessionId = null;

  if (req.url === "/api/session" && req.method === "POST") {
    if (sessionId) return json(200, { mode: "railway", sessionId });
    const row = await createSession();
    const fresh = await mintToken(row.id);
    return json(200, { mode: "railway", sessionId: row.id }, `${SESSION_COOKIE}=${fresh}; Path=/`);
  }

  if (req.url === "/api/rooms" && req.method === "POST") {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const body = JSON.parse(Buffer.concat(chunks).toString() || "{}");

    let setCookie: string | undefined;
    if (!sessionId) {
      const row = await createSession();
      sessionId = row.id;
      setCookie = `${SESSION_COOKIE}=${await mintToken(row.id)}; Path=/`;
    }
    const ctx = { sessionId };

    try {
      const joined = await joinRoom(ctx, { code: body.code, playerId: body.playerId });
      return json(200, { code: joined.code, state: joined.state, version: joined.version }, setCookie);
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (status !== 404 || !body.asHost) {
        return json(status ?? 500, { error: (error as Error).message }, setCookie);
      }
    }
    const created = await createRoom(ctx, {
      code: body.code,
      experienceId: body.experienceId,
      playerId: body.playerId,
      state: body.state,
    });
    return json(200, { code: created.code, state: created.state, version: created.version }, setCookie);
  }

  json(404, { error: "not found" });
});

attachRealtime(http, "/ws");
await new Promise<void>((r) => http.listen(0, "127.0.0.1", () => r()));
const PORT = (http.address() as AddressInfo).port;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const WS_URL = `ws://127.0.0.1:${PORT}/ws`;

// --- a browser, roughly -----------------------------------------------------
//
// One cookie jar per "browser", so the HttpOnly session behaves as it does in a
// real one: set by the server, sent automatically, never touched by this code.

function makeBrowser() {
  const jar = new Map<string, string>();

  const fetchImpl: typeof fetch = async (input, init) => {
    const headers = new Headers(init?.headers);
    if (jar.size) headers.set("cookie", [...jar].map(([k, v]) => `${k}=${v}`).join("; "));
    const response = await fetch(input as string, { ...init, headers });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) {
      const [pair] = setCookie.split(";");
      const eq = pair.indexOf("=");
      jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
    return response;
  };

  // `ws` accepts headers; a browser sends the cookie itself. Same effect.
  class CookieWebSocket extends WebSocket {
    constructor(url: string) {
      super(url, {
        headers: jar.size
          ? { Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") }
          : {},
      });
    }
  }

  return { jar, fetchImpl, WebSocketImpl: CookieWebSocket as unknown as typeof globalThis.WebSocket };
}

function transportFor(browser: ReturnType<typeof makeBrowser>, code: string, playerId: string) {
  return new RailwayRoomTransport(code, {
    playerId,
    wsUrl: WS_URL,
    origin: ORIGIN,
    fetchImpl: browser.fetchImpl,
    WebSocketImpl: browser.WebSocketImpl,
  });
}

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
const settle = (ms = 350) => new Promise((r) => setTimeout(r, ms));
const randomCode = () =>
  Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");

const seedState = (code: string, hostId: string): RoomState => ({
  code,
  experienceId: "know-me",
  status: "lobby",
  hostId,
  hostSince: Date.now(),
  seed: "s_transport",
  createdAt: Date.now(),
  startedAt: null,
  players: {
    [hostId]: { id: hostId, name: "Host", emoji: "🌸", role: "host", ready: false, lastSeen: Date.now() },
  },
  data: {},
});

// --- 1. connect and create --------------------------------------------------

console.log("\n=== Connect, authenticate, create ===");

const code = randomCode();
const hostBrowser = makeBrowser();
const host = transportFor(hostBrowser, code, "p_host");

check("the transport reports its kind", host.kind === "railway");
await host.connect();
check("connect establishes a session and a socket", true);
check("the session cookie was set by the server, not by us", hostBrowser.jar.has(SESSION_COOKIE));

const created = await host.ensureRoom(seedState(code, "p_host"));
check("ensureRoom creates the room", created.code === code);
check("and returns the document", created.experienceId === "know-me");

const readBack = await host.readState();
check("readState returns the current document", readBack?.code === code);

// --- 2. join ----------------------------------------------------------------

console.log("\n=== Join ===");

const guestBrowser = makeBrowser();
const guest = transportFor(guestBrowser, code, "p_guest");
await guest.connect();
const joined = await guest.ensureRoom({ ...seedState(code, "p_host"), players: {} });
check("a second browser joins the same room", joined.code === code);
check("the guest gets its own session", guestBrowser.jar.get(SESSION_COOKIE) !== hostBrowser.jar.get(SESSION_COOKIE));

await settle();
const rosterState = await host.readState();
check(
  "both seats appear in RoomState.players, unchanged in shape",
  Object.keys(rosterState?.players ?? {}).length === 2,
  `saw ${Object.keys(rosterState?.players ?? {}).length}`,
);

// --- 3. shared state --------------------------------------------------------

console.log("\n=== Shared state ===");

const guestSaw: RoomState[] = [];
guest.onState((s) => guestSaw.push(s));

await host.patchState((current) => ({ data: { ...current.data, round: 1 } }));
await settle();
check(
  "a patch from one side reaches the other",
  (guestSaw.at(-1)?.data as Record<string, unknown>)?.round === 1,
);

await guest.patchState((current) => ({ data: { ...current.data, answer: "blue" } }));
await settle();
const merged = await host.readState();
check(
  "and the document accumulates rather than replacing",
  (merged?.data as Record<string, unknown>)?.round === 1 &&
    (merged?.data as Record<string, unknown>)?.answer === "blue",
);

// --- 4. version conflicts ---------------------------------------------------

console.log("\n=== Version conflicts ===");

// Force a genuine race: both derive from the same version before either lands.
const before = await readRoom({ sessionId: (await sessionIdFor(hostBrowser))! }, code);
const raced = await Promise.all([
  host.patchState((c) => ({ data: { ...c.data, host: "wrote" } })),
  guest.patchState((c) => ({ data: { ...c.data, guest: "wrote" } })),
]);
void raced;
await settle(600);

const afterRace = await host.readState();
check(
  "both concurrent writes survive — the loser retried rather than clobbering",
  (afterRace?.data as Record<string, unknown>)?.host === "wrote" &&
    (afterRace?.data as Record<string, unknown>)?.guest === "wrote",
  JSON.stringify(afterRace?.data),
);

const afterVersion = await readRoom({ sessionId: (await sessionIdFor(hostBrowser))! }, code);
check("the version advanced twice, not once", afterVersion.version >= before.version + 2);

// --- 5. events: chat and reactions ------------------------------------------

console.log("\n=== Chat and reactions ===");

const guestEvents: { type: string; payload: unknown; from: string; id: string }[] = [];
guest.onEvent((e) => guestEvents.push(e));
const hostEvents: { type: string; id: string }[] = [];
host.onEvent((e) => hostEvents.push(e));

await host.broadcast("watch:message", { id: "msg_1", text: "hello", by: "p_host" });
await settle();
check("a chat line reaches the other side", guestEvents.some((e) => e.type === "watch:message"));
check("stamped with the real sender", guestEvents.find((e) => e.type === "watch:message")?.from === "p_host");
check(
  "and the sender does not receive their own back",
  !hostEvents.some((e) => e.type === "watch:message"),
);

await guest.broadcast("watch:reaction", { id: "rx_1", emoji: "🎉", by: "p_guest" });
await host.broadcast("draw:stroke", { playerId: "p_host", stroke: { id: "s1", points: [0.1, 0.2] } });
await settle();
check("reactions cross", hostEvents.some((e) => e.type === "watch:reaction"));
check("draw strokes cross", guestEvents.some((e) => e.type === "draw:stroke"));

const idsSeen = guestEvents.map((e) => e.id);
check("every event carries a distinct server id", new Set(idsSeen).size === idsSeen.length);

// --- 6. media references, not media -----------------------------------------

console.log("\n=== Media references ===");

await host.broadcast("hunt:photo", { photoId: "ph_abc123", thumbnail: "data:image/jpeg;base64,AAAA" });
await settle();
check("a photo *reference* passes", guestEvents.some((e) => e.type === "hunt:photo"));

let inlineRejected = false;
try {
  await host.broadcast("booth:shot", {
    round: 0,
    dataUrl: "data:image/jpeg;base64," + "A".repeat(300 * 1024),
  });
  await settle(600);
} catch {
  inlineRejected = true;
}
const gotBigPhoto = guestEvents.some((e) => e.type === "booth:shot");
check(
  "a 300 KB inline photo does not reach the other side",
  !gotBigPhoto,
  inlineRejected ? "(the send itself threw)" : "(the server dropped it)",
);

// --- 7. presence and ready --------------------------------------------------

console.log("\n=== Presence and ready state ===");

const versionBefore = (await readRoom({ sessionId: (await sessionIdFor(hostBrowser))! }, code)).version;
for (let i = 0; i < 5; i++) {
  await host.presence({ name: "Host", emoji: "🌸" });
  await settle(60);
}
const versionAfter = (await readRoom({ sessionId: (await sessionIdFor(hostBrowser))! }, code)).version;
check(
  "five presence beats leave the room document alone",
  versionAfter === versionBefore,
  `${versionBefore} -> ${versionAfter}`,
);

await guest.presence({ ready: true, name: "Guest", emoji: "🦋" });
await settle(500);
const readyState = await host.readState();
check(
  "ready state still arrives through RoomState.players",
  (readyState?.players as Record<string, { ready?: boolean }>)?.p_guest?.ready === true,
);

// --- 8. unauthorized access -------------------------------------------------

console.log("\n=== Unauthorized access ===");

const strangerBrowser = makeBrowser();
const stranger = transportFor(strangerBrowser, code, "p_stranger");
await stranger.connect();

let subscribeRefused = false;
try {
  // No join: straight to subscribe, which is what a hostile client would do.
  await (stranger as unknown as { subscribe(): Promise<void> }).subscribe();
} catch (error) {
  subscribeRefused = error instanceof RailwayConnectionError;
}
check("subscribing without joining is refused", subscribeRefused);

const strangerStates: RoomState[] = [];
stranger.onState((s) => strangerStates.push(s));
await host.patchState((c) => ({ data: { ...c.data, secret: "not for them" } }));
await settle(500);
check("and no state reaches them", strangerStates.length === 0, `received ${strangerStates.length}`);

// Someone who *is* a member of a different room.
const otherCode = randomCode();
const otherBrowser = makeBrowser();
const other = transportFor(otherBrowser, otherCode, "p_other");
await other.connect();
await other.ensureRoom(seedState(otherCode, "p_other"));

const crossing = transportFor(otherBrowser, code, "p_other");
let crossRefused = false;
try {
  await crossing.connect();
  await (crossing as unknown as { subscribe(): Promise<void> }).subscribe();
} catch {
  crossRefused = true;
}
check("a member of one room cannot subscribe to another", crossRefused);
await crossing.disconnect();

// --- 9. reconnect and late join ---------------------------------------------

console.log("\n=== Reconnect ===");

const guestSocket = (guest as unknown as { socket: WebSocket }).socket;
guestSocket.close();
await settle(1500); // long enough for the backoff to fire

await host.patchState((c) => ({ data: { ...c.data, whileAway: true } }));
await settle(800);

const afterReconnect = await guest.readState();
check(
  "the transport reconnects on its own",
  (guest as unknown as { socket: WebSocket | null }).socket !== null,
);
check(
  "and catches up on what it missed",
  (afterReconnect?.data as Record<string, unknown>)?.whileAway === true,
  JSON.stringify(afterReconnect?.data)?.slice(0, 80),
);

console.log("\n=== Late join ===");

const lateBrowser = makeBrowser();
const late = transportFor(lateBrowser, code, "p_late");
await late.connect();
const lateState = await late.ensureRoom({ ...seedState(code, "p_host"), players: {} });
check(
  "a late joiner receives everything already in the room",
  (lateState.data as Record<string, unknown>)?.round === 1 &&
    (lateState.data as Record<string, unknown>)?.whileAway === true,
);

// --- 10. host migration -----------------------------------------------------

console.log("\n=== Host migration ===");

const hostSession = (await sessionIdFor(hostBrowser))!;
const roomRow = await query<{ id: string }>(`select id from rooms where code = $1`, [code]);
await query(
  `update room_players set last_seen = now() - interval '90 seconds' where room_id = $1 and player_id = $2`,
  [roomRow.rows[0].id, "p_host"],
);
await query(`update rooms set state = jsonb_set(state, '{hostSince}', to_jsonb(0)) where id = $1`, [
  roomRow.rows[0].id,
]);
await guest.presence({ name: "Guest", emoji: "🦋" });
await settle(300);

const preMigration = await guest.readState();
await guest.patchState(() => ({ hostId: "p_guest", hostSince: Date.now() }));
await settle(600);
const migrated = await query<{ host_id: string }>(`select host_id from rooms where code = $1`, [code]);
check("a legitimate handover moves the seat", migrated.rows[0].host_id === "p_guest", `host is ${migrated.rows[0].host_id}`);
void preMigration;

// The former host coming back does not take it away again.
await host.presence({ name: "Host", emoji: "🌸" });
await settle(400);
const stillGuest = await query<{ host_id: string }>(`select host_id from rooms where code = $1`, [code]);
check("the returning former host stays a guest", stillGuest.rows[0].host_id === "p_guest");

// An illegitimate claim is refused rather than silently ignored.
await query(`update room_players set last_seen = now() where room_id = $1`, [roomRow.rows[0].id]);
await query(`update rooms set state = jsonb_set(state, '{hostSince}', to_jsonb(0)) where id = $1`, [
  roomRow.rows[0].id,
]);
let claimRefused = false;
try {
  await late.patchState(() => ({ hostId: "p_late" }));
} catch (error) {
  claimRefused = error instanceof RailwayConnectionError;
}
await settle(300);
const unchanged = await query<{ host_id: string }>(`select host_id from rooms where code = $1`, [code]);
check("a claim while the host is alive is refused", claimRefused);
check("and the seat did not move", unchanged.rows[0].host_id === "p_guest");

// --- 11. leave --------------------------------------------------------------

console.log("\n=== Leave ===");

await late.disconnect();
await settle(500);
const afterLeave = await host.readState();
const lateSeat = (afterLeave?.players as Record<string, { lastSeen: number }>)?.p_late;
check(
  "leaving marks the seat offline at once, without waiting out the timeout",
  !lateSeat || lateSeat.lastSeen === 0 || Date.now() - lateSeat.lastSeen > 40_000,
  `lastSeen ${lateSeat?.lastSeen}`,
);

// --- 12. connection failure is loud -----------------------------------------

console.log("\n=== Connection failure ===");

const deadBrowser = makeBrowser();
const dead = new RailwayRoomTransport(code, {
  playerId: "p_dead",
  wsUrl: "ws://127.0.0.1:1/ws",
  origin: "http://127.0.0.1:1",
  fetchImpl: deadBrowser.fetchImpl,
  WebSocketImpl: deadBrowser.WebSocketImpl,
});
let failedLoudly = false;
try {
  await dead.connect();
} catch (error) {
  failedLoudly = error instanceof RailwayConnectionError;
}
check("an unreachable server throws rather than falling back to local", failedLoudly);
await dead.disconnect();

// --- 13. server restart -----------------------------------------------------

console.log("\n=== Server restart ===");

const survivorBrowser = makeBrowser();
const survivor = transportFor(survivorBrowser, code, "p_survivor");
await survivor.connect();
await survivor.ensureRoom({ ...seedState(code, "p_host"), players: {} });

await shutdownRealtime("test restart");
await settle(300);
check("the socket drops when the server goes away", (survivor as unknown as { socket: WebSocket | null }).socket === null);

// Bring it back on the same port and let the backoff find it.
attachRealtime(http, "/ws");
await settle(3000);
check(
  "and the transport reconnects once it returns",
  (survivor as unknown as { socket: WebSocket | null }).socket !== null,
);

await host.patchState((c) => ({ data: { ...c.data, afterRestart: true } }));
await settle(800);
const resumed = await survivor.readState();
check(
  "state flows again after the restart",
  (resumed?.data as Record<string, unknown>)?.afterRestart === true,
  JSON.stringify(resumed?.data)?.slice(0, 80),
);

// --- teardown ---------------------------------------------------------------

for (const t of [host, guest, stranger, other, late, survivor]) {
  await t.disconnect().catch(() => {});
}
await shutdownRealtime("done");
await new Promise<void>((r) => http.close(() => r()));
await pgSocket.server.stop();
await db.close();

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFailures:");
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
process.exit(0);

// --- helpers ----------------------------------------------------------------

async function sessionIdFor(browser: ReturnType<typeof makeBrowser>) {
  const token = browser.jar.get(SESSION_COOKIE);
  return token ? verifyToken(token) : null;
}
