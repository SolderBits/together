"use client";

import type { RoomEvent, RoomState, RoomStatePatch } from "@/lib/rooms/types";
import { uid } from "@/lib/utils";
import { WriteQueue } from "./queue";
import { applyPatch, type PresenceUpdate, type RoomTransport } from "./transport";
import { setConnectionState } from "./connection-status";

/**
 * The Railway transport.
 *
 * Same contract as the local and Supabase ones — `RoomTransport`, unchanged —
 * so none of the twenty experiences know which of the three they are talking
 * to. What differs is only where the room document lives and who is allowed
 * near it.
 *
 * Two channels, for two different reasons:
 *
 *   HTTP  once, to create or join. Membership must exist in the database before
 *         a socket may subscribe, and an upgrade handshake is a poor place to
 *         do a write.
 *   WS    everything after that.
 *
 * Nothing secret reaches this file. The session is an HttpOnly cookie the page
 * cannot read and this code never touches — it rides the fetch and the upgrade
 * automatically, which is the whole reason it is a cookie rather than a header.
 */

const RECONNECT_BASE_MS = 400;
const RECONNECT_MAX_MS = 8_000;
const REQUEST_TIMEOUT_MS = 12_000;
const MAX_PATCH_ATTEMPTS = 6;

type ServerFrame = {
  t: string;
  code?: string;
  state?: RoomState;
  version?: number;
  eventType?: string;
  payload?: unknown;
  from?: string;
  id?: string;
  reason?: string;
  sessionId?: string;
  rid?: string;
};

export interface RailwayTransportOptions {
  /** The seat this browser holds. Named by the client, verified by the server. */
  playerId: string;
  wsUrl: string;
  /** Injected in tests; the browser's own in production. */
  WebSocketImpl?: typeof WebSocket;
  fetchImpl?: typeof fetch;
  /** Base for the HTTP calls. Same-origin in the browser. */
  origin?: string;
}

/**
 * One session per browser, however many transports ask for one at once.
 *
 * Establishing a guest identity is a write, and it is idempotent only if the
 * caller already has the cookie. Two requests that start before either has
 * finished both look like a first visit, so both mint a session — and the
 * browser keeps whichever `Set-Cookie` landed last, which may not be the one
 * that now owns the seat in the room the other request created.
 *
 * That is not hypothetical: React's development double-mount reproduces it on
 * every first room, and a slow first paint would reproduce it in production.
 * Sharing the in-flight promise makes concurrent callers wait for one answer.
 */
let sessionInFlight: Promise<void> | null = null;

async function ensureSession(http: typeof fetch, origin: string): Promise<void> {
  sessionInFlight ??= (async () => {
    try {
      const response = await http(`${origin}/api/session`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error(`session ${response.status}`);
    } finally {
      // Cleared either way: a failure should be retried, not cached.
      sessionInFlight = null;
    }
  })();

  return sessionInFlight;
}

/** Only for tests, which run several browsers in one process. */
export function resetSessionState() {
  sessionInFlight = null;
}

export class RailwayConnectionError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "RailwayConnectionError";
  }
}

export class RailwayRoomTransport implements RoomTransport {
  readonly kind = "railway" as const;
  readonly code: string;

  private readonly playerId: string;
  private readonly wsUrl: string;
  private readonly WS: typeof WebSocket;
  private readonly http: typeof fetch;
  private readonly origin: string;

  private socket: WebSocket | null = null;
  private stateHandlers = new Set<(s: RoomState) => void>();
  private eventHandlers = new Set<(e: RoomEvent) => void>();
  private seenEvents: string[] = [];
  private queue = new WriteQueue();

  private lastKnown: RoomState | null = null;
  private version = 0;
  private subscribed = false;
  private closing = false;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private resubscribing = false;

  /** Resolvers waiting on a specific frame — how request/response is done over a socket. */
  private waiters = new Set<{ match: (f: ServerFrame) => boolean; resolve: (f: ServerFrame) => void }>();

