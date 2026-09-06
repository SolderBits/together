import type { RoomEvent, RoomState, RoomStatePatch } from "@/lib/rooms/types";

/**
 * A presence beat: who is here, and how they are.
 *
 * Separate from `patchState` because presence is high-frequency and tiny while
 * the room document is low-frequency and can be large. Folding one into the
 * other is what made a heartbeat re-serialise an entire Draw Together round
 * twenty times a minute.
 */
export interface PresenceUpdate {
  name?: string;
  emoji?: string;
  ready?: boolean;
}

/**
 * The contract every realtime backend implements. Experiences only ever talk to
 * this interface (through `useRoom`), so swapping Supabase for anything else is
 * a one-file change.
 */
export interface RoomTransport {
  readonly kind: "local" | "supabase" | "railway";
  readonly code: string;

  /** Attach to the room, emitting the current state as soon as it is known. */
  connect(): Promise<void>;
  disconnect(): Promise<void>;

  /** Create the room document if it does not exist yet. Returns the state. */
  ensureRoom(initial: RoomState): Promise<RoomState>;
  readState(): Promise<RoomState | null>;

  patchState(patch: RoomStatePatch | ((current: RoomState) => RoomStatePatch)): Promise<void>;
  broadcast(type: string, payload: unknown): Promise<void>;

  onState(handler: (state: RoomState) => void): () => void;
  onEvent(handler: (event: RoomEvent) => void): () => void;

  /**
   * Optional. A transport that can carry presence out-of-band implements this;
   * one that cannot simply does not, and `RoomSession` falls back to writing
   * presence into the room document as it always has. That keeps the local and
   * Supabase transports working untouched.
   */
  presence?(update: PresenceUpdate): Promise<void>;
}

/** Shallow-merge a patch into a state document, merging `data` one level deep. */
export function applyPatch(state: RoomState, patch: RoomStatePatch): RoomState {
  const { data, players, ...rest } = patch;
  return {
    ...state,
    ...rest,
    players: players ? { ...state.players, ...players } : state.players,
    data: data ? { ...state.data, ...data } : state.data,
  };
}
