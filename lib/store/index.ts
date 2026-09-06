"use client";

import { uid } from "@/lib/utils";
import type {
  CompletionRecord,
  CoupleProfile,
  GiftPage,
  Goal,
  Letter,
  Memory,
  ScrapbookItem,
  StoredPhotoStrip,
  StudioDesign,
} from "./types";

/**
 * Local-first persistence.
 *
 * Everything the product saves outside a live room goes through this module.
 * It writes to localStorage today; each collection maps 1:1 onto a table in
 * `supabase/schema.sql`, so swapping in the hosted store is a change here and
 * nowhere else. Reads are synchronous by design — the UI never shows a spinner
 * for data that is already on the device.
 */

const KEYS = {
  strips: "together:strips",
  scrapbook: "together:scrapbook",
  letters: "together:letters",
  gifts: "together:gifts",
  memories: "together:memories",
  couple: "together:couple",
  goals: "together:goals",
  designs: "together:designs",
  completions: "together:completions",
  favourites: "together:favourite-cards",
} as const;

type Key = (typeof KEYS)[keyof typeof KEYS];

const CHANGE_EVENT = "together:store-change";

function read<T>(key: Key, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: Key, value: T) {
  if (typeof window === "undefined") return value;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: key }));
  } catch (err) {
    // Images push localStorage over quota quickly; surface it rather than
    // silently losing someone's photo strip.
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("together:store-error", {
          detail: err instanceof Error ? err.message : "Storage is full.",
        }),
      );
    }
  }
  return value;
}

export function onStoreChange(handler: () => void) {
  if (typeof window === "undefined") return () => {};
  const listener = () => handler();
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

// --- Photo strips ------------------------------------------------------------

export function listStrips() {
  return read<StoredPhotoStrip[]>(KEYS.strips, []);
}

export function saveStrip(strip: Omit<StoredPhotoStrip, "id" | "createdAt">) {
  const record: StoredPhotoStrip = { ...strip, id: uid("strip_"), createdAt: new Date().toISOString() };
  write(KEYS.strips, [record, ...listStrips()].slice(0, 40));
  return record;
}

export function deleteStrip(id: string) {
  write(KEYS.strips, listStrips().filter((s) => s.id !== id));
}

// --- Scrapbook ---------------------------------------------------------------

export function listScrapbook() {
  return read<ScrapbookItem[]>(KEYS.scrapbook, []);
}

export function addScrapbookItem(item: Omit<ScrapbookItem, "id" | "createdAt" | "tilt">) {
  const record: ScrapbookItem = {
    ...item,
    id: uid("scrap_"),
    createdAt: new Date().toISOString(),
    tilt: Math.round((Math.random() * 5 - 2.5) * 10) / 10,
  };
  write(KEYS.scrapbook, [record, ...listScrapbook()].slice(0, 60));
  return record;
}

export function updateScrapbookItem(id: string, patch: Partial<ScrapbookItem>) {
  write(
    KEYS.scrapbook,
    listScrapbook().map((item) => (item.id === id ? { ...item, ...patch } : item)),
  );
}

export function deleteScrapbookItem(id: string) {
  write(KEYS.scrapbook, listScrapbook().filter((i) => i.id !== id));
}

// --- Letters -----------------------------------------------------------------

export function listLetters() {
  return read<Letter[]>(KEYS.letters, []);
}

export function saveLetter(letter: Omit<Letter, "id" | "createdAt" | "openedAt">) {
  const record: Letter = {
    ...letter,
    id: uid("letter_"),
    createdAt: new Date().toISOString(),
    openedAt: null,
  };
  write(KEYS.letters, [record, ...listLetters()]);
  return record;
}

export function openLetter(id: string) {
  write(
    KEYS.letters,
    listLetters().map((l) => (l.id === id ? { ...l, openedAt: new Date().toISOString() } : l)),
  );
}

export function deleteLetter(id: string) {
  write(KEYS.letters, listLetters().filter((l) => l.id !== id));
}

/** A letter unseals at the start of its delivery day in the reader's timezone. */
export function isDeliverable(letter: Letter) {
  return isOnOrBeforeToday(letter.deliverOn);
}

export function isOnOrBeforeToday(dateOnly: string) {
  if (!dateOnly) return true;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly);
  const target = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime()
    : new Date(dateOnly).getTime();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return target <= today;
}

