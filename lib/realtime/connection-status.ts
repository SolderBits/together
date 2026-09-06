"use client";

/**
 * What the realtime connection is actually doing.
 *
 * Deliberately not part of `RoomTransport`. The interface describes what a
 * transport *does*; this is a fact about one of them, published sideways so the
 * UI can report it honestly without every implementation having to pretend to
 * have an opinion. The local transport has no connection to report on, and the
 * Supabase one manages its own — neither publishes here, and the reader sees
 * `local` rather than a state invented for them.
 *
 * The distinction the UI needs from this: "a realtime backend is configured" is
 * a build-time fact, and "we are talking to it" is not. Saying connected
 * because an environment variable exists is exactly the lie this exists to
 * prevent.
 */

export type ConnectionState =
  /** No hosted backend. Rooms are local to this device. */
  | "local"
  /** Configured, first attempt in flight. */
  | "connecting"
  /** Open, and the room is subscribed. */
  | "connected"
  /** Was open, dropped, trying again. State is stale but the session survives. */
  | "reconnecting"
  /** Configured but not reachable. Not a state to paper over. */
  | "failed";

type Listener = (state: ConnectionState) => void;

let current: ConnectionState = "local";
const listeners = new Set<Listener>();

export function connectionState(): ConnectionState {
  return current;
}

export function setConnectionState(next: ConnectionState) {
  if (next === current) return;
  current = next;
  // Outside production only: makes the state observable from a console, which
  // is how a connection problem gets diagnosed without instrumenting React.
  if (process.env.NODE_ENV !== "production") {
    (globalThis as { __togetherConnection?: ConnectionState }).__togetherConnection = next;
  }
  listeners.forEach((l) => l(next));
}

export function subscribeConnection(listener: Listener): () => void {
  listeners.add(listener);
  listener(current);
  return () => {
    listeners.delete(listener);
  };
}
