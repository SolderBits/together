import "server-only";

/**
 * Configuration checked once, at startup, before anything claims to be ready.
 *
 * The alternative is what this replaces: a secret validated lazily on first use,
 * so a deployment with a missing or short `SESSION_SECRET` boots happily, passes
 * its health check, accepts traffic, and fails on the first person who tries to
 * open a room. A configuration mistake should stop the deploy, not become an
 * incident an hour later.
 *
 * Railway holds traffic on the previous deployment until the new one is
 * healthy, so refusing to start is the safe failure here.
 */

export class ConfigurationError extends Error {
  constructor(readonly problems: string[]) {
    super(`Configuration is not usable:\n  - ${problems.join("\n  - ")}`);
    this.name = "ConfigurationError";
  }
}

export interface EnvReport {
  mode: "local" | "hosted";
  storage: "r2" | "local-disk";
  warnings: string[];
}

/**
 * Throws when the process cannot safely serve. Returns what it will do when it
 * can — including the things that are legal but worth saying out loud.
 */
/** Hosts that mean "this machine", which in a browser is never this server. */
const LOOPBACK = /\b(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|host\.docker\.internal)\b/;

export function validateEnvironment(env = process.env): EnvReport {
  const problems: string[] = [];
  const warnings: string[] = [];

  const hosted = Boolean(env.DATABASE_URL);

  if (hosted) {
    const secret = env.SESSION_SECRET ?? "";
    if (!secret) {
      problems.push("SESSION_SECRET is not set. Generate one with: openssl rand -hex 32");
    } else if (secret.length < 32) {
      problems.push(`SESSION_SECRET is ${secret.length} characters; 32 is the minimum.`);
    }

    const previous = env.SESSION_SECRET_PREVIOUS;
    if (previous && previous.length < 32) {
      problems.push("SESSION_SECRET_PREVIOUS is set but too short to have signed anything.");
    }
    if (previous && previous === env.SESSION_SECRET) {
      warnings.push("SESSION_SECRET_PREVIOUS matches the current secret, so rotation is a no-op.");
    }

    if (!/^postgres(ql)?:\/\//.test(env.DATABASE_URL ?? "")) {
      problems.push("DATABASE_URL does not look like a postgres:// connection string.");
    }

    if (!env.NEXT_PUBLIC_WS_URL) {
      warnings.push(
        "NEXT_PUBLIC_WS_URL is unset, so the browser will not use the Railway transport " +
          "even though this server is running one.",
      );
    } else if (env.NODE_ENV === "production" && env.NEXT_PUBLIC_WS_URL.startsWith("ws://")) {
      problems.push(
        "NEXT_PUBLIC_WS_URL uses ws:// in production. An unencrypted socket would carry the " +
          "session cookie in the clear; use wss://.",
      );
    }
  }

  /*
   * A public URL pointing at the machine that built it.
   *
   * This is the mistake that survives every review, because it is correct
   * everywhere except production: the value works on the developer's laptop,
   * passes every test, deploys cleanly, and then every visitor's browser tries
   * to open a socket to their own computer.
   */
  if (env.NODE_ENV === "production") {
    for (const name of ["NEXT_PUBLIC_WS_URL", "NEXT_PUBLIC_SITE_URL"] as const) {
      const value = env[name];
      if (value && LOOPBACK.test(value)) {
        problems.push(
          `${name} points at ${value.match(LOOPBACK)?.[0]}, which in production is each ` +
            "visitor's own machine rather than this server. Use the deployment's public host.",
        );
      }
    }
  }

  // R2 is all-or-nothing: three of four is a deployment that will write photos
  // to a container's disk and lose them on the next deploy, silently.
  const r2 = [
    ["R2_ACCOUNT_ID", env.R2_ACCOUNT_ID],
    ["R2_ACCESS_KEY_ID", env.R2_ACCESS_KEY_ID],
    ["R2_SECRET_ACCESS_KEY", env.R2_SECRET_ACCESS_KEY],
    ["R2_BUCKET", env.R2_BUCKET],
  ] as const;
  const present = r2.filter(([, v]) => Boolean(v));

  if (present.length && present.length < r2.length) {
    problems.push(
      `Object storage is half-configured: ${r2
        .filter(([, v]) => !v)
        .map(([k]) => k)
        .join(", ")} missing.`,
    );
  }

  const storage = present.length === r2.length ? ("r2" as const) : ("local-disk" as const);
  if (hosted && storage === "local-disk" && env.NODE_ENV === "production") {
    warnings.push(
      "No object storage configured, so photos are written to this container's disk and are " +
        "lost on every deploy. Set the R2_* variables before anyone relies on them.",
    );
  }

  // A secret that leaked into a client-visible name is worse than a missing one.
  for (const key of Object.keys(env)) {
    if (!key.startsWith("NEXT_PUBLIC_")) continue;
    if (/SECRET|PASSWORD|PRIVATE|SERVICE_ROLE|ACCESS_KEY|DATABASE_URL|TOKEN/i.test(key)) {
      problems.push(`${key} would ship a secret to the browser. Rename it without NEXT_PUBLIC_.`);
    }
  }

  if (problems.length) throw new ConfigurationError(problems);
  // Loud, every boot, because a deployment left in this state has no database
  // privilege separation and nothing else will say so.
  if (env.DB_ROLE_ENFORCEMENT === "warn" && env.NODE_ENV === "production") {
    warnings.push(
      "DB_ROLE_ENFORCEMENT=warn — the application will start even on a privileged " +
        "database connection. This is for local rehearsal only; unset it for a real deployment.",
    );
  }

  return { mode: hosted ? "hosted" : "local", storage, warnings };
}
