"use client";

import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import type { RoomEvent, RoomState, RoomStatePatch } from "@/lib/rooms/types";
import { uid } from "@/lib/utils";
import { WriteQueue } from "./queue";
import { applyPatch, type RoomTransport } from "./transport";

/**
 * Hosted transport. The room document lives in `public.rooms.state` (jsonb) and
 * changes propagate two ways: an immediate channel broadcast for latency, plus
 * postgres_changes so a client that reconnects mid-game still converges.
 *
 * Access is not granted by holding a room code. `create_room` and `join_room`
 * are the only ways in, and both record a membership row that every policy on
 * `rooms` and everything hanging off it then checks. A code lets you call
 * `join_room`; the database decides what that gets you.
 *
 * Writes carry the version they were derived from, so two clients patching at
 * once cannot silently overwrite one another — the loser re-reads and retries
 * rather than discarding the winner's change.
 */
export class SupabaseRoomTransport implements RoomTransport {
  readonly kind = "supabase" as const;
  readonly code: string;

  private client: SupabaseClient;
  private channel: RealtimeChannel | null = null;
  private stateHandlers = new Set<(s: RoomState) => void>();
  private eventHandlers = new Set<(e: RoomEvent) => void>();
  private clientId = uid("c_");
  private seenEvents = new Set<string>();
  private lastKnown: RoomState | null = null;
  private version = 0;
  private roomId: string | null = null;
  private playerId: string | null = null;
  private queue = new WriteQueue();

  constructor(client: SupabaseClient, code: string) {
    this.client = client;
    this.code = code.toUpperCase();
  }

  async connect() {
    this.channel = this.client
      .channel(`room:${this.code}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "state" }, ({ payload }) => {
        this.emitState(payload as RoomState);
      })
      .on("broadcast", { event: "room-event" }, ({ payload }) => {
        const event = payload as RoomEvent;
        if (this.seenEvents.has(event.id)) return;
        this.seenEvents.add(event.id);
        this.eventHandlers.forEach((h) => h(event));
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms", filter: `code=eq.${this.code}` },
        (payload) => {
          const row = payload.new as { state?: RoomState } | null;
          if (row?.state) this.emitState(row.state);
        },
      );

    await this.channel.subscribe();
    const existing = await this.readState();
    if (existing) this.emitState(existing);
  }

  async disconnect() {
    if (this.channel) await this.client.removeChannel(this.channel);
    this.channel = null;
    this.stateHandlers.clear();
    this.eventHandlers.clear();
  }

  /**
   * Become a member, creating the room if this client is its host.
   *
   * Both paths go through a `security definer` function because membership is
   * the one thing a client must not be able to grant itself — there is no
   * insert policy on `room_members` at all.
   */
  async ensureRoom(initial: RoomState) {
    const me = Object.keys(initial.players).find((id) => initial.players[id]);
    this.playerId = me ?? initial.hostId;

    const joined = await this.client.rpc("join_room", {
      p_code: this.code,
      p_player_id: this.playerId,
      p_name: initial.players[this.playerId!]?.name ?? "Guest",
      p_emoji: initial.players[this.playerId!]?.emoji ?? "🌸",
    });

    if (!joined.error && joined.data) {
      const row = joined.data as { id: string; state: RoomState; version?: number };
      this.roomId = row.id;
      this.version = row.version ?? 0;
      const merged = applyPatch(row.state, { players: initial.players });
      await this.write(merged);
      return merged;
    }

    // No such room. Only a host may bring one into existence.
    if (initial.hostId !== this.playerId) throw joined.error ?? new Error("Room not found");

    const created = await this.client.rpc("create_room", {
      p_code: this.code,
      p_experience_id: initial.experienceId,
      p_player_id: this.playerId,
      p_state: initial,
    });
    if (created.error) throw created.error;

    const row = created.data as { id: string; version?: number };
    this.roomId = row.id;
    this.version = row.version ?? 0;
    this.lastKnown = initial;
    return initial;
  }

  async readState(): Promise<RoomState | null> {
    const { data, error } = await this.client
      .from("rooms")
      .select("id, state, version")
      .eq("code", this.code)
      .maybeSingle();
    if (error || !data) return null;
    this.roomId = (data as { id: string }).id;
    this.version = (data as { version?: number }).version ?? 0;
    this.lastKnown = (data as { state: RoomState }).state;
    return this.lastKnown;
  }

  /**
   * Read, merge, write — with the read's version carried into the write.
   *
   * `WriteQueue` only serialises this client. Two people answering at the same
   * moment both read the same document, and without the version check the
   * second write would erase the first. The conditional update turns that into
   * a miss, and the retry re-reads and re-applies the patch on top of whatever
   * actually landed.
   */
  patchState(patch: RoomStatePatch | ((current: RoomState) => RoomStatePatch)) {
    return this.queue.run(async () => {
      for (let attempt = 0; attempt < 5; attempt++) {
        const current = (await this.readState()) ?? this.lastKnown;
        if (!current) return;
        const resolved = typeof patch === "function" ? patch(current) : patch;
        const next = applyPatch(current, resolved);
        if (await this.write(next, this.version)) return;
        // Someone else got there first; loop and rebuild on their version.
        await new Promise((r) => setTimeout(r, 40 + Math.random() * 80));
      }
      console.warn("Room update gave up after five contended attempts.");
    });
  }

  async broadcast(type: string, payload: unknown) {
    const event: RoomEvent = { id: uid("e_"), type, payload, from: this.clientId, ts: Date.now() };
    this.seenEvents.add(event.id);
    this.eventHandlers.forEach((h) => h(event));
    await this.channel?.send({ type: "broadcast", event: "room-event", payload: event });
  }

  onState(handler: (state: RoomState) => void) {
    this.stateHandlers.add(handler);
    return () => this.stateHandlers.delete(handler) as unknown as void;
  }

  onEvent(handler: (event: RoomEvent) => void) {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler) as unknown as void;
  }

  /** Returns false when another client's write landed first. */
  private async write(state: RoomState, expectedVersion?: number): Promise<boolean> {
    let query = this.client
      .from("rooms")
      .update({
        state,
        status: state.status,
        experience_id: state.experienceId,
        version: (expectedVersion ?? this.version) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("code", this.code);

    if (expectedVersion !== undefined) query = query.eq("version", expectedVersion);

    const { data, error } = await query.select("version");
    if (error) throw error;
    if (expectedVersion !== undefined && (!data || data.length === 0)) return false;

    this.version = (data?.[0] as { version?: number } | undefined)?.version ?? this.version + 1;
    this.lastKnown = state;
    this.emitState(state);
    await this.channel?.send({ type: "broadcast", event: "state", payload: state });
    return true;
  }

  private emitState(state: RoomState) {
    this.lastKnown = state;
    this.stateHandlers.forEach((h) => h(state));
  }
}