// --- Gift pages --------------------------------------------------------------

export function listGifts() {
  return read<GiftPage[]>(KEYS.gifts, []);
}

export function getGift(id: string) {
  return listGifts().find((g) => g.id === id) ?? null;
}

export function saveGift(gift: Omit<GiftPage, "id" | "createdAt">) {
  const record: GiftPage = { ...gift, id: uid("gift_"), createdAt: new Date().toISOString() };
  write(KEYS.gifts, [record, ...listGifts()]);
  return record;
}

export function updateGift(id: string, patch: Partial<GiftPage>) {
  write(KEYS.gifts, listGifts().map((g) => (g.id === id ? { ...g, ...patch } : g)));
}

export function deleteGift(id: string) {
  write(KEYS.gifts, listGifts().filter((g) => g.id !== id));
}

// --- Memories ----------------------------------------------------------------

export function listMemories() {
  return read<Memory[]>(KEYS.memories, []);
}

export function saveMemory(memory: Omit<Memory, "id" | "createdAt">) {
  const record: Memory = { ...memory, id: uid("mem_"), createdAt: new Date().toISOString() };
  write(KEYS.memories, [record, ...listMemories()].slice(0, 80));
  return record;
}

export function deleteMemory(id: string) {
  write(KEYS.memories, listMemories().filter((m) => m.id !== id));
}

// --- Couple profile ----------------------------------------------------------

const DEFAULT_COUPLE: CoupleProfile = {
  coupleName: "",
  partnerOneName: "",
  partnerTwoName: "",
  since: "",
  emoji: "🌿",
  note: "",
};

export function getCouple() {
  return read<CoupleProfile>(KEYS.couple, DEFAULT_COUPLE);
}

export function saveCouple(patch: Partial<CoupleProfile>) {
  return write(KEYS.couple, { ...getCouple(), ...patch });
}

// --- Goals -------------------------------------------------------------------

export function listGoals() {
  return read<Goal[]>(KEYS.goals, []);
}

export function addGoal(text: string) {
  const record: Goal = { id: uid("goal_"), text, done: false, createdAt: new Date().toISOString() };
  write(KEYS.goals, [record, ...listGoals()]);
  return record;
}

export function toggleGoal(id: string) {
  write(KEYS.goals, listGoals().map((g) => (g.id === id ? { ...g, done: !g.done } : g)));
}

export function deleteGoal(id: string) {
  write(KEYS.goals, listGoals().filter((g) => g.id !== id));
}

// --- Studio designs ----------------------------------------------------------

export function listDesigns() {
  return read<StudioDesign[]>(KEYS.designs, []);
}

export function saveDesign(design: Omit<StudioDesign, "id" | "createdAt">) {
  const record: StudioDesign = { ...design, id: uid("design_"), createdAt: new Date().toISOString() };
  write(KEYS.designs, [record, ...listDesigns()].slice(0, 20));
  return record;
}

export function deleteDesign(id: string) {
  write(KEYS.designs, listDesigns().filter((d) => d.id !== id));
}

// --- Favourite cards ---------------------------------------------------------

export function listFavouriteCards() {
  return read<string[]>(KEYS.favourites, []);
}

export function toggleFavouriteCard(cardId: string) {
  const current = listFavouriteCards();
  const next = current.includes(cardId)
    ? current.filter((c) => c !== cardId)
    : [cardId, ...current];
  write(KEYS.favourites, next);
  return next;
}

// --- Completions (drives the Connection Tree) --------------------------------

export function listCompletions() {
  return read<CompletionRecord[]>(KEYS.completions, []);
}

export function recordCompletion(experienceId: string) {
  const current = listCompletions();
  const existing = current.find((c) => c.experienceId === experienceId);
  const next = existing
    ? current.map((c) =>
        c.experienceId === experienceId
          ? { ...c, count: c.count + 1, lastAt: new Date().toISOString() }
          : c,
      )
    : [...current, { experienceId, count: 1, lastAt: new Date().toISOString() }];
  write(KEYS.completions, next);
  return next;
}

export function totalCompletions() {
  return listCompletions().reduce((sum, c) => sum + c.count, 0);
}

export function uniqueCompletions() {
  return listCompletions().length;
}
