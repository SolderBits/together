import "server-only";
import type { IncomingMessage, Server as HttpServer } from "node:http";
import type { Duplex } from "node:stream";
import { randomUUID } from "node:crypto";
import { WebSocketServer, type WebSocket } from "ws";
import type { RoomState } from "@/lib/rooms/types";
import { sessionFromCookieHeader } from "@/lib/server/session";
import { AuthzError, type SessionContext } from "@/lib/server/db/authz";
import {
  markOffline,
  patchRoom,
  pruneExpired,
  readPresence,
  readRoom,
  touchPresence,
} from "@/lib/server/db/rooms";
import {
  MAX_MESSAGE_BYTES,
  RateLimiter,
  parseClientMessage,
  type ServerMessage,
} from "./protocol";

/**
 * The realtime server.
 *
 * Replaces Supabase Realtime. The shape of what it does is the same — a shared
 * room document plus an event channel — but where Supabase enforced access with
 * RLS underneath the channel, here it is enforced here, explicitly, before
 * anything is sent.
 *
 * The one rule everything else follows from: **the client is not trusted for
 * identity, membership, host status, seat, version, or time.** It may *name*
 * which of its own seats it is speaking as; the server checks the claim against
 * `room_members` on the way in. Everything else the server reads for itself.
 */

const HEARTBEAT_MS = 30_000;
const PRUNE_INTERVAL_MS = 10 * 60 * 1000;

interface Connection {
  id: string;
  socket: WebSocket;
  ctx: SessionContext;
  limiter: RateLimiter;
  /** Rooms this connection has been *authorized* for, and the seat it holds in each. */
  rooms: Map<string, { roomId: string; playerId: string }>;
  alive: boolean;
}

/** code → the connections authorized for it. The only fan-out list there is. */
const subscribers = new Map<string, Set<Connection>>();
/** `${code}:${playerId}` → the connection currently holding that seat. */
const seats = new Map<string, Connection>();

let wss: WebSocketServer | null = null;
let heartbeat: ReturnType<typeof setInterval> | null = null;
let pruner: ReturnType<typeof setInterval> | null = null;
let shuttingDown = false;

function send(socket: WebSocket, message: ServerMessage) {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
}

function seatKey(code: string, playerId: string) {
  return `${code}:${playerId}`;
}

/** Everyone authorized for this room, optionally excluding one connection. */
function fanout(code: string, message: ServerMessage, except?: Connection) {
  const set = subscribers.get(code);
  if (!set) return;
  const frame = JSON.stringify(message);
  for (const conn of set) {
    if (conn === except) continue;
    if (conn.socket.readyState === conn.socket.OPEN) conn.socket.send(frame);
  }
}

/**
 * The room document as clients see it: the stored state with the live roster
 * merged in.
 *
 * Presence is not kept in `rooms.state` — that is the whole point of splitting
 * it out — but `RoomState.players` is what every experience reads, so it is
 * composed here on the way out. The transport interface is unchanged and no
 * experience needs to know.
 */
async function composeState(
  ctx: SessionContext,
  code: string,
): Promise<{ state: RoomState; version: number }> {
  const [room, players] = await Promise.all([readRoom(ctx, code), readPresence(ctx, code)]);
  return { state: { ...room.state, players }, version: room.version };
}

async function pushState(conn: Connection, code: string) {
  const { state, version } = await composeState(conn.ctx, code);
  send(conn.socket, { t: "state", code, version, state: state as unknown as Record<string, unknown> });
}

/** Re-sends the room to everyone in it. Used after any accepted change. */
async function pushStateToRoom(code: string) {
  const set = subscribers.get(code);
  if (!set?.size) return;
  // One read per connection, because each is scoped by its own session — the
  // authorization check is not something to skip for a cache.
  await Promise.all(
    [...set].map(async (conn) => {
      try {
        await pushState(conn, code);
      } catch {
        /* the room went away, or they lost access; their next action will say so */
      }
    }),
  );
}

// --- message handling -------------------------------------------------------

