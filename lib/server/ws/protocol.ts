/**
 * The wire protocol, and the validator that stands in front of it.
 *
 * No Next.js or database import, so the parser can be tested on its own — a
 * validator that is only exercised through a working client is a validator that
 * has never seen a hostile message.
 *
 * The rule this file exists to enforce: **nothing is acted on before it has been
 * through `parseClientMessage`.** Everything arriving on a socket is a string of
 * unknown provenance until then, and several fields a client might send are
 * deliberately *not* in these types at all — session id, room membership, host
 * status, the room's version as an authority, and any timestamp. Those come from
 * the server's own state, never from the sender.
 */

/** Refuses a message before it is parsed. A Draw Together round is the largest
 *  legitimate patch; photos go to object storage and never come through here. */
export const MAX_MESSAGE_BYTES = 256 * 1024;

/**
 * The largest `data:` URL allowed inside an event payload.
 *
 * Photobooth's live camera preview is a 7 KB frame every 700 ms and is genuinely
 * ephemeral — round-tripping it through object storage would be absurd. A
 * captured photo is 300–400 KB and belongs in R2 with only its id on the wire.
 * This is the line between the two, enforced here rather than trusted to the
 * client to respect.
 */
export const MAX_DATA_URL_BYTES = 16 * 1024;

export const MAX_EVENT_TYPE_LENGTH = 48;

/** Messages per second, per connection, before the socket is closed. */
export const RATE_LIMIT_PER_SECOND = 40;
export const RATE_LIMIT_BURST = 80;

export const CODE_PATTERN = /^[A-Z0-9]{4,8}$/;
export const PLAYER_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const EVENT_TYPE_PATTERN = /^[a-z][a-z0-9]*(:[a-z0-9-]+)*$/;

// --- client → server --------------------------------------------------------

export type ClientMessage =
  | { t: "subscribe"; code: string; playerId: string }
  | { t: "unsubscribe"; code: string }
  | { t: "patch"; code: string; playerId: string; version: number; state: Record<string, unknown> }
  | { t: "event"; code: string; playerId: string; eventType: string; payload: unknown }
  | {
      t: "presence";
      code: string;
      playerId: string;
      name?: string;
      emoji?: string;
      ready?: boolean;
    }
  | { t: "ping" };

// --- server → client --------------------------------------------------------

export type ServerMessage =
  | { t: "hello"; sessionId: string }
  | { t: "state"; code: string; version: number; state: Record<string, unknown> }
  | { t: "event"; code: string; eventType: string; payload: unknown; from: string; id: string }
  | { t: "conflict"; code: string; version: number; state: Record<string, unknown> }
  | { t: "denied"; code?: string; reason: string }
  | { t: "error"; reason: string }
  | { t: "closing"; reason: string }
  | { t: "pong" };

export type ParseResult =
  | { ok: true; message: ClientMessage }
  | { ok: false; reason: string; fatal?: boolean };

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function readCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const upper = raw.toUpperCase();
  return CODE_PATTERN.test(upper) ? upper : null;
}

function readPlayerId(raw: unknown): string | null {
  return typeof raw === "string" && PLAYER_ID_PATTERN.test(raw) ? raw : null;
}

/**
 * Walks a payload looking for anything oversized.
 *
 * Depth- and breadth-bounded so a deeply nested or very wide object cannot make
 * validation itself the denial of service. Returns the reason to reject, or null.
 */
function inspectPayload(value: unknown, depth = 0, seen = 0): { reason: string } | null {
  if (depth > 8) return { reason: "payload nested too deeply" };
  if (seen > 5_000) return { reason: "payload has too many values" };

  if (typeof value === "string") {
    if (value.startsWith("data:") && value.length > MAX_DATA_URL_BYTES) {
      return {
        reason:
          `inline media of ${Math.round(value.length / 1024)} KB — photos go to object ` +
          `storage and travel as an id, not through the socket`,
      };
    }
    return null;
  }

  if (Array.isArray(value)) {
    if (value.length > 2_000) return { reason: "payload array too long" };
    let count = seen;
    for (const item of value) {
      const bad = inspectPayload(item, depth + 1, ++count);
      if (bad) return bad;
    }
    return null;
  }

  if (isRecord(value)) {
    const keys = Object.keys(value);
    if (keys.length > 200) return { reason: "payload object has too many keys" };
    let count = seen;
    for (const key of keys) {
      if (key.length > 128) return { reason: "payload key too long" };
      const bad = inspectPayload(value[key], depth + 1, ++count);
      if (bad) return bad;
    }
    return null;
  }

  return null;
}

