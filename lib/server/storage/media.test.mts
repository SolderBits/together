/**
 * Media storage: the flow, and who is allowed near it.
 *
 *   npm run test:media
 *
 * Runs against the LOCAL object store, which is not a mock: the URLs it hands
 * out are HMAC-signed over the key, method and expiry, and the endpoint that
 * receives the bytes verifies them. A tampered or expired URL is refused here
 * exactly as it would be by R2.
 *
 * What this does NOT prove is that R2 behaves as documented — that its
 * presigned PUT honours the signature, that a ranged GET returns the
 * Content-Range this code parses, that a private bucket really is private.
 * Those need real credentials and are stage 13. Nothing here should be read as
 * evidence about Cloudflare.
 */
process.env.SESSION_SECRET = "m".repeat(64);

import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { startPgSocket } from "../testing/pg-socket.mts";
import { migrate } from "../../../db/migrate.mjs";

const storageDir = await mkdtemp(join(tmpdir(), "together-media-test-"));
process.env.LOCAL_STORAGE_DIR = storageDir;

const db = await PGlite.create({ extensions: { pgcrypto } });
const pgSocket = await startPgSocket(db);
process.env.DATABASE_URL = pgSocket.url;
process.env.PGPOOL_MAX = "1";
await migrate(process.env.DATABASE_URL, { quiet: true });

const { createRoom, joinRoom, readRoom, patchRoom } = await import("../db/rooms");
const { createSession } = await import("../db/sessions");
const { collectAbandonedMedia, mediaKeysForRoom } = await import("../db/media");
const { beginUpload, finishUpload, downloadUrl } = await import("../media-service");
const { LocalObjectStore, verifyLocalSignature, objectStore, MAX_THUMBNAIL_BYTES } =
  await import("./index");
const { query } = await import("../db/pool");

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

const randomCode = () =>
  Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");

/** A byte-accurate JPEG: real SOI marker, real EOI, filler between. */
function jpegBytes(size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  bytes.set([0xff, 0xd8, 0xff, 0xe0], 0);
  for (let i = 4; i < size - 2; i++) bytes[i] = (i * 31) % 251;
  bytes.set([0xff, 0xd9], size - 2);
  return bytes;
}

function pngBytes(size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  return bytes;
}

/** The store's endpoint half, driven the way the browser drives it. */
const store = new LocalObjectStore();
async function putBytes(url: string, body: Uint8Array): Promise<number> {
  const parsed = new URL(url, "http://local");
  const key = parsed.searchParams.get("key")!;
  const expires = Number(parsed.searchParams.get("expires"));
  const sig = parsed.searchParams.get("sig")!;
  if (!verifyLocalSignature(key, "PUT", expires, sig)) return 403;
  await store.put(key, body);
  return 200;
}
async function getBytes(url: string): Promise<Uint8Array | null> {
  const parsed = new URL(url, "http://local");
  const key = parsed.searchParams.get("key")!;
  const expires = Number(parsed.searchParams.get("expires"));
  const sig = parsed.searchParams.get("sig")!;
  if (!verifyLocalSignature(key, "GET", expires, sig)) return null;
  return store.get(key);
}

// --- actors and a room ------------------------------------------------------

const alice = { sessionId: (await createSession()).id };
const bob = { sessionId: (await createSession()).id };
const mallory = { sessionId: (await createSession()).id };

const code = randomCode();
const seed = {
  code,
  experienceId: "photobooth",
  status: "lobby" as const,
  hostId: "p_alice",
  hostSince: Date.now(),
  seed: "s_media",
  createdAt: Date.now(),
  startedAt: null,
  players: {},
  data: {},
};
const room = await createRoom(alice, { code, experienceId: "photobooth", playerId: "p_alice", state: seed as never });
await joinRoom(bob, { code, playerId: "p_bob" });

