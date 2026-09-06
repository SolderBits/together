"use client";

import type { PlayerIdentity } from "./types";
import { uid } from "@/lib/utils";

const PROFILE_KEY = "together:identity";
const PLAYER_ID_KEY = "together:player-id";

const EMOJIS = ["🌸", "🫧", "🌿", "⭐️", "🍓", "🦋", "🌙", "🍯", "🐚", "🧁", "🪴", "🎈"];
const NAMES = [
  "Sunny", "Pebble", "Maple", "Clover", "Juno", "Wren",
  "Nova", "Sage", "Poppy", "Bay", "Fig", "Cove",
];

function randomFrom<T>(list: readonly T[]) {
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * The player id lives in sessionStorage, not localStorage, for two reasons:
 * it survives a refresh (so you reconnect to your own seat in a room), but two
 * tabs of the same browser get different ids — which is what makes testing a
 * two-player room on one machine actually work.
 *
 * The display name and emoji stay in localStorage so editing your profile
 * applies everywhere.
 */
function readPlayerId(): string {
  try {
    const existing = window.sessionStorage.getItem(PLAYER_ID_KEY);
    if (existing) return existing;
    const created = uid("p_");
    window.sessionStorage.setItem(PLAYER_ID_KEY, created);
    return created;
  } catch {
    // Private mode or storage disabled — fall back to a per-load id.
    return uid("p_");
  }
}

function readProfile(): { name: string; emoji: string } {
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PlayerIdentity>;
      if (parsed?.name && parsed?.emoji) return { name: parsed.name, emoji: parsed.emoji };
    }
  } catch {
    /* fall through */
  }
  const profile = { name: randomFrom(NAMES), emoji: randomFrom(EMOJIS) };
  try {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    /* ignore */
  }
  return profile;
}

/** A stable identity so people can join a room without an account. */
export function getIdentity(): PlayerIdentity {
  if (typeof window === "undefined") {
    return { id: "server", name: "You", emoji: "🌸" };
  }
  return { id: readPlayerId(), ...readProfile() };
}

export function saveIdentity(identity: PlayerIdentity) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      PROFILE_KEY,
      JSON.stringify({ name: identity.name, emoji: identity.emoji }),
    );
    window.dispatchEvent(new CustomEvent("together:identity", { detail: identity }));
  } catch {
    /* ignore */
  }
}

export function updateIdentity(patch: Partial<PlayerIdentity>) {
  const next = { ...getIdentity(), ...patch };
  saveIdentity(next);
  return next;
}

export const IDENTITY_EMOJIS = EMOJIS;
