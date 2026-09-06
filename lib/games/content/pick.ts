import { hashString, mulberry32, shuffle } from "@/lib/utils";

/**
 * Content selection helpers.
 *
 * Two modes, deliberately:
 *
 *  - **Deterministic** (`pickBalanced`, `pickSeeded`) for anything shown inside
 *    a room. Both clients derive the identical set from `state.seed`, so no
 *    content ever has to travel over the wire.
 *  - **Session-fresh** (`pickFresh`) for solo surfaces like Honest Cards and the
 *    Arcade, where the only requirement is "don't show me that again straight
 *    away". Recently-seen ids live in module memory for the tab's lifetime.
 */

export interface Identified {
  id: string;
}

const recentlySeen = new Map<string, string[]>();
const DEFAULT_MEMORY = 14;

/** Drops an id into the recent list for a bucket, trimming the tail. */
export function remember(bucket: string, id: string, memory = DEFAULT_MEMORY) {
  const list = recentlySeen.get(bucket) ?? [];
  const next = [id, ...list.filter((x) => x !== id)].slice(0, memory);
  recentlySeen.set(bucket, next);
}

export function recentIds(bucket: string) {
  return recentlySeen.get(bucket) ?? [];
}

export function forgetBucket(bucket: string) {
  recentlySeen.delete(bucket);
}

/**
 * One item that hasn't been seen lately. Falls back to the full pool once the
 * memory would leave nothing to choose from.
 */
export function pickFresh<T extends Identified>(pool: readonly T[], bucket: string): T | null {
  if (!pool.length) return null;
  const recent = new Set(recentIds(bucket));
  const fresh = pool.filter((item) => !recent.has(item.id));
  const source = fresh.length ? fresh : pool;
  const chosen = source[Math.floor(Math.random() * source.length)];
  remember(bucket, chosen.id, Math.min(DEFAULT_MEMORY, Math.max(4, Math.floor(pool.length / 2))));
  return chosen;
}

/** A shuffled run of `count` items, none seen recently, then remembered. */
export function pickFreshRun<T extends Identified>(
  pool: readonly T[],
  bucket: string,
  count: number,
): T[] {
  const recent = new Set(recentIds(bucket));
  const fresh = pool.filter((item) => !recent.has(item.id));
  const source = fresh.length >= count ? fresh : pool;
  const run = shuffle(source).slice(0, Math.min(count, source.length));
  run.forEach((item) => remember(bucket, item.id, Math.max(count * 2, DEFAULT_MEMORY)));
  return run;
}

/** Deterministic pick — identical output for identical seeds. */
export function pickSeeded<T>(pool: readonly T[], count: number, seed: string): T[] {
  return shuffle(pool, hashString(seed)).slice(0, Math.min(count, pool.length));
}

/**
 * Deterministic pick that spreads across categories instead of clumping.
 *
 * Walks the categories round-robin in a seeded order, taking one item from each
 * in turn, so a set of eight questions never comes back as eight "deep" ones.
 */
export function pickBalanced<T>(
  pool: readonly T[],
  count: number,
  seed: string,
  categoryOf: (item: T) => string,
  /** Categories listed here are drawn from first, in this order. */
  priority: readonly string[] = [],
): T[] {
  if (!pool.length) return [];

  const buckets = new Map<string, T[]>();
  pool.forEach((item) => {
    const key = categoryOf(item);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(item);
  });

  const rand = mulberry32(hashString(seed));
  buckets.forEach((items, key) => buckets.set(key, shuffle(items, hashString(`${seed}:${key}`))));

  const keys = Array.from(buckets.keys());
  const ordered = [
    ...priority.filter((k) => buckets.has(k)),
    ...shuffle(
      keys.filter((k) => !priority.includes(k)),
      hashString(`${seed}:order`),
    ),
  ];

  const out: T[] = [];
  let round = 0;
  while (out.length < count && round < 200) {
    let took = false;
    for (const key of ordered) {
      if (out.length >= count) break;
      const items = buckets.get(key)!;
      const item = items[round];
      if (item !== undefined) {
        out.push(item);
        took = true;
      }
    }
    if (!took) break;
    round += 1;
  }

  // Shuffle the final order so the category rotation isn't visible in play.
  return shuffle(out, Math.floor(rand() * 2 ** 31));
}

/**
 * Deterministic pick that follows a *shape*.
 *
 * Where `pickBalanced` spreads evenly, this walks a named sequence of
 * categories in order — so a round can warm up, get funny, get personal and
 * then land somewhere that matters, instead of arriving in random order.
 * Falls back to any unused item if a bucket runs dry.
 */
export function pickArc<T extends Identified>(
  pool: readonly T[],
  shape: readonly string[],
  seed: string,
  categoryOf: (item: T) => string,
): T[] {
  const buckets = new Map<string, T[]>();
  pool.forEach((item) => {
    const key = categoryOf(item);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(item);
  });
  buckets.forEach((items, key) =>
    buckets.set(key, shuffle(items, hashString(`${seed}:${key}`))),
  );

  const used = new Set<string>();
  const out: T[] = [];

  for (const slot of shape) {
    const bucket = buckets.get(slot) ?? [];
    const next = bucket.find((item) => !used.has(item.id));
    if (next) {
      used.add(next.id);
      out.push(next);
      continue;
    }
    // Bucket exhausted — take anything unused rather than dropping the slot.
    const fallback = shuffle(pool, hashString(`${seed}:fallback:${out.length}`)).find(
      (item) => !used.has(item.id),
    );
    if (fallback) {
      used.add(fallback.id);
      out.push(fallback);
    }
  }

  return out;
}

/** Weighted deterministic pick — heavier items appear more often. */
export function pickWeighted<T>(
  pool: readonly (T & { weight?: number })[],
  seed: string,
): T | null {
  if (!pool.length) return null;
  const total = pool.reduce((sum, item) => sum + (item.weight ?? 1), 0);
  const rand = mulberry32(hashString(seed));
  let ticket = rand() * total;
  for (const item of pool) {
    ticket -= item.weight ?? 1;
    if (ticket <= 0) return item;
  }
  return pool[pool.length - 1];
}

// --- named helpers, as documented ------------------------------------------

export const getRandomQuestion = <T extends Identified>(pool: readonly T[]) =>
  pickFresh(pool, "question");
export const getRandomCard = <T extends Identified>(pool: readonly T[]) =>
  pickFresh(pool, "card");
export const getRandomDare = <T extends Identified>(pool: readonly T[]) =>
  pickFresh(pool, "dare");
export const getRandomRiddle = <T extends Identified>(pool: readonly T[]) =>
  pickFresh(pool, "riddle");
export const getRandomTopic = <T extends Identified>(pool: readonly T[]) =>
  pickFresh(pool, "topic");
