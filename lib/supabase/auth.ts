"use client";

import type { Session, User } from "@supabase/supabase-js";
import { getSupabaseClient, isSupabaseConfigured } from "./client";

export type AuthStatus = "unconfigured" | "loading" | "signed-out" | "signed-in";

export function authAvailable() {
  return isSupabaseConfigured();
}

export async function getSession(): Promise<Session | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session;
}

export function onAuthChange(handler: (user: User | null) => void) {
  const client = getSupabaseClient();
  if (!client) return () => {};
  const { data } = client.auth.onAuthStateChange((_event, session) => {
    handler(session?.user ?? null);
  });
  return () => data.subscription.unsubscribe();
}

/** Passwordless email sign-in. Returns an error message, or null on success. */
export async function signInWithEmail(email: string) {
  const client = getSupabaseClient();
  if (!client) return "Authentication isn't configured on this deployment.";
  const { error } = await client.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${window.location.origin}/profile` },
  });
  return error?.message ?? null;
}

export async function signInWithGoogle() {
  const client = getSupabaseClient();
  if (!client) return "Authentication isn't configured on this deployment.";
  const { error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/profile` },
  });
  return error?.message ?? null;
}

export async function signOut() {
  await getSupabaseClient()?.auth.signOut();
}
