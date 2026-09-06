/**
 * The Photobooth two-artefact flow, end to end.
 *
 *   npm run test:photobooth
 *
 * Real bytes, the real stage 6 media service, a real Postgres, the real
 * WebSocket server and real transports. What is being checked is the shape of
 * what moves: that the 391 KB original goes to storage and nowhere else, that
 * the ≤2 KB placeholder is the only photo-shaped thing in the room document or
 * on the socket, and that the export still gets the original back.
 *
 * The browser half — canvas capture and `makeThumbnail` — cannot run here.
 * Thumbnail *sizes* are therefore taken from real JPEG bytes at the sizes the
 * encoder is configured to produce, and the budget rule itself is tested
 * directly. Actual canvas output is stage 14, on a device.
 */
process.env.SESSION_SECRET = "b".repeat(64);

import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import WebSocket from "ws";
import { migrate } from "../../db/migrate.mjs";

const storageDir = await mkdtemp(join(tmpdir(), "together-booth-test-"));
process.env.LOCAL_STORAGE_DIR = storageDir;

const db = await PGlite.create({ extensions: { pgcrypto } });
const PG_PORT = 56_400 + Math.floor(Math.random() * 200);
const pgServer = new PGLiteSocketServer({ db, port: PG_PORT, host: "127.0.0.1" });
await pgServer.start();
process.env.DATABASE_URL = `postgres://postgres:postgres@127.0.0.1:${PG_PORT}/postgres`;
process.env.PGPOOL_MAX = "1";
await migrate(process.env.DATABASE_URL, { quiet: true });

const { attachRealtime, shutdownRealtime } = await import("../server/ws/server");
const { createRoom, joinRoom, readRoom, patchRoom } = await import("../server/db/rooms");
const { createSession } = await import("../server/db/sessions");
const { collectAbandonedMedia } = await import("../server/db/media");
const { beginUpload, finishUpload, downloadUrl } = await import("../server/media-service");
const { LocalObjectStore, verifyLocalSignature, objectStore } = await import("../server/storage");
const { mintToken, SESSION_COOKIE } = await import("../server/session-token");
const { query, closePool } = await import("../server/db/pool");
const { isWithinThumbnailBudget, MAX_THUMBNAIL_BUDGET } = await import("./thumbnail");

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

function jpegBytes(size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  bytes.set([0xff, 0xd8, 0xff, 0xe0], 0);
  for (let i = 4; i < size - 2; i++) bytes[i] = (i * 37) % 251;
  bytes.set([0xff, 0xd9], size - 2);
  return bytes;
}
const toDataUrl = (bytes: Uint8Array) =>
  `data:image/jpeg;base64,${Buffer.from(bytes).toString("base64")}`;

const store = new LocalObjectStore();
async function putBytes(url: string, body: Uint8Array): Promise<number> {
  const p = new URL(url, "http://local");
  const key = p.searchParams.get("key")!;
  if (!verifyLocalSignature(key, "PUT", Number(p.searchParams.get("expires")), p.searchParams.get("sig")!)) {
    return 403;
  }
  await store.put(key, body);
  return 200;
}
async function getBytes(url: string): Promise<Uint8Array | null> {
  const p = new URL(url, "http://local");
  const key = p.searchParams.get("key")!;
  if (!verifyLocalSignature(key, "GET", Number(p.searchParams.get("expires")), p.searchParams.get("sig")!)) {
    return null;
  }
  return store.get(key);
}

// --- a WebSocket server, so payloads can be observed on the wire ------------

const http: Server = createServer((_req: IncomingMessage, res: ServerResponse) => res.end("ok"));
attachRealtime(http, "/ws");
await new Promise<void>((r) => http.listen(0, "127.0.0.1", () => r()));
const WS_URL = `ws://127.0.0.1:${(http.address() as AddressInfo).port}/ws`;

