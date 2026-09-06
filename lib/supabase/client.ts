"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Supabase is entirely optional. When the env vars are missing every caller
 * falls back to the local (browser-only) implementation, so the product stays
 * fully usable with no backend configured.
 */
export function isSupabaseConfigured() {
  return Boolean(url && anonKey);
}

let cached: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!cached) cached = createBrowserClient(url!, anonKey!);
  return cached;
}

let signingIn: Promise<SupabaseClient | null> | null = null;

/**
 * A client that is guaranteed to have an identity.
 *
 * Guests never make an account, but the row level security policies need an
 * `auth.uid()` to check membership against — "knowing the room code" is not
 * something a policy can see. An anonymous session gives every visitor a real
 * user id at no cost to them: no email, no password, nothing to remember.
 *
 * Signing in is idempotent and shared, so a burst of callers on first load
 * produces one session rather than several.
 */
export async function getAuthedSupabaseClient(): Promise<SupabaseClient | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  const { data } = await client.auth.getSession();
  if (data.session) return client;

  signingIn ??= (async () => {
    const { error } = await client.auth.signInAnonymously();
    if (error) {
      // Anonymous sign-in is a project setting; if it is off, say so clearly
      // rather than letting every later query fail with an opaque RLS denial.
      console.error(
        "Supabase anonymous sign-in failed. Enable it under Authentication → Providers, " +
          "or rooms will not be reachable.",
        error.message,
      );
      return null;
    }
    return client;
  })();

  try {
    return await signingIn;
  } finally {
    signingIn = null;
  }
}
