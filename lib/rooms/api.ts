"use client";

import { createTransport, type RoomTransport } from "@/lib/realtime";
import { purgeLocalRoom } from "@/lib/realtime/local-transport";
import { generateRoomCode, siteOrigin, uid } from "@/lib/utils";
import { getIdentity } from "./identity";
import {
  HEARTBEAT_INTERVAL_MS,
  HOST_ELECTION_COOLDOWN_MS,
  PRESENCE_TIMEOUT_MS,
  type PlayerIdentity,
  type RoomEvent,
  type RoomPlayer,
  type RoomState,
  type RoomStatePatch,
} from "./types";

const RECENT_KEY = "together:recent-rooms";

/**
 * How long a room is worth keeping.
 *
 * Rooms are a sitting, not an account: two people play and close the tab. Kept
 * forever they accumulate in the same browser storage the photo features need,
 * and "Still open" starts offering rooms from three weeks ago that lead
 * nowhere. Twenty-four hours matches `join_room`, which refuses anything older.
 */
export const ROOM_TTL_MS = 24 * 60 * 60 * 1000;

function emptyState(code: string, experienceId: string, host: PlayerIdentity): RoomState {
  const now = Date.now();
  return {
    code,
    experienceId,
    status: "lobby",
    hostId: host.id,
    hostSince: now,
    seed: uid("s_"),
    createdAt: now,
    startedAt: null,
    players: {
      [host.id]: { ...host, role: "host", ready: false, lastSeen: now },
    },
    data: {},
  };
}

/**
 * A live connection to one room. Every experience talks to this object rather
 * than to a transport directly, so no multiplayer logic lives inside a page.
 */
export class RoomSession {
  readonly code: string;
  readonly identity: PlayerIdentity;
  private transport: RoomTransport;
  private state: RoomState | null = null;
  private listeners = new Set<(state: RoomState) => void>();
  private eventListeners = new Set<(event: RoomEvent) => void>();
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private onVisible: (() => void) | null = null;
  private closed = false;

  private constructor(transport: RoomTransport, identity: PlayerIdentity) {
    this.transport = transport;
    this.identity = identity;
    this.code = transport.code;
  }

  static async open(options: {
    code: string;
    experienceId: string;
    identity: PlayerIdentity;
    asHost: boolean;
  }): Promise<RoomSession> {
    const transport = createTransport(options.code);
    const session = new RoomSession(transport, options.identity);

    transport.onState((next) => {
      session.state = next;
      session.listeners.forEach((l) => l(next));
    });
    transport.onEvent((event) => {
      session.eventListeners.forEach((l) => l(event));
    });

    await transport.connect();

    const existing = await transport.readState();
    if (!existing && !options.asHost) {
      await transport.disconnect();
      throw new RoomNotFoundError(options.code);
    }

    const base = existing ?? emptyState(options.code, options.experienceId, options.identity);
    const me: RoomPlayer = {
      ...options.identity,
      role: existing ? (existing.hostId === options.identity.id ? "host" : "guest") : "host",
      ready: existing?.players?.[options.identity.id]?.ready ?? false,
      lastSeen: Date.now(),
    };

    const seeded: RoomState = {
      ...base,
      players: { ...base.players, [options.identity.id]: me },
    };

    session.state = await transport.ensureRoom(seeded);
    if (existing) {
      // Register (or refresh) ourselves in an already-existing room.
      await transport.patchState({ players: { [options.identity.id]: me } });
    }

    session.startHeartbeat();
    rememberRoom(options.code, session.state.experienceId);
    return session;
  }

  get current() {
    return this.state;
  }

  get transportKind() {
    return this.transport.kind;
  }

  subscribe(listener: (state: RoomState) => void) {
    this.listeners.add(listener);
    if (this.state) listener(this.state);
    return () => this.listeners.delete(listener) as unknown as void;
  }