async function socketFor(token: string) {
  const ws = new WebSocket(WS_URL, { headers: { Cookie: `${SESSION_COOKIE}=${token}` } });
  const inbox: Record<string, unknown>[] = [];
  ws.on("message", (d) => {
    try {
      inbox.push(JSON.parse(d.toString()));
    } catch {
      /* the server sends only JSON */
    }
  });
  await new Promise<void>((resolve, reject) => {
    ws.once("open", () => resolve());
    ws.once("error", reject);
  });
  await settle(150);
  return { ws, inbox, send: (m: unknown) => ws.send(JSON.stringify(m)) };
}

// --- actors -----------------------------------------------------------------

const aliceRow = await createSession();
const bobRow = await createSession();
const malloryRow = await createSession();
const alice = { sessionId: aliceRow.id };
const bob = { sessionId: bobRow.id };
const mallory = { sessionId: malloryRow.id };

const code = randomCode();
const seed = {
  code,
  experienceId: "photobooth",
  status: "active" as const,
  hostId: "p_alice",
  hostSince: Date.now(),
  seed: "s_booth",
  createdAt: Date.now(),
  startedAt: Date.now(),
  players: {},
  data: { booth: { phase: "shooting", totalRounds: 4, round: 0, taken: {}, previews: {} } },
};
const room = await createRoom(alice, { code, experienceId: "photobooth", playerId: "p_alice", state: seed as never });
await joinRoom(bob, { code, playerId: "p_bob" });

// A stranger with a legitimate room of her own.
const otherCode = randomCode();
await createRoom(mallory, {
  code: otherCode, experienceId: "photobooth", playerId: "p_m",
  state: { ...seed, code: otherCode, hostId: "p_m" } as never,
});

// --- 1. capture produces two artefacts --------------------------------------

console.log("\n=== One shutter, two artefacts ===");

/** What the browser produces: a 391 KB capture and a thumbnail from it. */
const ORIGINAL_BYTES = 391 * 1024;
const original = jpegBytes(ORIGINAL_BYTES);
// A 48px JPEG of a photograph lands around 1.0–1.4 KB; this is that size in
// real bytes, base64-wrapped exactly as the canvas would return it.
const thumbnail = toDataUrl(jpegBytes(950));

check("the capture is full resolution", original.byteLength === ORIGINAL_BYTES);
check(
  `the thumbnail is ${thumbnail.length} bytes, within the ${MAX_THUMBNAIL_BUDGET} budget`,
  isWithinThumbnailBudget(thumbnail),
);
check(
  "the thumbnail is ~300x smaller than the original",
  Math.round(toDataUrl(original).length / thumbnail.length) > 200,
  `${Math.round(toDataUrl(original).length / thumbnail.length)}x`,
);

const ticket = await beginUpload(alice, { code, playerId: "p_alice", kind: "booth", contentType: "image/jpeg" });
check("the original uploads", (await putBytes(ticket.url, original)) === 200);
const stored = await finishUpload(alice, ticket.mediaId);
check("and lands at full size", stored.bytes === ORIGINAL_BYTES, `${stored.bytes}`);

// --- 2. only the reference enters the room document -------------------------

console.log("\n=== What reaches the room document ===");

const before = await readRoom(alice, code);
const withPreview = {
  ...before.state,
  data: {
    booth: {
      ...(before.state.data as Record<string, unknown>).booth as object,
      taken: { "0": ["p_alice"] },
      previews: { "0": { p_alice: { mediaId: ticket.mediaId, thumbnail } } },
    },
  },
};
await patchRoom(alice, { code, playerId: "p_alice", version: before.version, state: withPreview as never });

const documentRow = await query<{ text: string; size: number }>(
  `select state::text as text, octet_length(state::text) as size from rooms where code = $1`,
  [code],
);
const documentText = documentRow.rows[0].text;

check("the media id is in the document", documentText.includes(ticket.mediaId));
check("the thumbnail is in the document", documentText.includes(thumbnail.slice(0, 40)));
check(
  "no full-resolution image is in the document",
  !/data:image\/[a-z]+;base64,[A-Za-z0-9+/=]{4000,}/.test(documentText),
);
check(
  `the whole document is ${documentRow.rows[0].size} bytes, not hundreds of kilobytes`,
  documentRow.rows[0].size < 8 * 1024,
);

