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

/** Drains the pool so in-flight queries finish before the process goes. */
export async function shutdownDatabase(): Promise<void> {
  await endPool();
}
