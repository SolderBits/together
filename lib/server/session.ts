import "server-only";
import { cookies } from "next/headers";
import { createSession, loadSession, touchSession } from "./db/sessions";
import type { SessionContext } from "./db/authz";
import { SESSION_COOKIE, cookieOptions, mintToken, verifyToken } from "./session-token";
import { sessionFromCookieHeader } from "./session-cookie";

/**
 * Anonymous guest sessions, as the request layer sees them.
 *
 * Replaces Supabase's `signInAnonymously()`. Same guest experience — nobody is
 * ever asked for anything — but the token is stronger in one specific way: the
 * Supabase session lived in `localStorage`, readable and writable by any script
 * on the page. This one is an HttpOnly cookie, so client JavaScript cannot read
 * it, and neither can an XSS payload.
 *
 * Two independent things must hold for a request to be authorized:
 *
 *   1. the JWT signature verifies — the token was minted here, unaltered;
 *   2. the session row still exists and has not expired — the identity is live.
 *
 * The second matters: a signature alone would keep working for thirty days
 * after the row was swept or revoked.
 */

export { SESSION_COOKIE, cookieOptions, mintToken, verifyToken };
export { sessionFromCookieHeader };

/**
 * The caller's identity, or null.
 *
 * Both checks run. This is the only function route handlers should use to find
 * out who is asking — nothing reads a session id out of a request body.
 */
export async function currentSession(): Promise<SessionContext | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const sessionId = await verifyToken(token);
  if (!sessionId) return null;

  const row = await loadSession(sessionId);
  if (!row) return null;

  // Sliding expiry, throttled to once a minute inside the query itself.
  void touchSession(sessionId).catch(() => {});

  return { sessionId };
}

/**
 * The caller's identity, minting one if they do not have it yet.
 *
 * Returns the token when a new session was created so the caller can set the
 * cookie — route handlers can set cookies, but the `cookies()` store is
 * read-only in a Server Component, so this hands the decision back up.
 */
export async function currentOrNewSession(): Promise<{
  ctx: SessionContext;
  freshToken: string | null;
}> {
  const existing = await currentSession();
  if (existing) return { ctx: existing, freshToken: null };

  const row = await createSession();
  return { ctx: { sessionId: row.id }, freshToken: await mintToken(row.id) };
}