/**
 * Turns a raw frame into something safe to act on, or an explanation.
 *
 * `fatal` marks the cases where continuing to talk to this client is pointless:
 * a frame that is not even JSON, or one over the size cap.
 */
export function parseClientMessage(raw: string | Buffer): ParseResult {
  const bytes = typeof raw === "string" ? Buffer.byteLength(raw) : raw.length;
  if (bytes > MAX_MESSAGE_BYTES) {
    return {
      ok: false,
      fatal: true,
      reason: `message of ${Math.round(bytes / 1024)} KB exceeds the ${MAX_MESSAGE_BYTES / 1024} KB limit`,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(typeof raw === "string" ? raw : raw.toString("utf8"));
  } catch {
    return { ok: false, fatal: true, reason: "not JSON" };
  }

  if (!isRecord(parsed)) return { ok: false, reason: "expected an object" };
  const t = parsed.t;
  if (typeof t !== "string") return { ok: false, reason: "missing message type" };

  switch (t) {
    case "ping":
      return { ok: true, message: { t: "ping" } };

    case "subscribe": {
      const code = readCode(parsed.code);
      const playerId = readPlayerId(parsed.playerId);
      if (!code) return { ok: false, reason: "malformed room code" };
      if (!playerId) return { ok: false, reason: "malformed player id" };
      return { ok: true, message: { t: "subscribe", code, playerId } };
    }

    case "unsubscribe": {
      const code = readCode(parsed.code);
      if (!code) return { ok: false, reason: "malformed room code" };
      return { ok: true, message: { t: "unsubscribe", code } };
    }

    case "patch": {
      const code = readCode(parsed.code);
      const playerId = readPlayerId(parsed.playerId);
      if (!code) return { ok: false, reason: "malformed room code" };
      if (!playerId) return { ok: false, reason: "malformed player id" };

      // The version is the client's claim about what it derived its patch from.
      // The server compares it against its own row; it is never authoritative.
      if (typeof parsed.version !== "number" || !Number.isInteger(parsed.version) || parsed.version < 0) {
        return { ok: false, reason: "version must be a non-negative integer" };
      }
      if (!isRecord(parsed.state)) return { ok: false, reason: "state must be an object" };

      const bad = inspectPayload(parsed.state);
      if (bad) return { ok: false, reason: bad.reason };

      return {
        ok: true,
        message: { t: "patch", code, playerId, version: parsed.version, state: parsed.state },
      };
    }

    case "event": {
      const code = readCode(parsed.code);
      const playerId = readPlayerId(parsed.playerId);
      if (!code) return { ok: false, reason: "malformed room code" };
      if (!playerId) return { ok: false, reason: "malformed player id" };

      const eventType = parsed.eventType;
      if (
        typeof eventType !== "string" ||
        eventType.length > MAX_EVENT_TYPE_LENGTH ||
        !EVENT_TYPE_PATTERN.test(eventType)
      ) {
        return { ok: false, reason: "malformed event type" };
      }

      const bad = inspectPayload(parsed.payload);
      if (bad) return { ok: false, reason: bad.reason };

      return {
        ok: true,
        message: { t: "event", code, playerId, eventType, payload: parsed.payload },
      };
    }

    case "presence": {
      const code = readCode(parsed.code);
      const playerId = readPlayerId(parsed.playerId);
      if (!code) return { ok: false, reason: "malformed room code" };
      if (!playerId) return { ok: false, reason: "malformed player id" };

      // Cosmetic fields, so they are clamped rather than rejected — a long name
      // is a client bug, not an attack, and disconnecting over it is unkind.
      const name = typeof parsed.name === "string" ? parsed.name.slice(0, 40) : undefined;
      const emoji = typeof parsed.emoji === "string" ? [...parsed.emoji][0] : undefined;
      const ready = typeof parsed.ready === "boolean" ? parsed.ready : undefined;

      return { ok: true, message: { t: "presence", code, playerId, name, emoji, ready } };
    }

    default:
      return { ok: false, reason: `unknown message type "${t.slice(0, 32)}"` };
  }
}

/**
 * A token bucket, per connection.
 *
 * Refills continuously rather than resetting on a boundary, so a client cannot
 * get a double allowance by straddling one.
 */
export class RateLimiter {
  private tokens: number;
  private last: number;

  constructor(
    private readonly perSecond = RATE_LIMIT_PER_SECOND,
    private readonly burst = RATE_LIMIT_BURST,
    now = Date.now(),
  ) {
    this.tokens = burst;
    this.last = now;
  }

  take(now = Date.now()): boolean {
    this.tokens = Math.min(this.burst, this.tokens + ((now - this.last) / 1000) * this.perSecond);
    this.last = now;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}