async function onSubscribe(conn: Connection, code: string, playerId: string) {
  // Authorization happens here, before a single byte of room state is sent.
  // `readRoom` throws unless this session holds a seat; `assertRoomSeatByCode`
  // inside `touchPresence` throws unless it holds *this* seat.
  try {
    await touchPresence(conn.ctx, { code, playerId });
  } catch (error) {
    const reason = error instanceof AuthzError ? error.message : "Not allowed";
    send(conn.socket, { t: "denied", code, reason });
    return;
  }

  const room = await readRoom(conn.ctx, code);

  // One socket per seat. A second connection for the same seat — a reconnect
  // whose predecessor has not timed out, or a duplicate tab — supersedes the
  // first, so the room never shows a ghost.
  const key = seatKey(code, playerId);
  const previous = seats.get(key);
  if (previous && previous !== conn) {
    detach(previous, code);
    send(previous.socket, { t: "denied", code, reason: "This seat was taken over by a newer connection" });
  }
  seats.set(key, conn);

  conn.rooms.set(code, { roomId: room.id, playerId });
  let set = subscribers.get(code);
  if (!set) subscribers.set(code, (set = new Set()));
  set.add(conn);

  // Late join and reconnect are the same path: whoever subscribes gets the
  // current document immediately, then every subsequent change.
  await pushState(conn, code);
  // And everyone already here learns the roster changed.
  await pushStateToRoom(code);
}

async function onPatch(
  conn: Connection,
  code: string,
  playerId: string,
  version: number,
  state: Record<string, unknown>,
) {
  const membership = conn.rooms.get(code);
  if (!membership || membership.playerId !== playerId) {
    send(conn.socket, { t: "denied", code, reason: "Subscribe to that room first" });
    return;
  }

  // `players` is presence and belongs to `room_players`. A client that writes it
  // into the document is either out of date or trying to forge a roster; either
  // way it is dropped rather than stored.
  const { players: _ignored, ...withoutPresence } = state as { players?: unknown };
  void _ignored;

  const outcome = await patchRoom(conn.ctx, {
    code,
    playerId,
    version,
    state: withoutPresence as unknown as RoomState,
  });

  if (!outcome.ok) {
    const players = await readPresence(conn.ctx, code);
    send(conn.socket, {
      t: "conflict",
      code,
      version: outcome.version,
      state: { ...outcome.state, players } as unknown as Record<string, unknown>,
    });
    return;
  }

  await pushStateToRoom(code);
}

async function onEvent(
  conn: Connection,
  code: string,
  playerId: string,
  eventType: string,
  payload: unknown,
) {
  const membership = conn.rooms.get(code);
  if (!membership || membership.playerId !== playerId) {
    send(conn.socket, { t: "denied", code, reason: "Subscribe to that room first" });
    return;
  }

  // `from` and `id` are the server's, not the sender's: an event cannot claim to
  // come from another player, and the id clients dedupe on cannot be forged to
  // suppress somebody else's message.
  fanout(
    code,
    { t: "event", code, eventType, payload, from: playerId, id: randomUUID() },
    conn,
  );
}

async function onPresence(
  conn: Connection,
  code: string,
  playerId: string,
  fields: { name?: string; emoji?: string; ready?: boolean },
) {
  const membership = conn.rooms.get(code);
  if (!membership || membership.playerId !== playerId) {
    send(conn.socket, { t: "denied", code, reason: "Subscribe to that room first" });
    return;
  }

  // A heartbeat writes one small row. It does not touch `rooms.state`, which is
  // what stopped every beat from re-serialising an entire Draw Together round.
  await touchPresence(conn.ctx, { code, playerId, ...fields });

  // Only a change in readiness is worth waking the room for; a plain beat is not.
  if (fields.ready !== undefined) await pushStateToRoom(code);
}

// --- lifecycle --------------------------------------------------------------

function detach(conn: Connection, code: string) {
  const membership = conn.rooms.get(code);
  conn.rooms.delete(code);
  subscribers.get(code)?.delete(conn);
  if (!subscribers.get(code)?.size) subscribers.delete(code);
  if (membership && seats.get(seatKey(code, membership.playerId)) === conn) {
    seats.delete(seatKey(code, membership.playerId));
  }
  return membership;
}

async function onClose(conn: Connection) {
  for (const code of [...conn.rooms.keys()]) {
    const membership = detach(conn, code);
    if (!membership) continue;
    try {
      // Zeroing the heartbeat is how a deliberate exit is signalled; the room
      // sees them gone at once rather than waiting out the presence window.
      await markOffline(membership.roomId, membership.playerId);
      await pushStateToRoom(code);
    } catch {
      /* the room may already be gone */
    }
  }
}