  onEvent(listener: (event: RoomEvent) => void) {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener) as unknown as void;
  }

  updateState(patch: RoomStatePatch | ((current: RoomState) => RoomStatePatch)) {
    return this.transport.patchState(patch);
  }

  setReady(ready: boolean) {
    return this.updateState((current) => ({
      players: {
        [this.identity.id]: {
          ...(current.players[this.identity.id] as RoomPlayer),
          ready,
          lastSeen: Date.now(),
        },
      },
    }));
  }

  start() {
    return this.updateState({ status: "active", startedAt: Date.now() });
  }

  finish() {
    return this.updateState({ status: "finished" });
  }

  reset(data: Record<string, unknown> = {}) {
    return this.updateState((current) => ({
      status: "lobby",
      startedAt: null,
      data,
      players: Object.fromEntries(
        Object.entries(current.players).map(([id, p]) => [id, { ...p, ready: false }]),
      ),
    }));
  }

  broadcast(type: string, payload: unknown) {
    return this.transport.broadcast(type, payload);
  }

  /**
   * Detach from the room.
   *
   * `departing` separates the two very different reasons this runs. Pressing
   * "Leave" is a decision: the seat is given up immediately by zeroing the
   * heartbeat. A component unmounting is not — it is usually a refresh, and the
   * same tab is about to come straight back with the same identity. Treating
   * those alike would hand the host seat away every time the host reloaded the
   * page, so an unmount says nothing and lets the ordinary presence tolerance
   * decide.
   */
  async leave(options: { destroy?: boolean; departing?: boolean } = {}) {
    if (this.closed) return;
    this.closed = true;
    if (this.heartbeat) clearInterval(this.heartbeat);
    if (this.onVisible && typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.onVisible);
      window.removeEventListener("focus", this.onVisible);
    }
    if (options.departing) {
      try {
        // `patchState` merges the player map, so departure is signalled by
        // zeroing our heartbeat; the presence timeout removes us everywhere.
        await this.updateState((current) => ({
          players: {
            [this.identity.id]: {
              ...(current.players[this.identity.id] as RoomPlayer),
              lastSeen: 0,
              ready: false,
            },
          },
        }));
      } catch {
        /* room may already be gone */
      }
    }
    await this.transport.disconnect();
    if (options.destroy && this.transport.kind === "local") purgeLocalRoom(this.code);
    if (options.departing) forgetRoom(this.code);
  }

  /**
   * Claims the host seat when this client is the elected successor.
   *
   * Runs on the heartbeat, so it is checked every three seconds without any
   * timer of its own. The election is recomputed against `current` inside the
   * write so a claim can never be based on a stale read.
   */
  private claimHostIfElected() {
    return this.updateState((current) => {
      if (electHost(current) !== this.identity.id) return {};
      const now = Date.now();
      const outgoing = current.players[current.hostId];
      return {
        hostId: this.identity.id,
        hostSince: now,
        players: {
          // Demote the player we are replacing in the same write, so the roster
          // never shows two hosts even for a frame.
          ...(outgoing ? { [outgoing.id]: { ...outgoing, role: "guest" as const } } : {}),
          [this.identity.id]: {
            ...(current.players[this.identity.id] as RoomPlayer),
            role: "host" as const,
            lastSeen: now,
          },
        },
      };
    });
  }

  private startHeartbeat() {
    if (typeof window === "undefined") return;
    const beat = () =>
      void this.updateState((current) => {
        const me = current.players[this.identity.id];
        if (!me) {
          return {
            players: {
              [this.identity.id]: {
                ...this.identity,
                role: current.hostId === this.identity.id ? "host" : "guest",
                ready: false,
                lastSeen: Date.now(),
              },
            },
          };
        }
        return { players: { [this.identity.id]: { ...me, lastSeen: Date.now() } } };
      }).then(() => {
        // Ordered after the beat so our own presence is already fresh when the
        // election looks at the roster.
        const state = this.state;
        if (state && electHost(state) === this.identity.id) {
          return this.claimHostIfElected();
        }
      });
    this.heartbeat = setInterval(beat, HEARTBEAT_INTERVAL_MS);
    // Background tabs get throttled, so beat the moment we come back.
    this.onVisible = () => {
      if (document.visibilityState === "visible") beat();
    };
    document.addEventListener("visibilitychange", this.onVisible);
    window.addEventListener("focus", this.onVisible);
  }
}

/**
 * Host election.
 *
 * ## The rule
 *
 * The host is whoever `state.hostId` names. It changes only when **all** of
 * these hold, evaluated against one snapshot of the room document:
 *
 *  1. the named host's heartbeat is older than `PRESENCE_TIMEOUT_MS` (45 s),
 *  2. the last handover was more than `HOST_ELECTION_COOLDOWN_MS` (15 s) ago,
 *  3. at least one player *is* inside the presence window,
 *  4. and the successor is the online player with the lowest id, compared as a
 *     plain string.
 *
 * Ids are opaque random strings, so "lowest id" is arbitrary but **stable** and
 * **identical on every client** — every participant derives the same successor
 * from the same document without exchanging a single message. Only that one
 * client writes; everyone else recognises it is not them and does nothing.
 *
 * ## Why it cannot produce two hosts
 *
 * The claim is written through the same read-modify-write path as every other
 * room update, and re-checks its preconditions against `current` *inside* the
 * transaction. A second claimant — one whose view of presence briefly differed,
 * say either side of a partition — reads a document whose `hostId` has already
 * moved and whose `hostSince` is inside the cooldown, so its patch collapses to
 * a no-op. The cooldown also covers the window where a new host has not yet
 * written its first heartbeat and therefore still looks stale.
 *
 * ## What it deliberately does not do
 *
 * A brief interruption changes nothing: 45 s is fifteen missed heartbeats, and
 * the tab beats again immediately on `visibilitychange` and `focus`. A former
 * host that comes back is simply a guest — nothing anywhere reads a "was host"
 * flag, and `RoomSession.open` derives role from the *current* `hostId`. Game
 * state is untouched: the patch carries `hostId` and `hostSince` and nothing
 * else, so answers, scores, drawings and chat are unaffected by a handover.
 */
