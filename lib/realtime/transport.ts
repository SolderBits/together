import type { RoomEvent, RoomState, RoomStatePatch } from "@/lib/rooms/types";

/**
 * The contract every realtime backend implements. Experiences only ever talk to
 * this interface (through `useRoom`), so swapping Supabase for anything else is
 * a one-file change.
 */
export interface RoomTransport {
  readonly kind: "local" | "supabase";
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
