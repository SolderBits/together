import { isOnOrBeforeToday } from "@/lib/store";
import type { GiftPage } from "@/lib/store/types";

/**
 * Gift pages are shareable without a backend by carrying their own payload in
 * the URL fragment (never the query string, so it is not sent to any server).
 * Photos are dropped from the link when they would make the URL unusable.
 */
/**
 * Browsers and messaging apps truncate long URLs, and they do it silently — a
 * 1.5 MB link looked fine here and arrived broken. This is the size that
 * survives being pasted into a chat, so photos are dropped above it and the
 * sender is told they were.
 */
const MAX_HASH_BYTES = 28_000;

export type GiftPayload = Omit<GiftPage, "createdAt"> & { createdAt?: string };

function toBase64Url(input: string) {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(input: string) {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeGift(gift: GiftPage): { hash: string; photosIncluded: boolean } {
  const full = toBase64Url(JSON.stringify(gift));
  if (full.length <= MAX_HASH_BYTES) return { hash: full, photosIncluded: true };
  const slim = toBase64Url(JSON.stringify({ ...gift, photos: [] }));
  return { hash: slim, photosIncluded: false };
}

export function decodeGift(hash: string): GiftPage | null {
  try {
    const parsed = JSON.parse(fromBase64Url(hash)) as GiftPage;
    if (!parsed?.id || !parsed?.title) return null;
    return { ...parsed, createdAt: parsed.createdAt ?? new Date().toISOString() };
  } catch {
    return null;
  }
}

export function isRevealed(gift: Pick<GiftPage, "revealOn">) {
  if (!gift.revealOn) return true;
  return isOnOrBeforeToday(gift.revealOn);
}
