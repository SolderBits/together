"use client";

import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { LocalRoomTransport } from "./local-transport";
import { SupabaseRoomTransport } from "./supabase-transport";
import type { RoomTransport } from "./transport";

export { applyPatch } from "./transport";
export type { RoomTransport } from "./transport";

/** Chooses the hosted transport when configured, otherwise the browser one. */
export function createTransport(code: string): RoomTransport {
  const client = isSupabaseConfigured() ? getSupabaseClient() : null;
  if (client) return new SupabaseRoomTransport(client, code);
  return new LocalRoomTransport(code);
}

export function realtimeBackendName() {
  return isSupabaseConfigured() ? "supabase" : "local";
}
