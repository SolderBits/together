import "server-only";
import pg from "pg";

/**
 * The only connection pool in the application.
 *
 * `server-only` makes importing this from a client component a build error
 * rather than a code review. Nothing outside `lib/server/db/` may import it —
 * `scripts/check-db-access.mjs` fails the test run if anything does, which is
 * the structural half of replacing RLS: authorization cannot be forgotten if
 * there is only one door and it is always locked.
 */

declare global {
  // Next.js reloads modules in dev; without this each reload leaks a pool.
  // eslint-disable-next-line no-var
  var __togetherPool: pg.Pool | undefined;
}

function create(): pg.Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. The Railway backend needs it; without it the app " +
        "runs in local mode and nothing should be reaching the database.",
    );
  }

  return new pg.Pool({
    connectionString,
    ssl: /localhost|127\.0\.0\.1/.test(connectionString)
      ? false
      : { rejectUnauthorized: false },
    // Railway Postgres allows a modest number of connections and one process
    // serves both HTTP and WebSocket traffic; a small pool that queues is
    // better than a large one that exhausts the server.
    max: Number(process.env.PGPOOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}

export function pool(): pg.Pool {
  if (!globalThis.__togetherPool) globalThis.__togetherPool = create();
  return globalThis.__togetherPool;
}

/**
 * Closes the pool.
 *
 * Called on SIGTERM so in-flight queries finish before the process goes, and by
 * tests so the driver is not still holding a socket when the database it was
 * talking to is torn down.
 */
export async function closePool(): Promise<void> {
  const existing = globalThis.__togetherPool;
  if (!existing) return;
  globalThis.__togetherPool = undefined;
  await existing.end().catch(() => {});
}

/**
 * A parameterised query. There is no variant that takes interpolated SQL, and
 * `text` is only ever a literal written in this directory — user input reaches
 * Postgres exclusively through `params`.
 */
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: readonly unknown[] = [],
): Promise<pg.QueryResult<T>> {
  return pool().query<T>(text, params as unknown[]);
}

/**
 * Runs `fn` inside a transaction, rolling back on any throw.
 *
 * Used wherever a check and the write it authorises must not be separable —
 * joining a room, claiming the host seat, compare-and-set on room state.
 */
export async function transaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {
      /* the connection is already gone; the transaction died with it */
    }
    throw error;
  } finally {
    client.release();
  }
}