export function electHost(state: RoomState, now = Date.now()): string | null {
  const host = state.players[state.hostId];
  const hostAlive = host ? host.lastSeen > now - PRESENCE_TIMEOUT_MS : false;
  if (hostAlive) return null;

  // A handover we may not have seen the heartbeat for yet.
  if (now - (state.hostSince ?? 0) < HOST_ELECTION_COOLDOWN_MS) return null;

  const online = Object.values(state.players)
    .filter((p) => p.lastSeen > now - PRESENCE_TIMEOUT_MS)
    .map((p) => p.id)
    .sort();

  const successor = online[0];
  if (!successor || successor === state.hostId) return null;
  return successor;
}

export class RoomNotFoundError extends Error {
  constructor(code: string) {
    super(`Room ${code} was not found`);
    this.name = "RoomNotFoundError";
  }
}

// --- The documented room API -------------------------------------------------

export async function createRoom(experienceId: string, identity = getIdentity()) {
  const code = generateRoomCode();
  const session = await RoomSession.open({ code, experienceId, identity, asHost: true });
  return session;
}

export async function joinRoom(code: string, identity = getIdentity()) {
  return RoomSession.open({
    code: code.toUpperCase(),
    experienceId: "",
    identity,
    asHost: false,
  });
}

export async function leaveRoom(session: RoomSession, destroy = false) {
  return session.leave({ destroy, departing: true });
}

export function subscribeToRoom(session: RoomSession, listener: (state: RoomState) => void) {
  return session.subscribe(listener);
}

export function updateRoomState(
  session: RoomSession,
  patch: RoomStatePatch | ((current: RoomState) => RoomStatePatch),
) {
  return session.updateState(patch);
}

export function setPlayerReady(session: RoomSession, ready: boolean) {
  return session.setReady(ready);
}

export function startExperience(session: RoomSession) {
  return session.start();
}

export function broadcastEvent(session: RoomSession, type: string, payload: unknown) {
  return session.broadcast(type, payload);
}

export async function roomExists(code: string) {
  const transport = createTransport(code.toUpperCase());
  await transport.connect();
  const state = await transport.readState();
  await transport.disconnect();
  return state;
}

// --- Derived helpers ---------------------------------------------------------

export function onlinePlayers(state: RoomState | null): RoomPlayer[] {
  if (!state) return [];
  const cutoff = Date.now() - PRESENCE_TIMEOUT_MS;
  return Object.values(state.players)
    .filter((p) => p.lastSeen > cutoff)
    .sort((a, b) => (a.role === "host" ? -1 : b.role === "host" ? 1 : 0));
}

/**
 * Everyone the room knows about, host first — including someone whose heartbeat
 * has lapsed. Results and scoreboards use this so a backgrounded partner never
 * vanishes from a final score.
 */
export function roomRoster(state: RoomState | null): RoomPlayer[] {
  if (!state) return [];
  return Object.values(state.players).sort((a, b) => {
    if (a.role === b.role) return a.id.localeCompare(b.id);
    return a.role === "host" ? -1 : 1;
  });
}

/**
 * Display names that are unique within a room.
 *
 * Guest names come from a small pool, so two people genuinely can end up as
 * "Sage" — which makes a verdict like "Judgment for Sage" meaningless. Where a
 * name repeats, the player's badge is appended.
 */
export function uniqueNames(players: RoomPlayer[]): Record<string, string> {
  const counts = new Map<string, number>();
  players.forEach((p) => counts.set(p.name, (counts.get(p.name) ?? 0) + 1));
  return Object.fromEntries(
    players.map((p) => [p.id, (counts.get(p.name) ?? 0) > 1 ? `${p.name} ${p.emoji}` : p.name]),
  );
}

export function inviteLink(code: string) {
  return `${siteOrigin()}/room/${code}`;
}

export function everyoneReady(state: RoomState | null) {
  const online = onlinePlayers(state);
  return online.length >= 2 && online.every((p) => p.ready);
}

// --- Recently visited rooms (for reconnect UI) -------------------------------

export interface RecentRoom {
  code: string;
  experienceId: string;
  at: number;
}

export function rememberRoom(code: string, experienceId: string) {
  if (typeof window === "undefined") return;
  try {
    const list = recentRooms().filter((r) => r.code !== code);
    list.unshift({ code, experienceId, at: Date.now() });
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 8)));
  } catch {
    /* ignore */
  }
}

export function forgetRoom(code: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      RECENT_KEY,
      JSON.stringify(recentRooms().filter((r) => r.code !== code)),
    );
  } catch {
    /* ignore */
  }
}

export function recentRooms(): RecentRoom[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const all = raw ? (JSON.parse(raw) as RecentRoom[]) : [];
    const cutoff = Date.now() - ROOM_TTL_MS;
    const live = all.filter((r) => r && typeof r.at === "number" && r.at > cutoff);
    if (live.length !== all.length) {
      window.localStorage.setItem(RECENT_KEY, JSON.stringify(live));
    }
    return live;
  } catch {
    return [];
  }
}
