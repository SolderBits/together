/**
 * The whole Railway stack, on this machine, in one process.
 *
 *   npm run dev:railway
 *
 * Starts an in-process Postgres (PGlite behind its wire protocol, which `pg`
 * connects to exactly as it would to Railway), then boots the custom server —
 * Next.js and the realtime server together, the same entry point production
 * uses.
 *
 * One process on purpose: PGlite's socket server is happiest with a client in
 * the same process, and this is a development convenience, not a deployment.
 * Production talks to a real Postgres over TCP and never runs this file.
 */
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const pgPort = Number(process.env.DEV_PG_PORT ?? 54329);
const db = await PGlite.create({ extensions: { pgcrypto } });
const pgServer = new PGLiteSocketServer({ db, port: pgPort, host: "127.0.0.1" });
await pgServer.start();

process.env.DATABASE_URL ??= `postgres://postgres:postgres@127.0.0.1:${pgPort}/postgres`;
// PGlite serves one connection at a time.
process.env.PGPOOL_MAX = "1";
process.env.SESSION_SECRET ??= "dev".padEnd(64, "0");
process.env.PORT ??= "3100";
process.env.NEXT_PUBLIC_WS_URL ??= `ws://localhost:${process.env.PORT}/ws`;

console.log(`[dev] postgres on 127.0.0.1:${pgPort} (in-process)`);

await import("../server/index.ts");

const stop = async () => {
  await pgServer.stop().catch(() => {});
  await db.close().catch(() => {});
};
process.on("exit", stop);
