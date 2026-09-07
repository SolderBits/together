import "server-only";

/**
 * Per-caller request limits.
 *
 * Every write endpoint here creates something that costs money or space — a
 * session row, a room, a presigned URL, an object in storage — and none of them
 * required an account, by design. Without a ceiling, one script can fill the
 * database and the bucket, and the first sign of it is the bill.
 *
 * A fixed window refills continuously rather than resetting on a boundary, so a
 * caller cannot get a double allowance by straddling one.
 *
 * Honest about what it is: one process's view. On a single Railway service that
 * is the whole picture; behind several replicas it thins traffic rather than
 * capping it, and a shared store is the fix. That trade is recorded in the
 * launch notes rather than hidden here.
 */

export interface Budget {
  /** Requests allowed per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

/**
 * Deliberately generous for the things a real pair of players do repeatedly,
 * and tight on the things they do once.
 */
export const BUDGETS = {
  /** A browser needs one. A script wants thousands. */
  session: { limit: 20, windowMs: 60_000 },
  /** Creating or joining: a handful per minute is already unusual. */
  room: { limit: 30, windowMs: 60_000 },
  /** Ten photos a Photobooth session, twice over, plus retries. */
  media: { limit: 60, windowMs: 60_000 },
  /** Reading media back: every partner photo, on every reconnect. */
  mediaRead: { limit: 240, windowMs: 60_000 },
} as const satisfies Record<string, Budget>;

interface Entry {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Entry>();
const MAX_TRACKED = 20_000;

export interface RateVerdict {
  allowed: boolean;
  retryAfterSeconds: number;
}

export function rateLimit(bucket: string, key: string, budget: Budget, now = Date.now()): RateVerdict {
  // Sweep before growing. An unbounded map is its own denial of service.
  if (buckets.size > MAX_TRACKED) {
    for (const [k, v] of buckets) if (v.resetAt < now) buckets.delete(k);
    if (buckets.size > MAX_TRACKED) buckets.clear();
  }

  const id = `${bucket}:${key}`;
  const entry = buckets.get(id);

  if (!entry || entry.resetAt < now) {
    buckets.set(id, { count: 1, resetAt: now + budget.windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (entry.count >= budget.limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Only for tests, which exercise several budgets in one process. */
export function resetRateLimits() {
  buckets.clear();
}

/**
 * Who to count against.
 *
 * The session where there is one, because that is the closest thing to an
 * identity here and it survives a changing IP. Otherwise the forwarded address,
 * which is spoofable — so this is a throttle, not a gate. What makes an
 * individual request cheap is the size caps beside it.
 */
export function callerKey(request: Request, sessionId?: string | null): string {
  if (sessionId) return `s:${sessionId}`;
  const forwarded = request.headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  return `ip:${ip.slice(0, 64)}`;
}

/** The 429 every route returns, so the shape is identical everywhere. */
export function tooManyRequests(verdict: RateVerdict, what: string): Response {
  return new Response(JSON.stringify({ error: `Too many ${what}. Give it a moment.` }), {
    status: 429,
    headers: {
      "content-type": "application/json",
      "retry-after": String(verdict.retryAfterSeconds),
      "cache-control": "no-store",
    },
  });
}
