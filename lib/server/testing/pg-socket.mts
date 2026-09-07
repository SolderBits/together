/**
 * A real Postgres wire-protocol socket for tests, on a port that is actually free.
 *
 * Every suite here runs PGlite behind a socket so the real `pg` driver executes
 * the real data layer. Each used to pick a random port from its own band and
 * hope — which fails roughly one run in a couple of hundred, and a gate that
 * fails occasionally for reasons unrelated to the code is worse than no gate,
 * because the next real failure gets waved through as "that flake again".
 *
 * So: ask the operating system for a free port rather than guessing one, and
 * retry if something takes it in the gap between letting go and binding.
 */
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import type { PGlite } from "@electric-sql/pglite";

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address() as AddressInfo;
      probe.close(() => resolve(port));
    });
  });
}

export interface PgSocket {
  server: PGLiteSocketServer;
  port: number;
  url: string;
}

/** Starts the socket server and returns the connection string to point at it. */
export async function startPgSocket(db: PGlite, attempts = 5): Promise<PgSocket> {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const port = await freePort();
    const server = new PGLiteSocketServer({ db, port, host: "127.0.0.1" });
    try {
      await server.start();
      return {
        server,
        port,
        // Local, and therefore not a credential: this is how PGlite ships.
        url: `postgres://postgres:postgres@127.0.0.1:${port}/postgres`,
      };
    } catch (error) {
      lastError = error;
      await server.stop().catch(() => {});
    }
  }

  throw new Error(
    `Could not bind a Postgres socket after ${attempts} attempts: ${String(lastError)}`,
  );
}
