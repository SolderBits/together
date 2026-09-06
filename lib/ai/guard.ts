import type { JudgeRequest } from "./types";

/**
 * Everything that stands between a public endpoint and someone else's bill.
 *
 * The judging route has no session behind it — two people playing a game are
 * not asked to make an account — so the defences have to be structural rather
 * than identity-based: a hard cap on what a request may contain, and a limit on
 * how often one caller may make one.
 */

/** Well past a real filing (a few sentences) and far short of a prompt attack. */
export const MAX_BODY_BYTES = 16 * 1024;
export const MAX_SUBMISSIONS = 4;
export const MAX_FIELD_CHARS = 2_000;
export const MAX_TOPIC_CHARS = 300;
export const MAX_NAME_CHARS = 60;

export type Validated = { ok: true; value: JudgeRequest } | { ok: false; reason: string };

const trim = (value: unknown, limit: number) =>
  typeof value === "string" ? value.slice(0, limit).trim() : "";

/**
 * Rebuilds the request from scratch rather than checking the one we were sent.
 *
 * Nothing the caller supplies survives unless it is a field we know about, so
 * extra keys — a model name, a system prompt, a max_tokens — cannot ride along
 * into the upstream call. The client chooses the arguments, never the request.
 */
export function validateJudgeRequest(raw: unknown): Validated {
  if (typeof raw !== "object" || raw === null) return { ok: false, reason: "Expected an object." };
  const body = raw as Record<string, unknown>;

  const kind = body.kind === "court" ? "court" : "debate";

  const topic = trim(body.topic, MAX_TOPIC_CHARS);
  if (!topic) return { ok: false, reason: "A topic is required." };

  if (!Array.isArray(body.submissions) || body.submissions.length === 0) {
    return { ok: false, reason: "At least one submission is required." };
  }
  if (body.submissions.length > MAX_SUBMISSIONS) {
    return { ok: false, reason: "Too many submissions." };
  }

  const submissions = body.submissions.map((entry) => {
    const s = (typeof entry === "object" && entry !== null ? entry : {}) as Record<string, unknown>;
    return {
      playerId: trim(s.playerId, 64),
      name: trim(s.name, MAX_NAME_CHARS) || "Player",
      side: trim(s.side, MAX_NAME_CHARS),
      argument: trim(s.argument, MAX_FIELD_CHARS),
      evidence: trim(s.evidence, MAX_FIELD_CHARS) || undefined,
    };
  });

  if (submissions.every((s) => !s.argument)) {
    return { ok: false, reason: "At least one argument is required." };
  }

  return { ok: true, value: { kind, topic, submissions } };
}

// --------------------------------------------------------------- rate limit --

/**
 * A fixed-window counter, in memory.
 *
 * Honest about what it is: one process's view. On a single instance it stops
 * the loop that empties an API budget; across several it thins traffic rather
 * than capping it. Put a shared limiter in front before this endpoint carries
 * real spend — noted in the launch checklist.
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 12;
const MAX_TRACKED = 5_000;

const hits = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, now = Date.now()) {
  if (hits.size > MAX_TRACKED) {
    for (const [k, v] of hits) if (v.resetAt < now) hits.delete(k);
    if (hits.size > MAX_TRACKED) hits.clear();
  }

  const entry = hits.get(key);
  if (!entry || entry.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (entry.count >= MAX_PER_WINDOW) {
    return { allowed: false, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Only for tests — the counter is process-wide by design. */
export function resetRateLimit() {
  hits.clear();
}

/**
 * Who to count against.
 *
 * The forwarded-for header is spoofable, so this is a throttle rather than a
 * gate; the size caps above are what make an individual request cheap.
 */
export function callerKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  return ip.slice(0, 64);
}
