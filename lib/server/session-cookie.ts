import "server-only";
import { loadSession } from "./db/sessions";
import type { SessionContext } from "./db/authz";
import { SESSION_COOKIE, verifyToken } from "./session-token";

/**
 * Reading a session from a raw `Cookie` header.
 *
 * Separate from `session.ts` because that module reaches for Next's request
 * context, and the WebSocket server has no such thing — it is handed a plain
 * Node `IncomingMessage` during the upgrade, long before any framework is
 * involved. Keeping the two apart also keeps Next out of the custom server's
 * bundle, which is where this split announced itself.
 *
 * Both checks still run: the signature proves the token is ours and unaltered,
 * and the row proves the session behind it is still live.
 */
/**
 * The caller's identity, taken from the request itself.
 *
 * Route handlers used the `cookies()` store, which only exists inside Next's
 * request scope — so they could not be called directly and their authorization
 * could only be tested through a running server. Reading the header off the
 * `Request` they were already handed makes each handler a plain function of its
 * input, which is both simpler and testable by attacking it.
 */
export async function sessionFromRequest(request: Request): Promise<SessionContext | null> {
  return sessionFromCookieHeader(request.headers.get("cookie") ?? undefined);
}

export async function sessionFromCookieHeader(
  header: string | undefined,
): Promise<SessionContext | null> {
  if (!header) return null;

  const token = header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);

  if (!token) return null;

  const sessionId = await verifyToken(decodeURIComponent(token));
  if (!sessionId) return null;

  const row = await loadSession(sessionId);
  return row ? { sessionId } : null;
}
