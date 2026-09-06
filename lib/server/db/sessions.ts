import "server-only";
import { query } from "./pool";

/**
 * Storage for anonymous guest sessions.
 *
 * The signing and cookie handling live in `lib/server/session.ts`; this is only
 * the row. Keeping them apart means the token format can change without
 * touching the database, and it keeps the signing secret out of the data layer
 * entirely.
 *
 * A session row holds nothing about the person. The display name and emoji stay
 * in the browser, as they always have — the row exists so the server can answer
 * one question: is this token still valid, and whose is it.
 */

export interface SessionRow {
  id: string;
  expiresAt: Date;
}

/** Mints a new guest identity. No input, because there is nothing to ask for. */
export async function createSession(): Promise<SessionRow> {
  const { rows } = await query<{ id: string; expires_at: Date }>(
    `insert into sessions default values returning id, expires_at`,
  );
  return { id: rows[0].id, expiresAt: rows[0].expires_at };
}

/**
 * Confirms a session still exists and has not expired.
 *
 * The JWT signature proves the token was minted by us; this proves the session
 * behind it has not since been swept or revoked. Both are required — a signature
 * alone would keep working for thirty days after the row was deleted.
 */
export async function loadSession(id: string): Promise<SessionRow | null> {
  if (!isUuid(id)) return null;
  const { rows } = await query<{ id: string; expires_at: Date }>(
    `select id, expires_at from sessions where id = $1 and expires_at > now()`,
    [id],
  );
  return rows.length ? { id: rows[0].id, expiresAt: rows[0].expires_at } : null;
}

/**
 * Slides the window forward on an active session.
 *
 * Rate-limited to once a minute per session: this runs on every request, and a
 * write per request would be the busiest query in the system for no benefit.
 */
export async function touchSession(id: string): Promise<void> {
  if (!isUuid(id)) return;
  await query(
    `update sessions
        set last_seen_at = now(),
            expires_at = now() + interval '30 days'
      where id = $1 and last_seen_at < now() - interval '1 minute'`,
    [id],
  );
}

export async function deleteSession(id: string): Promise<void> {
  if (!isUuid(id)) return;
  await query(`delete from sessions where id = $1`, [id]);
}

/**
 * Guards the parameter before it reaches Postgres.
 *
 * The query is parameterised, so this is not an injection defence — it is to
 * avoid a `22P02 invalid input syntax for uuid` on every request carrying a
 * malformed cookie, which would turn a bad token into a 500 rather than a
 * silent re-issue.
 */
function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value ?? "");
}
