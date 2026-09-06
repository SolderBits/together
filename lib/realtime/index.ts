"use client";

import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { LocalRoomTransport } from "./local-transport";
import { SupabaseRoomTransport } from "./supabase-transport";
import { RailwayRoomTransport } from "./railway-transport";
import type { RoomTransport } from "./transport";

export { applyPatch } from "./transport";
export type { PresenceUpdate, RoomTransport } from "./transport";
export { RailwayConnectionError } from "./railway-transport";

export type BackendMode = "local" | "supabase" | "railway";

/**
 * Which backend this deployment is configured for.
 *
 * Decided once, from environment variables, and never revisited at runtime.
 * That is deliberate: a Railway deployment whose realtime server is unreachable
 * must fail loudly, not quietly hand the two of you separate rooms on your own
 * machines that look like they are working.
 */
export function backendMode(): BackendMode {
  if (process.env.NEXT_PUBLIC_WS_URL) return "railway";
  if (isSupabaseConfigured()) return "supabase";
  return "local";
}

/** Where the realtime server lives. Public by nature — it is a URL. */
export function realtimeUrl(): string | null {
  return process.env.NEXT_PUBLIC_WS_URL ?? null;
}

export interface TransportOptions {
  /** The seat this browser holds in the room. Required by the hosted backends. */
  playerId?: string;
}

/**
 * Chooses the transport for this deployment.
 *
 * There is no fallback between modes. If Railway is configured and something is
 * wrong with it, the error surfaces — the alternative is two people each in a
 * private room, each convinced the other is not joining.
 */
export function createTransport(code: string, options: TransportOptions = {}): RoomTransport {
  const mode = backendMode();

  if (mode === "railway") {
    const wsUrl = realtimeUrl();
    if (!wsUrl) {
      throw new Error("NEXT_PUBLIC_WS_URL is set but empty; the realtime server has no address.");
    }
    if (!options.playerId) {
      throw new Error("The Railway transport needs the player id for this seat.");
    }
    return new RailwayRoomTransport(code, { playerId: options.playerId, wsUrl });
  }

  if (mode === "supabase") {
    const client = getSupabaseClient();
    if (client) return new SupabaseRoomTransport(client, code);
  }

  return new LocalRoomTransport(code);
}

export function realtimeBackendName(): BackendMode {
  return backendMode();
}
