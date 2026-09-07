import "server-only";

/**
 * Structured logs, with the secrets taken out on the way through.
 *
 * Railway collects stdout and lets you search it, which is worth having in a
 * shape a machine can read — one JSON object per line, an event name, and
 * fields. In development that is unreadable at a glance, so it prints plainly
 * instead; the same call site produces both.
 *
 * The redaction is the point. Nothing here is written on the assumption that
 * every future caller will remember what is sensitive: values are scrubbed by
 * key name, by shape, and recursively, because the realistic way a token
 * reaches a log is not `log.info("token", token)` — it is an error object that
 * happens to carry a request, or a context object someone spread in whole.
 *
 * Errors are unwrapped to name, message and stack. A stack is safe to log; it
 * is only unsafe to *return*, and that is a different file.
 */

type Level = "debug" | "info" | "warn" | "error";

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const configured = (process.env.LOG_LEVEL ?? "info").toLowerCase();
const threshold = LEVELS[configured as Level] ?? LEVELS.info;

const pretty =
  process.env.NODE_ENV !== "production" && process.env.LOG_FORMAT !== "json";

/**
 * Field names whose values never appear, whatever they hold.
 *
 * Matched on the *words* in the name rather than the whole string, because real
 * field names are `secretAccessKey`, `r2Secret`, `apiKey` — an anchored pattern
 * catches `SESSION_SECRET` and sails straight past every one of them. Splitting
 * camelCase and checking word by word (and adjacent pairs, for `access key`)
 * catches the names people actually write, without redacting `monkey`.
 */
const SECRET_WORDS = new Set([
  "secret", "password", "passwd", "passphrase", "token", "cookie",
  "authorization", "auth", "credential", "credentials", "jwt", "signature",
  "sig", "dsn", "key", "bearer", "salt",
]);

const SECRET_PAIRS = new Set([
  "apikey", "accesskey", "secretkey", "privatekey", "signingkey",
  "databaseurl", "connectionstring", "sessiontoken", "accesstoken",
  "refreshtoken", "servicerole",
]);

function isSecretKey(name: string): boolean {
  const words = name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase());

  if (words.some((w) => SECRET_WORDS.has(w))) return true;
  for (let i = 0; i < words.length - 1; i++) {
    if (SECRET_PAIRS.has(words[i] + words[i + 1])) return true;
  }
  return false;
}

/** Value shapes that are secret wherever they turn up, under any field name. */
const SECRET_SHAPES: [RegExp, string][] = [
  // A signed URL is a bearer capability: logging one hands it to whoever reads
  // the log. Presigned R2 links and our own local ones both match.
  [/[?&](sig|signature|X-Amz-Signature|token)=[^&\s"']+/i, "[redacted-signed-url]"],
  [/postgres(ql)?:\/\/[^:\s]+:[^@\s]+@/i, "postgres://[redacted]@"],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+/, "[redacted-jwt]"],
  [/\bsk-ant-[A-Za-z0-9_-]{8,}/, "[redacted-api-key]"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/, "[redacted-key]"],
];

const REDACTED = "[redacted]";
const MAX_DEPTH = 6;
const MAX_STRING = 2_000;

function scrubString(value: string): string {
  let out = value;
  for (const [shape, replacement] of SECRET_SHAPES) out = out.replace(shape, replacement);
  return out.length > MAX_STRING ? `${out.slice(0, MAX_STRING)}…` : out;
}

function scrub(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return scrubString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "function") return "[function]";
  if (depth >= MAX_DEPTH) return "[deep]";

  if (value instanceof Error) {
    return {
      name: value.name,
      message: scrubString(value.message),
      // `pg` and `undici` attach useful codes; they are not secret.
      ...(typeof (value as unknown as { code?: unknown }).code === "string"
        ? { code: (value as unknown as { code: string }).code }
        : {}),
      stack: value.stack ? scrubString(value.stack) : undefined,
      ...(value.cause ? { cause: scrub(value.cause, depth + 1, seen) } : {}),
    };
  }

  if (typeof value === "object") {
    if (seen.has(value as object)) return "[circular]";
    seen.add(value as object);

    if (Array.isArray(value)) {
      return value.slice(0, 50).map((entry) => scrub(entry, depth + 1, seen));
    }

    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      out[key] = isSecretKey(key) ? REDACTED : scrub(entry, depth + 1, seen);
    }
    return out;
  }

  return String(value);
}

function emit(level: Level, event: string, fields: Record<string, unknown> = {}) {
  if (LEVELS[level] < threshold) return;

  const safe = scrub(fields) as Record<string, unknown>;
  const stream = level === "error" || level === "warn" ? console.error : console.log;

  if (pretty) {
    const rest = Object.keys(safe).length ? ` ${JSON.stringify(safe)}` : "";
    stream(`[${level}] ${event}${rest}`);
    return;
  }

  stream(JSON.stringify({ level, event, time: new Date().toISOString(), ...safe }));
}

export const log = {
  debug: (event: string, fields?: Record<string, unknown>) => emit("debug", event, fields),
  info: (event: string, fields?: Record<string, unknown>) => emit("info", event, fields),
  warn: (event: string, fields?: Record<string, unknown>) => emit("warn", event, fields),
  error: (event: string, fields?: Record<string, unknown>) => emit("error", event, fields),
};

/** Exported for the test that proves the redaction actually redacts. */
export const redactForTest = (value: unknown) => scrub(value);