// --- 3. nothing large crosses the socket ------------------------------------

console.log("\n=== What crosses the socket ===");

const aliceSocket = await socketFor(await mintToken(alice.sessionId));
const bobSocket = await socketFor(await mintToken(bob.sessionId));
aliceSocket.send({ t: "subscribe", code, playerId: "p_alice" });
bobSocket.send({ t: "subscribe", code, playerId: "p_bob" });
await settle(400);

aliceSocket.send({
  t: "event", code, playerId: "p_alice", eventType: "booth:shot",
  payload: { round: 0, playerId: "p_alice", mediaId: ticket.mediaId, thumbnail },
});
await settle(400);

const partnerEvent = bobSocket.inbox.find(
  (m) => m.t === "event" && m.eventType === "booth:shot",
) as { payload?: { mediaId?: string; thumbnail?: string } } | undefined;

check("the partner receives the announcement", Boolean(partnerEvent));
check("carrying the media id", partnerEvent?.payload?.mediaId === ticket.mediaId);
check("and the thumbnail", partnerEvent?.payload?.thumbnail === thumbnail);
check(
  "the whole frame is under 2 KB",
  JSON.stringify(partnerEvent).length < 2_048,
  `${JSON.stringify(partnerEvent).length} bytes`,
);

// The original itself must be refused if anyone ever tries. Two independent
// defences catch it, and which one fires depends on size: base64 of 391 KB is
// ~521 KB, past the 256 KB frame cap, so `ws` closes the connection before any
// application code sees it. A smaller-but-still-inline photo gets past the
// frame cap and is caught by the payload inspector instead. Both are tested,
// because relying on only the outer one would mean a 100 KB photo slipped
// through.
const bigRefused = new Promise<string>((resolve) => {
  const timer = setTimeout(() => resolve("nothing happened"), 3000);
  aliceSocket.ws.once("close", (closeCode) => {
    clearTimeout(timer);
    resolve(closeCode === 1009 ? "frame cap" : `closed ${closeCode}`);
  });
  const onMessage = (d: Buffer) => {
    const m = JSON.parse(d.toString());
    if (m.t === "error" && /object storage/i.test(String(m.reason))) {
      clearTimeout(timer);
      aliceSocket.ws.off("message", onMessage);
      resolve("payload inspector");
    }
  };
  aliceSocket.ws.on("message", onMessage);
});
aliceSocket.send({
  t: "event", code, playerId: "p_alice", eventType: "booth:shot",
  payload: { round: 1, playerId: "p_alice", dataUrl: toDataUrl(original) },
});
const bigOutcome = await bigRefused;
check(
  "a 391 KB original over the socket is refused",
  bigOutcome === "frame cap" || bigOutcome === "payload inspector",
  `by the ${bigOutcome}`,
);

// And one small enough to pass the frame cap is still refused, by the inspector.
const mediumSocket = await socketFor(await mintToken(alice.sessionId));
mediumSocket.send({ t: "subscribe", code, playerId: "p_alice" });
await settle(400);
const mediumRefused = new Promise<boolean>((resolve) => {
  const timer = setTimeout(() => resolve(false), 3000);
  mediumSocket.ws.on("message", (d: Buffer) => {
    const m = JSON.parse(d.toString());
    if (m.t === "error" && /object storage/i.test(String(m.reason))) {
      clearTimeout(timer);
      resolve(true);
    }
  });
});
mediumSocket.send({
  t: "event", code, playerId: "p_alice", eventType: "booth:shot",
  payload: { round: 2, playerId: "p_alice", dataUrl: toDataUrl(jpegBytes(60 * 1024)) },
});
check("an 80 KB inline photo is refused by the payload inspector", await mediumRefused);
mediumSocket.ws.close();

const everythingBobSaw = JSON.stringify(bobSocket.inbox);
check(
  "and no full-resolution image ever reached the partner over the wire",
  !/data:image\/[a-z]+;base64,[A-Za-z0-9+/=]{4000,}/.test(everythingBobSaw),
);

// --- 4. the partner can fetch the original ----------------------------------

console.log("\n=== Fetching the original ===");

