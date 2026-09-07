import { NextResponse } from "next/server";
import { createSession } from "@/lib/server/db/sessions";
import { databaseConfigured } from "@/lib/server/config";
import { SESSION_COOKIE, cookieOptions, mintToken } from "@/lib/server/session-token";
import { sessionFromRequest } from "@/lib/server/session-cookie";
import { BUDGETS, callerKey, rateLimit, tooManyRequests } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Nothing about a session may sit in a shared cache. */
const NO_STORE = { "cache-control": "no-store, max-age=0" } as const;

/**
 * Establishes a guest identity.
 *
 * Called once by the client before it opens a room. No body, no fields, nothing
 * to fill in — that is the point. The response carries an HttpOnly cookie the
 * page itself cannot read, which is what every later authorization check is
 * made against.
 *
 * With no database configured this reports `local`, and the app carries on with
 * `LocalRoomTransport` exactly as before.
 */
export async function POST(request: Request) {
  if (!databaseConfigured()) {
    return NextResponse.json({ mode: "local" as const }, { headers: NO_STORE });
  }

  const existing = await sessionFromRequest(request);

  // Counted only when a session would actually be created. A browser that
  // already has one can ask as often as it likes; a script that wants ten
  // thousand rows cannot.
  if (!existing) {
    const verdict = rateLimit("session", callerKey(request), BUDGETS.session);
    if (!verdict.allowed) return tooManyRequests(verdict, "sessions started");
  }
  if (existing) {
    return NextResponse.json(
      { mode: "railway" as const, sessionId: existing.sessionId },
      { headers: NO_STORE },
    );
  }

  const row = await createSession();
  const token = await mintToken(row.id);

  const response = NextResponse.json(
    { mode: "railway" as const, sessionId: row.id },
    { headers: NO_STORE },
  );
  response.cookies.set(SESSION_COOKIE, token, cookieOptions());
  return response;
}

/** Whether this browser already holds a live session. Used by the transport factory. */
export async function GET(request: Request) {
  if (!databaseConfigured()) {
    return NextResponse.json({ mode: "local" as const }, { headers: NO_STORE });
  }
  const session = await sessionFromRequest(request);
  return NextResponse.json(
    { mode: "railway" as const, sessionId: session?.sessionId ?? null },
    { headers: NO_STORE },
  );
}
