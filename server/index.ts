/**
 * The Railway service: Next.js and the realtime server in one process.
 *
 * Decision C. Two services would isolate them from each other, at roughly twice
 * the cost of the smallest deployment this is likely to have. They share a
 * port, a session secret and a database pool; splitting them later is an
 * environment variable and a `railway.json`, because the browser reaches the
 * socket through `NEXT_PUBLIC_WS_URL` rather than by assuming same-origin.
 *
 * Started by `npm start` in production. In development `next dev` runs on its
 * own and this runs alongside it — see `npm run dev:railway`.
 */
import { createServer } from "node:http";
import next from "next";
import { attachRealtime, shutdownRealtime } from "@/lib/server/ws/server";
import { shutdownDatabase, waitForDatabase } from "@/lib/server/db/lifecycle";
import { databaseConfigured } from "@/lib/server/config";
import { validateEnvironment } from "@/lib/server/env";
import { assertRestrictedRole } from "@/lib/server/db/role-check";
import { setRuntimeStatus } from "@/lib/server/runtime-status";
import { log } from "@/lib/server/log";

const port = Number(process.env.PORT ?? 3000);
const hostname = process.env.HOSTNAME ?? "0.0.0.0";
const dev = process.env.NODE_ENV !== "production";

async function main() {
  // Before anything else. A bad configuration should stop the deploy rather
  // than pass a health check and fail on the first person to open a room.
  const env = validateEnvironment();
  log.info("boot.environment", { mode: env.mode, storage: env.storage });
  for (const warning of env.warnings) log.warn("boot.warning", { warning });

  // Migrations run before the first request, and before the health check can
  // pass — Railway holds traffic on the previous deployment until it does, so a
  // failed migration does not take the site down.
  if (databaseConfigured()) {
    try {
      const { migrate } = await import("../db/migrate.mjs");
      // The owner connection, when there is one. The runtime connection is a
      // restricted role that deliberately cannot run DDL.
      const applied = await migrate(
        process.env.MIGRATE_DATABASE_URL ?? process.env.DATABASE_URL,
      );
      setRuntimeStatus({ migrations: "ready" });
      log.info("boot.migrated", { applied: applied.length });
    } catch (error) {
      setRuntimeStatus({ migrations: "failed" });
      throw error;
    }

    // The migration ran on the owner connection. This is the first use of the
    // one that will serve traffic, and it may be a moment behind.
    const attempts = await waitForDatabase();
    if (attempts > 1) log.info("boot.database-waited", { attempts });

    // Whether the schema is right matters less than what the application is
    // allowed to do to it. In production a privileged connection stops the
    // deploy here, while Railway is still serving the previous one.
    const role = await assertRestrictedRole();
    log[role.restricted ? "info" : "warn"]("boot.database-role", {
      role: role.role,
      restricted: role.restricted,
      ...(role.restricted ? {} : { reasons: role.reasons }),
    });
  } else {
    setRuntimeStatus({ migrations: "ready" });
    log.info("boot.local-mode", { reason: "no DATABASE_URL" });
  }

  const app = next({ dev, hostname, port });
  await app.prepare();
  const handle = app.getRequestHandler();

  const server = createServer((req, res) => {
    void handle(req, res);
  });

  // Mounted on the same server, so the upgrade carries the same cookies the
  // page was served with. That is what makes the session work without the
  // browser having to set a header it is not allowed to set.
  if (databaseConfigured()) {
    attachRealtime(server, "/ws");
    log.info("boot.realtime", { path: "/ws" });
  } else {
    log.info("boot.realtime-skipped", { reason: "no database" });
  }

  await new Promise<void>((resolve) => server.listen(port, hostname, resolve));
  log.info("boot.ready", { hostname, port });

  /**
   * Railway ends a deployment with SIGTERM. Clients are told before their
   * sockets close so they reconnect to the new instance rather than sitting on
   * a dead one waiting for a timeout.
   */
  let closing = false;
  const stop = async (signal: string) => {
    if (closing) return;
    closing = true;
    log.info("shutdown.begin", { signal });

    /*
     * Railway sends SIGTERM and then SIGKILL some seconds later. Everything
     * below is best-effort within that window: `server.close()` waits for
     * in-flight requests, and a keep-alive connection that never sends another
     * request would otherwise hold it open until the platform kills us — which
     * turns an orderly shutdown into a hard one. So it gets a deadline.
     */
    const deadline = Number(process.env.SHUTDOWN_TIMEOUT_MS ?? 10_000);
    const timer = setTimeout(() => {
      log.warn("shutdown.forced", { afterMs: deadline });
      process.exit(0);
    }, deadline);
    timer.unref();

    await shutdownRealtime("The server is restarting — reconnecting shortly").catch(() => {});
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await shutdownDatabase().catch(() => {});
    await app.close?.().catch(() => {});

    clearTimeout(timer);
    log.info("shutdown.complete", { signal });
    process.exit(0);
  };

  process.on("SIGTERM", () => void stop("SIGTERM"));
  process.on("SIGINT", () => void stop("SIGINT"));
}

main().catch((error) => {
  // The only thing worse than failing to start is starting anyway. Railway
  // holds traffic on the previous deployment while this exits non-zero.
  log.error("boot.failed", { error });
  process.exit(1);
});