  constructor(code: string, options: RailwayTransportOptions) {
    this.code = code.toUpperCase();
    this.playerId = options.playerId;
    this.wsUrl = options.wsUrl;
    this.origin = options.origin ?? "";
    const ws = options.WebSocketImpl ?? (globalThis as { WebSocket?: typeof WebSocket }).WebSocket;
    if (!ws) throw new RailwayConnectionError("This browser has no WebSocket support.");
    this.WS = ws;
    this.http = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  // --- connection -----------------------------------------------------------

  async connect(): Promise<void> {
    setConnectionState("connecting");
    // A guest identity must exist before the upgrade, because the upgrade is
    // where it is checked — and before any room call, because a room is owned
    // by a session.
    await ensureSession(this.http, this.origin).catch((error) => {
      setConnectionState("failed");
      throw new RailwayConnectionError("Could not reach the server to start a session.", error);
    });

    await this.openSocket();
  }

  private openSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      let socket: WebSocket;
      try {
        socket = new this.WS(this.wsUrl);
      } catch (error) {
        reject(new RailwayConnectionError("Could not open a realtime connection.", error));
        return;
      }

      const settle = (fn: () => void) => {
        socket.removeEventListener?.("open", onOpen);
        socket.removeEventListener?.("error", onOpenError);
        fn();
      };

      const onOpen = () => {
        this.socket = socket;
        this.reconnectAttempt = 0;
        setConnectionState("connected");
        // Exposed only outside production, so a dropped connection can be
        // reproduced from a console or a test without reaching into React.
        if (process.env.NODE_ENV !== "production") {
          (globalThis as { __togetherSocket?: WebSocket }).__togetherSocket = socket;
        }
        settle(resolve);
      };

      // An upgrade refused for want of a session closes before opening. That is
      // a configuration or session problem, and it is reported as one rather
      // than quietly leaving the room empty.
      const onOpenError = () => {
        setConnectionState("failed");
        settle(() =>
          reject(
            new RailwayConnectionError(
              "The realtime server refused the connection. Check NEXT_PUBLIC_WS_URL and that the session cookie is being set.",
            ),
          ),
        );
      };

      socket.addEventListener("open", onOpen);
      socket.addEventListener("error", onOpenError);

      // A permanent handler as well as the one that settles this promise.
      // Without it, a socket error *after* opening has no listener at all —
      // harmless in a browser, but in Node an unhandled "error" event takes the
      // process down. The close that follows drives the reconnect either way.
      socket.addEventListener("error", () => {
        /* observed so it is never unhandled; recovery happens on close */
      });
      socket.addEventListener("message", (event: MessageEvent) => this.receive(event.data));
      socket.addEventListener("close", () => this.onSocketClosed());
    });
  }

  private onSocketClosed() {
    this.socket = null;
    if (this.closing) {
      setConnectionState("local");
      return;
    }
    // Dropped, not closed by us. The session survives; the state is stale until
    // the next subscribe lands.
    setConnectionState("reconnecting");

    // Reconnect with backoff. The subscription is re-established on the new
    // socket, which is the same path a late joiner takes — so reconnecting and
    // joining late are one behaviour, not two.
    const delay = Math.min(
      RECONNECT_MAX_MS,
      RECONNECT_BASE_MS * 2 ** this.reconnectAttempt++,
    );
    this.reconnectTimer = setTimeout(() => {
      void this.openSocket()
        .then(() => (this.subscribed ? this.subscribe() : undefined))
        .catch(() => {
          /* the next close event schedules another attempt */
        });
    }, delay);
  }

  async disconnect(): Promise<void> {
    this.closing = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    try {
      this.socket?.close();
    } catch {
      /* already gone */
    }
    this.socket = null;
    this.stateHandlers.clear();
    this.eventHandlers.clear();
    this.waiters.clear();
  }

  // --- framing --------------------------------------------------------------

  private send(frame: Record<string, unknown>) {
    const socket = this.socket;
    if (!socket || socket.readyState !== 1) {
      throw new RailwayConnectionError("Not connected to the realtime server.");
    }
    socket.send(JSON.stringify(frame));
  }

  /**
   * Sends, then waits for the frame that answers *this* request.
   *
   * Correlated by id, not by type. Room state is broadcast to every member, so
   * "the next state frame" is not an answer to anything in particular — waiting
   * on the type alone means a patch can be told it succeeded by the broadcast
   * that another member's patch produced, while its own quietly conflicted.
   */
  private request(
    frame: Record<string, unknown>,
    match: (f: ServerFrame) => boolean,
    timeoutMs = REQUEST_TIMEOUT_MS,
  ): Promise<ServerFrame> {
    const rid = uid("q_").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
    return new Promise((resolve, reject) => {
      const waiter = {
        match: (f: ServerFrame) => f.rid === rid && match(f),
        resolve: (f: ServerFrame) => {
          clearTimeout(timer);
          this.waiters.delete(waiter);
          resolve(f);
        },
      };
      const timer = setTimeout(() => {
        this.waiters.delete(waiter);
        reject(new RailwayConnectionError("The realtime server did not answer in time."));
      }, timeoutMs);

      this.waiters.add(waiter);
      try {
        this.send({ ...frame, rid });
      } catch (error) {
        clearTimeout(timer);
        this.waiters.delete(waiter);
        reject(error);
      }
    });
  }

  private receive(raw: unknown) {
    let frame: ServerFrame;
    try {
      frame = JSON.parse(typeof raw === "string" ? raw : String(raw));
    } catch {
      return;
    }

    if (frame.t === "state" && frame.state) {
      this.lastKnown = frame.state;
      this.version = frame.version ?? this.version;
      this.stateHandlers.forEach((h) => h(frame.state as RoomState));
    }

    if (frame.t === "event" && frame.eventType) {
      // The server stamps `from` and `id`; a sender cannot claim to be someone
      // else, and the id we dedupe on cannot be forged to suppress a message.
      const id = frame.id ?? uid("e_");
      if (!this.seenEvents.includes(id)) {
        this.seenEvents.push(id);
        if (this.seenEvents.length > 500) this.seenEvents.splice(0, 250);
        const event: RoomEvent = {
          id,
          type: frame.eventType,
          payload: frame.payload,
          from: frame.from ?? "",
          ts: Date.now(),
        };
        this.eventHandlers.forEach((h) => h(event));
      }
    }

    for (const waiter of [...this.waiters]) {
      if (waiter.match(frame)) waiter.resolve(frame);
    }

    // A `denied` with no request behind it means the server no longer counts
    // this socket as subscribed while we still think it is. That happens when
    // another connection took the seat — a duplicate tab, an overlapping
    // reconnect, or two mounts racing — and the survivor is left holding a
    // socket that is open and silent. Re-subscribing is the recovery, and the
    // server will refuse it if the seat genuinely belongs to someone else.
    if (frame.t === "denied" && !frame.rid && this.subscribed && !this.closing) {
      void this.resubscribe();
    }
  }

  private async resubscribe(): Promise<void> {
    if (this.resubscribing) return;
    this.resubscribing = true;
    try {
      await this.subscribe();
    } catch {
      // The seat really is not ours. Stop claiming otherwise.
      this.subscribed = false;
      setConnectionState("failed");
    } finally {
      this.resubscribing = false;
    }
  }

  // --- rooms ----------------------------------------------------------------

  /**
   * Create the room if it is ours to create, otherwise join it — then subscribe.
   *
   * The HTTP call is what establishes membership; the subscribe is what the
   * server checks it against.
   */
  async ensureRoom(initial: RoomState): Promise<RoomState> {
    const response = await this.http(`${this.origin}/api/rooms`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        code: this.code,
        playerId: this.playerId,
        experienceId: initial.experienceId,
        asHost: initial.hostId === this.playerId,
        state: initial,
      }),
    });

    if (!response.ok) {
      const detail = await response.json().catch(() => ({ error: response.statusText }));
      throw new RailwayConnectionError(
        (detail as { error?: string }).error ?? `The server refused the room (${response.status}).`,
      );
    }

    const body = (await response.json()) as { state: RoomState; version: number };
    this.lastKnown = body.state;
    this.version = body.version;

    await this.subscribe();
    return this.lastKnown ?? body.state;
  }

  private async subscribe(): Promise<void> {
    const frame = await this.request(
      { t: "subscribe", code: this.code, playerId: this.playerId },
      (f) => f.t === "state" || f.t === "denied",
    );

    if (frame.t === "denied") {
      throw new RailwayConnectionError(frame.reason ?? "You are not in that room.");
    }

    this.subscribed = true;
    setConnectionState("connected");
    if (frame.state) {
      this.lastKnown = frame.state;
      this.version = frame.version ?? this.version;
    }
  }

  async readState(): Promise<RoomState | null> {
    return this.lastKnown;
  }

  /**
   * Read-modify-write, resolved here and settled by the server.
   *
   * Decision A: the merge stays on the client so `patchState(fn)` keeps working
   * for all twenty experiences unchanged. The server is not a spectator — it
   * compares the version the patch was derived from against its own row and
   * refuses a stale one, which is what makes two people answering at the same
   * moment safe.
   */
  patchState(patch: RoomStatePatch | ((current: RoomState) => RoomStatePatch)): Promise<void> {
    return this.queue.run(async () => {
      for (let attempt = 0; attempt < MAX_PATCH_ATTEMPTS; attempt++) {
        const current = this.lastKnown;
        if (!current) return;

        const resolved = typeof patch === "function" ? patch(current) : patch;
        const next = applyPatch(current, resolved);

        const frame = await this.request(
          { t: "patch", code: this.code, playerId: this.playerId, version: this.version, state: next },
          (f) => f.t === "ack" || f.t === "conflict" || f.t === "denied",
        );

        if (frame.t === "denied") {
          throw new RailwayConnectionError(frame.reason ?? "That change was refused.");
        }

        // Accepted. The new document arrives separately, as a broadcast to the
        // whole room including us.
        if (frame.t === "ack") {
          this.version = frame.version ?? this.version;
          return;
        }

        // Conflict: rebuild on what actually landed and try again.
        if (frame.state) {
          this.lastKnown = frame.state;
          this.version = frame.version ?? this.version;
        }
        await new Promise((r) => setTimeout(r, 30 + Math.random() * 70));
      }
      console.warn("[railway] gave up re-applying a change after repeated conflicts");
    });
  }

  async broadcast(type: string, payload: unknown): Promise<void> {
    this.send({ t: "event", code: this.code, playerId: this.playerId, eventType: type, payload });
  }

  /**
   * Presence, which deliberately does not go through `patchState`.
   *
   * A heartbeat every three seconds that rewrote the room document would
   * re-serialise an entire Draw Together round twenty times a minute — the
   * write amplification this migration exists partly to remove. One small row
   * in `room_players` instead, and the roster is composed back into
   * `RoomState.players` by the server on the way out, so experiences see no
   * difference at all.
   */
  async presence(update: PresenceUpdate): Promise<void> {
    if (!this.subscribed || !this.socket || this.socket.readyState !== 1) return;
    this.send({
      t: "presence",
      code: this.code,
      playerId: this.playerId,
      name: update.name,
      emoji: update.emoji,
      ready: update.ready,
    });
  }

  onState(handler: (state: RoomState) => void) {
    this.stateHandlers.add(handler);
    if (this.lastKnown) handler(this.lastKnown);
    return () => this.stateHandlers.delete(handler) as unknown as void;
  }

  onEvent(handler: (event: RoomEvent) => void) {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler) as unknown as void;
  }
}