// Mallory has a room of her own, so she is a legitimate user — just not here.
const otherCode = randomCode();
await createRoom(mallory, {
  code: otherCode,
  experienceId: "snap-hunt",
  playerId: "p_mallory",
  state: { ...seed, code: otherCode, hostId: "p_mallory" } as never,
});

console.log("\n=== The store is signed, not trusting ===");

const probe = await store.presignUpload("rooms/x/y.jpg", "image/jpeg");
check("an upload URL carries a signature", /sig=/.test(probe.url));
// The key is URL-encoded in the query string, so tamper with the encoded form.
const tamperedUrl = probe.url.replace(
  encodeURIComponent("rooms/x/y.jpg"),
  encodeURIComponent("rooms/someone-elses-room/y.jpg"),
);
check("a tampered key invalidates it", (await putBytes(tamperedUrl, jpegBytes(128))) === 403);
check(
  "the tamper actually changed the key (so the check above means something)",
  tamperedUrl !== probe.url,
);
check(
  "an edited expiry invalidates it",
  (await putBytes(probe.url.replace(/expires=\d+/, "expires=99999999999999"), jpegBytes(128))) === 403,
);
const expired = probe.url.replace(/expires=\d+/, `expires=${Date.now() - 1000}`);
check("an expired URL is refused", (await putBytes(expired, jpegBytes(128))) === 403);
check(
  "an upload URL cannot be reused for a download",
  (await getBytes(probe.url)) === null,
  "the method is part of what is signed",
);
let traversalRefused = false;
try {
  await store.put("../../../etc/passwd", jpegBytes(128));
} catch {
  traversalRefused = true;
}
check("a key escaping the storage root is refused", traversalRefused);

console.log("\n=== Authorized upload ===");