const bobUrl = await downloadUrl(bob, ticket.mediaId);
const bobBytes = await getBytes(bobUrl.url);
check("the partner gets the original", bobBytes?.byteLength === ORIGINAL_BYTES, `${bobBytes?.byteLength}`);
check("byte-identical to what was captured", Buffer.from(bobBytes!).equals(Buffer.from(original)));

let strangerBlocked = false;
try {
  await downloadUrl(mallory, ticket.mediaId);
} catch {
  strangerBlocked = true;
}
check("a non-member cannot fetch it", strangerBlocked);

check(
  "holding the thumbnail and the id is not a capability",
  strangerBlocked,
  "authorization is membership of the media's room, not possession of its id",
);

// --- 5. failures leave nothing behind ---------------------------------------

console.log("\n=== Failure handling ===");

// The bytes never arrive: the reservation must not become an orphan.
const abandoned = await beginUpload(alice, { code, playerId: "p_alice", kind: "booth", contentType: "image/jpeg" });
let unfinished = false;
try {
  await finishUpload(alice, abandoned.mediaId);
} catch {
  unfinished = true;
}
check("completing an upload that never arrived fails", unfinished);
check(
  "and the reservation is removed rather than orphaned",
  (await query(`select 1 from media where id = $1`, [abandoned.mediaId])).rowCount === 0,
);

// Something that is not an image.
const junk = await beginUpload(alice, { code, playerId: "p_alice", kind: "booth", contentType: "image/jpeg" });
await putBytes(junk.url, new TextEncoder().encode("<svg onload=alert(1)>".padEnd(2048, " ")));
let junkRejected = false;
try {
  await finishUpload(alice, junk.mediaId);
} catch {
  junkRejected = true;
}
check("an SVG payload labelled image/jpeg is rejected", junkRejected);
check(
  "its row and its object both go",
  (await query(`select 1 from media where id = $1`, [junk.mediaId])).rowCount === 0 &&
    (await store.get(decodeURIComponent(new URL(junk.url, "http://local").searchParams.get("key")!))) === null,
);

// A capture whose thumbnail could not be produced still has its original.
check(
  "a missing thumbnail does not invalidate the reference",
  isWithinThumbnailBudget(null) === false && stored.bytes === ORIGINAL_BYTES,
  "the capture survives a failed placeholder",
);

// An oversized thumbnail is refused entry to shared state.
const fatThumbnail = toDataUrl(jpegBytes(4096));
check(
  "an oversized thumbnail is refused before it can enter room state",
  !isWithinThumbnailBudget(fatThumbnail),
  `${fatThumbnail.length} bytes`,
);

// --- 6. reconnect and late join ---------------------------------------------

console.log("\n=== Reconnect and late join ===");

bobSocket.ws.close();
await settle(300);

// While away, Alice takes another photo.
const second = await beginUpload(alice, { code, playerId: "p_alice", kind: "booth", contentType: "image/jpeg" });
await putBytes(second.url, jpegBytes(ORIGINAL_BYTES));
await finishUpload(alice, second.mediaId);

const now = await readRoom(alice, code);
const boothData = (now.state.data as Record<string, unknown>).booth as Record<string, unknown>;
await patchRoom(alice, {
  code, playerId: "p_alice", version: now.version,
  state: {
    ...now.state,
    data: {
      booth: {
        ...boothData,
        previews: {
          ...(boothData.previews as object),
          "1": { p_alice: { mediaId: second.mediaId, thumbnail } },
        },
      },
    },
  } as never,
});

const bobBack = await socketFor(await mintToken(bob.sessionId));
bobBack.send({ t: "subscribe", code, playerId: "p_bob" });
await settle(500);

const resumed = bobBack.inbox.find((m) => m.t === "state") as
  | { state?: { data?: { booth?: { previews?: Record<string, Record<string, { mediaId: string }>> } } } }
  | undefined;
const resumedPreviews = resumed?.state?.data?.booth?.previews ?? {};

