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
import { shutdownDatabase } from "@/lib/server/db/lifecycle";
import { databaseConfigured } from "@/lib/server/config";

const port = Number(process.env.PORT ?? 3000);
const hostname = process.env.HOSTNAME ?? "0.0.0.0";
const dev = process.env.NODE_ENV !== "production";

async function main() {
  // Migrations run before the first request, and before the health check can
  // pass — Railway holds traffic on the previous deployment until it does, so a
  // failed migration does not take the site down.
  if (databaseConfigured()) {
    const { migrate } = await import("../db/migrate.mjs");
    const applied = await migrate(
      process.env.MIGRATE_DATABASE_URL ?? process.env.DATABASE_URL,
    );
    console.log(
      applied.length
        ? `[boot] applied ${applied.length} migration(s)`
        : "[boot] database up to date",
    );
  } else {
    console.log("[boot] no DATABASE_URL — running in local mode, no hosted backend");
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
    console.log("[boot] realtime listening on /ws");
  } else {
    console.log("[boot] realtime not started — it needs a database");
  }

  await new Promise<void>((resolve) => server.listen(port, hostname, resolve));
  console.log(`[boot] ready on http://${hostname}:${port}`);

  /**
   * Railway ends a deployment with SIGTERM. Clients are told before their
   * sockets close so they reconnect to the new instance rather than sitting on
   * a dead one waiting for a timeout.
   */
  let closing = false;
  const stop = async (signal: string) => {
    if (closing) return;
    closing = true;
    console.log(`[shutdown] ${signal}`);

    await shutdownRealtime("The server is restarting — reconnecting shortly").catch(() => {});
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await shutdownDatabase();
    await app.close?.().catch(() => {});
    process.exit(0);
  };

  process.on("SIGTERM", () => void stop("SIGTERM"));
  process.on("SIGINT", () => void stop("SIGINT"));
}

main().catch((error) => {
  console.error("[boot] failed to start", error);
  process.exit(1);
});