async function handleMessage(conn: Connection, raw: Buffer) {
  if (!conn.limiter.take()) {
    send(conn.socket, { t: "error", reason: "Slow down" });
    conn.socket.close(1008, "rate limit");
    return;
  }

  const parsed = parseClientMessage(raw);
  if (!parsed.ok) {
    send(conn.socket, { t: "error", reason: parsed.reason });
    if (parsed.fatal) conn.socket.close(1009, "bad frame");
    return;
  }

  const message = parsed.message;
  try {
    switch (message.t) {
      case "ping":
        send(conn.socket, { t: "pong" });
        break;
      case "subscribe":
        await onSubscribe(conn, message.code, message.playerId);
        break;
      case "unsubscribe":
        detach(conn, message.code);
        break;
      case "patch":
        await onPatch(conn, message.code, message.playerId, message.version, message.state);
        break;
      case "event":
        await onEvent(conn, message.code, message.playerId, message.eventType, message.payload);
        break;
      case "presence":
        await onPresence(conn, message.code, message.playerId, {
          name: message.name,
          emoji: message.emoji,
          ready: message.ready,
        });
        break;
    }
  } catch (error) {
    if (error instanceof AuthzError) {
      send(conn.socket, { t: "denied", reason: error.message });
      return;
    }
    // Never let an internal message reach a client; it can name a table, a
    // constraint or a path.
    console.error("[ws] handler failed", { type: message.t, error });
    send(conn.socket, { t: "error", reason: "Something went wrong" });
  }
}

/**
 * Mounts the realtime server on an existing HTTP server.
 *
 * `noServer` rather than `{ server }` so the upgrade is authenticated *before*
 * the socket exists: an unauthenticated request is answered with 401 and never
 * becomes a WebSocket at all.
 */
export function attachRealtime(server: HttpServer, path = "/ws") {
  if (wss) return wss;

  wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });

  server.on("upgrade", (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    let url: URL;
    try {
      url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    } catch {
      socket.destroy();
      return;
    }
    if (url.pathname !== path) return; // not ours; leave it for anything else

    if (shuttingDown) {
      socket.write("HTTP/1.1 503 Service Unavailable\r\n\r\n");
      socket.destroy();
      return;
    }

    // The browser cannot set headers on a WebSocket, which is exactly why the
    // session is a cookie: it rides the upgrade automatically and the page's own
    // JavaScript cannot read or forge it.
    void sessionFromCookieHeader(request.headers.cookie)
      .then((ctx) => {
        if (!ctx) {
          socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
          socket.destroy();
          return;
        }
        wss!.handleUpgrade(request, socket, head, (ws) => {
          const conn: Connection = {
            id: randomUUID(),
            socket: ws,
            ctx,
            limiter: new RateLimiter(),
            rooms: new Map(),
            alive: true,
          };

          ws.on("pong", () => {
            conn.alive = true;
          });
          ws.on("message", (data) => {
            void handleMessage(conn, Buffer.isBuffer(data) ? data : Buffer.from(String(data)));
          });
          ws.on("close", () => void onClose(conn));
          ws.on("error", () => void onClose(conn));

          send(ws, { t: "hello", sessionId: ctx.sessionId });
        });
      })
      .catch(() => {
        socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
        socket.destroy();
      });
  });

  // Drops sockets that have stopped answering — a half-open TCP connection
  // looks alive to the OS and would otherwise hold a seat indefinitely.
  heartbeat = setInterval(() => {
    for (const client of wss!.clients) {
      const ws = client as WebSocket;
      if (ws.readyState !== ws.OPEN) continue;
      ws.ping();
    }
  }, HEARTBEAT_MS);

  pruner = setInterval(() => {
    void pruneExpired().catch((error) => console.error("[ws] prune failed", error));
  }, PRUNE_INTERVAL_MS);

  return wss;
}

/**
 * Stops cleanly on SIGTERM, which is how Railway ends a deployment.
 *
 * Clients are told before the socket closes so they reconnect to the new
 * instance rather than sitting on a dead one waiting for a timeout.
 */
export async function shutdownRealtime(reason = "Server restarting") {
  shuttingDown = true;
  if (heartbeat) clearInterval(heartbeat);
  if (pruner) clearInterval(pruner);

  const server = wss;
  if (!server) return;

  for (const client of server.clients) {
    send(client as WebSocket, { t: "closing", reason });
  }
  // A moment for those frames to leave before the sockets go.
  await new Promise((r) => setTimeout(r, 150));
  for (const client of server.clients) (client as WebSocket).close(1001, "going away");

  await new Promise<void>((resolve) => server.close(() => resolve()));
  wss = null;
  subscribers.clear();
  seats.clear();
  shuttingDown = false;
}

/** Counters worth having when something looks wrong. */
export function realtimeStats() {
  return {
    connections: wss?.clients.size ?? 0,
    rooms: subscribers.size,
    seats: seats.size,
  };
}
