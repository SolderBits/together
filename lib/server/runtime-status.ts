import "server-only";

/**
 * What this process has actually managed to start.
 *
 * The health endpoint needs to answer for the realtime server and the
 * migrations, and it cannot ask them directly: `server/index.ts` is bundled by
 * esbuild while the route handlers are compiled by Next, so each has its own
 * copy of every module. Importing `realtimeStats()` into the route would report
 * on a second, idle instance that no socket was ever attached to — reliably
 * saying "no realtime" while realtime works perfectly.
 *
 * A symbol on `globalThis` crosses that boundary, because there is only one
 * process. Written by whoever performs the step, read by whoever reports on it.
 */

export type RealtimeStatus = "off" | "listening" | "stopping";
export type MigrationStatus = "pending" | "ready" | "failed";

export interface RuntimeStatus {
  /** Whether the WebSocket server is attached and accepting upgrades. */
  realtime: RealtimeStatus;
  /** Whether schema migrations completed. Nothing should serve traffic before. */
  migrations: MigrationStatus;
  /** For uptime in the health payload. */
  startedAt: number;
}

const KEY = Symbol.for("together.runtime.status");

type Holder = { [KEY]?: RuntimeStatus };

function store(): RuntimeStatus {
  const holder = globalThis as Holder;
  holder[KEY] ??= {
    // Deliberately pessimistic. A process that never reported in is not a
    // process that is fine — it is one that has not got there yet.
    realtime: "off",
    migrations: "pending",
    startedAt: Date.now(),
  };
  return holder[KEY];
}

export function runtimeStatus(): Readonly<RuntimeStatus> {
  return { ...store() };
}

export function setRuntimeStatus(patch: Partial<RuntimeStatus>): void {
  Object.assign(store(), patch);
}

/** Only for tests, which drive several boot sequences in one process. */
export function resetRuntimeStatus(): void {
  delete (globalThis as Holder)[KEY];
}
