export type PlayerRole = "host" | "guest";
export type RoomStatus = "lobby" | "active" | "finished";

export interface PlayerIdentity {
  id: string;
  name: string;
  emoji: string;
}

export interface RoomPlayer extends PlayerIdentity {
  role: PlayerRole;
  ready: boolean;
  /** Epoch ms of the last presence heartbeat. */
  lastSeen: number;
}

/**
 * The full replicated document for a room. `data` is the only part individual
 * experiences touch — everything above it is owned by the room system.
 */
export interface RoomState<TData = Record<string, unknown>> {
  code: string;
  experienceId: string;
  status: RoomStatus;
  hostId: string;
  /**
   * When `hostId` last changed. Two purposes: it stops a freshly elected host
   * being re-elected away by a client whose view of presence is a beat behind,
   * and it lets the UI announce the handover once rather than on every render.
   */
  hostSince: number;
  /** Seed shared by every player so deterministic content matches exactly. */
  seed: string;
  createdAt: number;
  startedAt: number | null;
  players: Record<string, RoomPlayer>;
  data: TData;
}

export interface RoomEvent<T = unknown> {
  id: string;
  type: string;
  payload: T;
  from: string;
  ts: number;
}

export type RoomStatePatch<TData = Record<string, unknown>> = Partial<
  Omit<RoomState<TData>, "data">
> & { data?: Partial<TData> };

export interface RoomSnapshot<TData = Record<string, unknown>> {
  state: RoomState<TData>;
  /** Players considered online right now (heartbeat within the presence window). */
  online: string[];
}

/**
 * Generous on purpose: browsers throttle timers in background tabs, so a
 * partner who switches away must not appear to have left. A deliberate exit
 * zeroes the heartbeat instead, which removes them immediately.
 */
export const PRESENCE_TIMEOUT_MS = 45_000;
export const HEARTBEAT_INTERVAL_MS = 3_000;

/**
 * Quiet period after a handover during which nobody may be elected again.
 *
 * A newly elected host has not had time to write its first heartbeat, so for a
 * moment it looks exactly as stale as the host it replaced. Without this, a
 * third client could immediately elect someone else.
 */
export const HOST_ELECTION_COOLDOWN_MS = 15_000;
