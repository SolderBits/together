"use client";

import type { RoomEvent, RoomState, RoomStatePatch } from "@/lib/rooms/types";
import { uid } from "@/lib/utils";
import { WriteQueue } from "./queue";
import { applyPatch, type RoomTransport } from "./transport";

type Wire =
  | { kind: "state"; state: RoomState }
  | { kind: "event"; event: RoomEvent }
  | { kind: "sync-request"; from: string };

/**
 * Zero-config transport. Rooms live in localStorage (so a refresh reconnects)
 * and changes fan out to other tabs over BroadcastChannel. This is what powers
 * the app when Supabase credentials are absent — two tabs behave like two
 * devices, which is enough to exercise every multiplayer flow.
 */
export class LocalRoomTransport implements RoomTransport {
  readonly kind = "local" as const;
  readonly code: string;

  private channel: BroadcastChannel | null = null;
  private stateHandlers = new Set<(s: RoomState) => void>();
  private eventHandlers = new Set<(e: RoomEvent) => void>();
  private storageListener: ((e: StorageEvent) => void) | null = null;
  private clientId = uid("c_");
  private seenEvents = new Set<string>();
  private queue = new WriteQueue();

  constructor(code: string) {
    this.code = code.toUpperCase();
  }

  private get storageKey() {
    return `together:room:${this.code}`;
  }

  async connect() {
    if (typeof window === "undefined") return;
    if ("BroadcastChannel" in window) {
      this.channel = new BroadcastChannel(`together:room:${this.code}`);
      this.channel.onmessage = (ev: MessageEvent<Wire>) => this.receive(ev.data);
    }
    // Fallback (and belt-and-braces) cross-tab path.
    this.storageListener = (e: StorageEvent) => {
      if (e.key !== this.storageKey || !e.newValue) return;
      try {
        this.emitState(JSON.parse(e.newValue) as RoomState);
      } catch {
        /* ignore malformed payloads */
      }
    };
    window.addEventListener("storage", this.storageListener);

    const existing = await this.readState();
    if (existing) this.emitState(existing);
    this.post({ kind: "sync-request", from: this.clientId });
  }

  async disconnect() {
    this.channel?.close();
    this.channel = null;
    if (this.storageListener && typeof window !== "undefined") {
      window.removeEventListener("storage", this.storageListener);
    }
    this.storageListener = null;
    this.stateHandlers.clear();
    this.eventHandlers.clear();
  }

  async ensureRoom(initial: RoomState) {
    const existing = await this.readState();
    if (existing) {
      // Merge in the joining player without clobbering anyone already present.
      const merged = applyPatch(existing, { players: initial.players });
      this.write(merged);
      return merged;
    }
    this.write(initial);
    return initial;
  }

  async readState(): Promise<RoomState | null> {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(this.storageKey);
      return raw ? (JSON.parse(raw) as RoomState) : null;
    } catch {
      return null;
    }
  }

  patchState(patch: RoomStatePatch | ((current: RoomState) => RoomStatePatch)) {
    return this.queue.run(async () => {
      const current = await this.readState();
      if (!current) return;
      const resolved = typeof patch === "function" ? patch(current) : patch;
      this.write(applyPatch(current, resolved));
    });
  }

  async broadcast(type: string, payload: unknown) {
    const event: RoomEvent = { id: uid("e_"), type, payload, from: this.clientId, ts: Date.now() };
    this.seenEvents.add(event.id);
    this.post({ kind: "event", event });
    this.eventHandlers.forEach((h) => h(event));
  }

  onState(handler: (state: RoomState) => void) {
    this.stateHandlers.add(handler);
    return () => this.stateHandlers.delete(handler) as unknown as void;
  }

  onEvent(handler: (event: RoomEvent) => void) {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler) as unknown as void;
  }

  // --- internals -----------------------------------------------------------

  private write(state: RoomState) {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(this.storageKey, JSON.stringify(state));
      } catch {
        /* quota or private mode — the in-memory broadcast still works */
      }
    }
    this.emitState(state);
    this.post({ kind: "state", state });
  }

  private post(message: Wire) {
    try {
      this.channel?.postMessage(message);
    } catch {
      /* channel closed */
    }
  }

  private receive(message: Wire) {
    if (!message) return;
    if (message.kind === "state") {
      this.emitState(message.state);
    } else if (message.kind === "event") {
      if (this.seenEvents.has(message.event.id)) return;
      this.seenEvents.add(message.event.id);
      this.eventHandlers.forEach((h) => h(message.event));
    } else if (message.kind === "sync-request" && message.from !== this.clientId) {
      void this.readState().then((s) => s && this.post({ kind: "state", state: s }));
    }
  }

  private emitState(state: RoomState) {
    this.stateHandlers.forEach((h) => h(state));
  }
}

/**
 * Drop local room documents nobody has touched for a day.
 *
 * These share the origin's storage quota with photo strips and the scrapbook,
 * and a room that has been idle that long is not being returned to. Runs once
 * per page load, before anything else asks for space.
 */
export function pruneStaleLocalRooms(ttlMs = 24 * 60 * 60 * 1000) {
  if (typeof window === "undefined") return 0;
  let removed = 0;
  try {
    const cutoff = Date.now() - ttlMs;
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key?.startsWith("together:room:")) keys.push(key);
    }
    for (const key of keys) {
      try {
        const room = JSON.parse(window.localStorage.getItem(key) ?? "{}") as RoomState;
        const touched = Math.max(
          room.createdAt ?? 0,
          room.startedAt ?? 0,
          ...Object.values(room.players ?? {}).map((p) => p.lastSeen ?? 0),
        );
        if (touched < cutoff) {
          window.localStorage.removeItem(key);
          removed++;
        }
      } catch {
        // Unparseable: it cannot be resumed, so it is only taking up room.
        window.localStorage.removeItem(key);
        removed++;
      }
    }
  } catch {
    /* storage unavailable */
  }
  return removed;
}

/** Remove a stored local room entirely (used by "leave & delete"). */
export function purgeLocalRoom(code: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(`together:room:${code.toUpperCase()}`);
  } catch {
    /* ignore */
  }
}