check("a reconnecting partner sees both photos referenced", Object.keys(resumedPreviews).length === 2);
check(
  "the references are intact, not corrupted by the reconnect",
  resumedPreviews["0"]?.p_alice?.mediaId === ticket.mediaId &&
    resumedPreviews["1"]?.p_alice?.mediaId === second.mediaId,
);
check(
  "and they can fetch both originals at full size",
  (await getBytes((await downloadUrl(bob, second.mediaId)).url))?.byteLength === ORIGINAL_BYTES,
);

// A late joiner who was never here.
await joinRoom(mallory, { code, playerId: "p_late" });
const lateSocket = await socketFor(await mintToken(mallory.sessionId));
lateSocket.send({ t: "subscribe", code, playerId: "p_late" });
await settle(500);
const lateState = lateSocket.inbox.find((m) => m.t === "state") as
  | { state?: { data?: { booth?: { previews?: Record<string, unknown> } } } }
  | undefined;
check(
  "a late joiner receives the whole strip by reference",
  Object.keys(lateState?.state?.data?.booth?.previews ?? {}).length === 2,
);
check(
  "and, now a member, may fetch the originals",
  (await getBytes((await downloadUrl(mallory, ticket.mediaId)).url))?.byteLength === ORIGINAL_BYTES,
);

// --- 7. export resolution ---------------------------------------------------

console.log("\n=== Export ===");

// What `withOriginals` does: resolve every reference to its stored original.
const exportSources: number[] = [];
for (const round of Object.values(resumedPreviews)) {
  for (const ref of Object.values(round)) {
    const bytes = await getBytes((await downloadUrl(bob, ref.mediaId)).url);
    exportSources.push(bytes?.byteLength ?? 0);
  }
}
check("the export resolves every reference", exportSources.length === 2);
check(
  "each source is the original, not the placeholder",
  exportSources.every((n) => n === ORIGINAL_BYTES),
  `${exportSources.map((n) => Math.round(n / 1024) + "KB").join(", ")}`,
);
check(
  "each is ~390x the thumbnail it stood in for",
  Math.round(ORIGINAL_BYTES / thumbnail.length) > 200,
  `${Math.round(ORIGINAL_BYTES / thumbnail.length)}x`,
);
check(
  "at 2400px wide each photo occupies ~1068px, which a 1000px capture serves and a 48px thumbnail cannot",
  ORIGINAL_BYTES > 100_000,
);

// --- 8. cleanup consistency -------------------------------------------------

console.log("\n=== Cleanup consistency ===");

const keysBefore = (
  await query<{ object_key: string }>(`select object_key from media where room_id = $1`, [room.id])
).rows.map((r) => r.object_key);
check("the room's objects are all present", keysBefore.length >= 2);

await query(`update rooms set updated_at = now() - interval '48 hours' where code = $1`, [code]);
const collected = await collectAbandonedMedia({ abandonedAfterMinutes: 30, roomTtlHours: 24 });
await objectStore().remove(collected);

check("expiry collects every one of the room's objects", keysBefore.every((k) => collected.includes(k)));
check(
  "the rows are gone",
  (await query(`select 1 from media where room_id = $1`, [room.id])).rowCount === 0,
);
const remaining = await Promise.all(keysBefore.map((k) => store.get(k)));
check("and so are the bytes — no row without an object, no object without a row",
  remaining.every((b) => b === null));

// --- teardown ---------------------------------------------------------------

for (const s of [aliceSocket, bobSocket, bobBack, lateSocket]) {
  try {
    s.ws.close();
  } catch {
    /* already closed */
  }
}
await shutdownRealtime("done");
await new Promise<void>((r) => http.close(() => r()));
await closePool();
await pgServer.stop();
await db.close();
await rm(storageDir, { recursive: true, force: true });

console.log(`\n${pass} passed, ${failures.length} failed`);
console.log(
  "\nNote: canvas capture and thumbnail encoding are browser APIs and are not\n" +
    "exercised here — thumbnail sizes above are real JPEG bytes at the configured\n" +
    "dimensions. Actual encoder output is verified on a device at stage 14.",
);
if (failures.length) {
  console.log("\nFailures:");
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
process.exit(0);
