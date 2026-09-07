import "server-only";
import { closePool as endPool, query } from "./pool";

/**
 * Process-lifecycle concerns, separated from data access on purpose.
 *
 * The custom server needs to shut the pool down on SIGTERM, and the health
 * check needs to know the database is answering. Neither is a query against
 * anything, and neither hands out a pool. Keeping them here rather than in
 * `pool.ts` means the access guard's rule — nothing outside the data layer
 * holds a pool reference — stays exactly as strict as it was, instead of
 * acquiring an exception for the one caller that had a good reason.
 */

/** One cheap round trip, to prove the database is answering. */
export async function pingDatabase(): Promise<boolean> {
  try {
    await query("select 1");
    return true;
  } catch {
    return false;
  }
}

/**
 * Waits for the database to accept a connection, within a bounded time.
 *
 * Railway starts the application and its Postgres as separate services and does
 * not order them. A container that boots while the database is still coming up
 * gets its first connection refused, exits, and — because the restart policy
 * has a retry limit — a deployment can fail for a reason that resolved itself
 * two seconds later.
 *
 * So the first connection is allowed to be retried, and only the first: once
 * the pool is answering, a later failure is a real failure and belongs in the
 * health check, not in a loop here.
 *
 * Returns how many attempts it took, or throws when the budget is spent.
 */
export async function waitForDatabase({
  attempts = Number(process.env.DB_CONNECT_ATTEMPTS ?? 10),
  delayMs = 300,
  maxDelayMs = 3_000,
}: { attempts?: number; delayMs?: number; maxDelayMs?: number } = {}): Promise<number> {
  let wait = delayMs;
  let last: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await query("select 1");
      return attempt;
    } catch (error) {
      last = error;
      if (attempt === attempts) break;
      await new Promise((resolve) => setTimeout(resolve, wait));
      wait = Math.min(wait * 2, maxDelayMs);
    }
  }

  throw new Error(
    `The database did not accept a connection after ${attempts} attempts: ${
      last instanceof Error ? last.message : String(last)
    }`,
  );
}

/** Drains the pool so in-flight queries finish before the process goes. */
export async function shutdownDatabase(): Promise<void> {
  await endPool();
}
