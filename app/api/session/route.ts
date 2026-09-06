import { NextResponse } from "next/server";
import { createSession } from "@/lib/server/db/sessions";
import { databaseConfigured } from "@/lib/server/config";
import {
  SESSION_COOKIE,
  cookieOptions,
  currentSession,
  mintToken,
} from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
export async function POST() {
  if (!databaseConfigured()) {
    return NextResponse.json({ mode: "local" as const });
  }

  const existing = await currentSession();
  if (existing) {
    return NextResponse.json({ mode: "railway" as const, sessionId: existing.sessionId });
  }

  const row = await createSession();
  const token = await mintToken(row.id);

  const response = NextResponse.json({ mode: "railway" as const, sessionId: row.id });
  response.cookies.set(SESSION_COOKIE, token, cookieOptions());
  return response;
}

/** Whether this browser already holds a live session. Used by the transport factory. */
export async function GET() {
  if (!databaseConfigured()) return NextResponse.json({ mode: "local" as const });
  const session = await currentSession();
  return NextResponse.json(
    session
      ? { mode: "railway" as const, sessionId: session.sessionId }
      : { mode: "railway" as const, sessionId: null },
  );
}
