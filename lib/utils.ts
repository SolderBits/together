export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/** Room codes deliberately skip 0/O/1/I so they can be read aloud. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateRoomCode(length = 6) {
  let out = "";
  const bytes = randomBytes(length);
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

export function randomBytes(n: number): Uint8Array {
  const arr = new Uint8Array(n);
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < n; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return arr;
}

export function uid(prefix = "") {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return prefix + crypto.randomUUID();
  }
  return prefix + Array.from(randomBytes(16), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function normalizeCode(input: string) {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function shuffle<T>(items: readonly T[], seed?: number): T[] {
  const out = items.slice();
  let rand = seed === undefined ? Math.random : mulberry32(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Deterministic PRNG so both players derive identical content from a shared seed. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Picks `count` items from `pool` deterministically for a given seed string. */
export function pickDeterministic<T>(pool: readonly T[], count: number, seed: string): T[] {
  return shuffle(pool, hashString(seed)).slice(0, Math.min(count, pool.length));
}

export function formatDate(value: string | number | Date, opts?: Intl.DateTimeFormatOptions) {
  // Date-only strings are calendar dates, not UTC instants.
  const d =
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(localMidnight(value))
      : value instanceof Date
        ? value
        : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, opts ?? { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Whole-calendar-day difference in local time.
 *
 * Date-only strings ("2026-09-04") parse as UTC midnight, so a raw millisecond
 * difference reports "2 days ago" for yesterday west of Greenwich. Comparing
 * local midnights instead keeps the wording matching the calendar.
 */
function localMidnight(value: string | number | Date) {
  const d = value instanceof Date ? new Date(value) : new Date(value);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, day] = value.split("-").map(Number);
    return new Date(y, m - 1, day).getTime();
  }
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function relativeFromNow(iso: string) {
  const target = localMidnight(iso);
  if (Number.isNaN(target)) return "";
  const today = localMidnight(new Date());
  const days = Math.round((target - today) / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days > 0) {
    if (days < 30) return `in ${plural(days, "day")}`;
    if (days < 60) return "in about a month";
    if (days < 365) return `in ${plural(Math.round(days / 30), "month")}`;
    return `in ${approxYears(days)}`;
  }
  const ago = Math.abs(days);
  if (ago < 30) return `${plural(ago, "day")} ago`;
  if (ago < 60) return "about a month ago";
  if (ago < 365) return `${plural(Math.round(ago / 30), "month")} ago`;
  return `${approxYears(ago)} ago`;
}

/** "1 year" / "1.5 years" — never "1 years". */
function approxYears(days: number) {
  const years = days / 365;
  const rounded = Number(years.toFixed(years % 1 < 0.08 || years % 1 > 0.92 ? 0 : 1));
  return `${rounded} ${rounded === 1 ? "year" : "years"}`;
}

export function siteOrigin() {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API is unavailable over plain http on some browsers.
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand?.("copy") ?? false;
    el.remove();
    return ok;
  }
}

export function plural(n: number, one: string, many = one + "s") {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Pointer capture throws in some browsers when the pointer is no longer active
 * (and for synthetic events). Dragging must not break because of it.
 */
export function capturePointer(element: Element, pointerId: number) {
  try {
    (element as HTMLElement & { setPointerCapture(id: number): void }).setPointerCapture(pointerId);
  } catch {
    /* dragging still works without capture */
  }
}