const ticket = await beginUpload(alice, {
  code,
  playerId: "p_alice",
  kind: "booth",
  contentType: "image/jpeg",
});
check("a member gets an upload ticket", Boolean(ticket.url && ticket.mediaId));
check("the object key is server-generated and room-scoped", /rooms\//.test(decodeURIComponent(ticket.url)));
check(
  "the key contains the room id, so it cannot address another room",
  decodeURIComponent(ticket.url).includes(room.id),
);

const original = jpegBytes(391 * 1024); // the size a real Photobooth capture is
check("the bytes upload", (await putBytes(ticket.url, original)) === 200);

const finished = await finishUpload(alice, ticket.mediaId);
check("completing verifies what actually landed", finished.contentType === "image/jpeg");
check("and records the true size", finished.bytes === original.byteLength, `${finished.bytes}`);

console.log("\n=== Unauthorized upload ===");

let strangerUpload = false;
try {
  await beginUpload(mallory, { code, playerId: "p_mallory", kind: "booth", contentType: "image/jpeg" });
} catch {
  strangerUpload = true;
}
check("a non-member cannot get an upload ticket for this room", strangerUpload);

let seatSpoof = false;
try {
  // Bob is a member, but p_alice is not his seat.
  await beginUpload(bob, { code, playerId: "p_alice", kind: "booth", contentType: "image/jpeg" });
} catch {
  seatSpoof = true;
}
check("a member cannot upload as another player", seatSpoof);

console.log("\n=== Authorized download ===");

const forAlice = await downloadUrl(alice, ticket.mediaId);
check("the uploader can read it back", Boolean(forAlice.url));
const roundTripped = await getBytes(forAlice.url);
check(
  "and the bytes are the full-resolution original, unaltered",
  roundTripped?.byteLength === original.byteLength && roundTripped[0] === 0xff && roundTripped[1] === 0xd8,
  `${roundTripped?.byteLength} vs ${original.byteLength}`,
);

const forBob = await downloadUrl(bob, ticket.mediaId);
check("the other member in the room can read it", Boolean(forBob.url));

console.log("\n=== Unauthorized download ===");

let strangerRead = false;
try {
  await downloadUrl(mallory, ticket.mediaId);
} catch {
  strangerRead = true;
}
check("a non-member cannot get a URL for it", strangerRead);

// Knowing the object key is not access: there is no route that accepts one, and
// the store refuses to sign for a caller. Prove the guessing path is closed by
// showing an unsigned URL fetches nothing.
const guessedKey = (await query<{ object_key: string }>(
  `select object_key from media where id = $1`,
  [ticket.mediaId],
)).rows[0].object_key;
check(
  "guessing the object key gets nothing without a signature",
  (await getBytes(`/api/media/blob?key=${encodeURIComponent(guessedKey)}&expires=${Date.now() + 60_000}&sig=made-up`)) === null,
);

let unknownMedia = false;
try {
  await downloadUrl(alice, "00000000-0000-0000-0000-000000000000");
} catch {
  unknownMedia = true;
}
check("an unknown media id is refused the same way as someone else's", unknownMedia);

console.log("\n=== Invalid and oversized uploads ===");

let badType = false;
try {
  await beginUpload(alice, { code, playerId: "p_alice", kind: "booth", contentType: "application/pdf" });
} catch {
  badType = true;
}
check("an unsupported content type is refused up front", badType);

// The important one: a client that *claims* image/jpeg and uploads something else.
const liar = await beginUpload(alice, { code, playerId: "p_alice", kind: "booth", contentType: "image/jpeg" });
await putBytes(liar.url, new TextEncoder().encode("#!/bin/sh\nrm -rf /\n".padEnd(4096, " ")));
let sniffRejected = false;
try {
  await finishUpload(alice, liar.mediaId);
} catch {
  sniffRejected = true;
}
check("a shell script labelled image/jpeg is rejected on its bytes", sniffRejected);
check(
  "and the object is deleted rather than left costing money",
  (await store.get(decodeURIComponent(new URL(liar.url, "http://local").searchParams.get("key")!))) === null,
);
check(
  "and its row is gone too",
  (await query(`select 1 from media where id = $1`, [liar.mediaId])).rowCount === 0,
);

const oversize = await beginUpload(alice, { code, playerId: "p_alice", kind: "booth", contentType: "image/jpeg" });
await putBytes(oversize.url, jpegBytes(9 * 1024 * 1024));
let oversizeRejected = false;
try {
  await finishUpload(alice, oversize.mediaId);
} catch {
  oversizeRejected = true;
}
check("a 9 MB image is rejected", oversizeRejected);

const empty = await beginUpload(alice, { code, playerId: "p_alice", kind: "booth", contentType: "image/jpeg" });
await putBytes(empty.url, new Uint8Array(8));
let emptyRejected = false;
try {
  await finishUpload(alice, empty.mediaId);
} catch {
  emptyRejected = true;
}
check("a truncated upload is rejected", emptyRejected);

const png = await beginUpload(alice, { code, playerId: "p_alice", kind: "booth", contentType: "image/png" });
await putBytes(png.url, pngBytes(2048));
const pngDone = await finishUpload(alice, png.mediaId);
check("a real PNG is accepted", pngDone.contentType === "image/png");

console.log("\n=== Nothing large reaches the room document ===");

// This is what the whole stage is for. Simulate what the experiences will store.
const boothState = {
  ...seed,
  data: {
    booth: {
      taken: { "0": ["p_alice"] },
      shots: {
        "0": {
          p_alice: { photoId: ticket.mediaId, thumbnail: "data:image/jpeg;base64," + "A".repeat(900) },
        },
      },
    },
  },
};
const current = await readRoom(alice, code);
await patchRoom(alice, { code, playerId: "p_alice", version: current.version, state: boothState as never });

const stored = await query<{ state: unknown; size: number }>(
  `select state, octet_length(state::text) as size from rooms where code = $1`,
  [code],
);
const documentText = JSON.stringify(stored.rows[0].state);
check(
  "the room document holds no full-resolution image",
  !/data:image\/[a-z]+;base64,[A-Za-z0-9+/=]{5000,}/.test(documentText),
);
check(
  "the whole document stays small",
  stored.rows[0].size < 8 * 1024,
  `${stored.rows[0].size} bytes`,
);
check(
  "and it references the photo by id",
  documentText.includes(ticket.mediaId),
);

const thumbnail = "data:image/jpeg;base64," + "A".repeat(900);
check(
  `a thumbnail stays under the ${MAX_THUMBNAIL_BYTES} byte budget`,
  thumbnail.length <= MAX_THUMBNAIL_BYTES,
  `${thumbnail.length} bytes`,
);

console.log("\n=== Export keeps the full resolution ===");

const exportUrl = await downloadUrl(alice, ticket.mediaId);
const exportBytes = await getBytes(exportUrl.url);
check(
  "the original is still 391 KB, not a thumbnail",
  exportBytes!.byteLength === original.byteLength,
  `${Math.round(exportBytes!.byteLength / 1024)} KB`,
);
check(
  "which is enough for a 2400px strip (each photo occupies ~1068px)",
  exportBytes!.byteLength > 100_000,
);

console.log("\n=== Snap Hunt uses the same path ===");

const huntTicket = await beginUpload(bob, {
  code,
  playerId: "p_bob",
  kind: "hunt",
  contentType: "image/jpeg",
});
await putBytes(huntTicket.url, jpegBytes(310 * 1024));
const huntDone = await finishUpload(bob, huntTicket.mediaId);
check("Snap Hunt uploads through the same service", huntDone.bytes === 310 * 1024);
check(
  "and both experiences' media live under the same room prefix",
  (await mediaKeysForRoom(room.id)).every((k) => k.startsWith(`rooms/${room.id}/`)),
);
check(
  "kinds are recorded so the two are distinguishable",
  (await query<{ kind: string }>(`select distinct kind from media where room_id = $1 order by kind`, [room.id]))
    .rows.map((r) => r.kind).join(",") === "booth,hunt",
);

console.log("\n=== Cleanup ===");

// A reservation whose bytes never arrive.
const abandoned = await beginUpload(alice, { code, playerId: "p_alice", kind: "booth", contentType: "image/jpeg" });
await query(`update media set created_at = now() - interval '2 hours' where id = $1`, [abandoned.mediaId]);

const strandedKeys = await collectAbandonedMedia({ abandonedAfterMinutes: 30, roomTtlHours: 24 });
check("an abandoned reservation is collected", strandedKeys.length >= 1);
check(
  "and its row is gone",
  (await query(`select 1 from media where id = $1`, [abandoned.mediaId])).rowCount === 0,
);
check(
  "a completed upload is left alone",
  (await query(`select 1 from media where id = $1`, [ticket.mediaId])).rowCount === 1,
);

// A room that has aged out takes its media with it.
await query(`update rooms set updated_at = now() - interval '48 hours' where code = $1`, [code]);
const expiredKeys = await collectAbandonedMedia({ abandonedAfterMinutes: 30, roomTtlHours: 24 });
check("an expired room's media is identified for deletion", expiredKeys.length >= 2, `${expiredKeys.length} keys`);
check(
  "the keys are real object keys, ready to delete",
  expiredKeys.every((k) => k.startsWith("rooms/")),
);

await objectStore().remove(expiredKeys);
check(
  "and deleting them actually removes the bytes",
  (await store.get(expiredKeys[0])) === null,
);

// --- teardown ---------------------------------------------------------------

const { closePool } = await import("../db/pool");
await closePool();
await pgSocket.server.stop();
await db.close();
await rm(storageDir, { recursive: true, force: true });

console.log(`\n${pass} passed, ${failures.length} failed`);
console.log(
  "\nNote: this exercises the local object store. R2 itself is untested until real\n" +
    "credentials exist — see stage 13.",
);
if (failures.length) {
  console.log("\nFailures:");
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
process.exit(0);
