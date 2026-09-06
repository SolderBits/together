import { NextResponse } from "next/server";
import type { RoomState } from "@/lib/rooms/types";
import { databaseConfigured } from "@/lib/server/config";
import { AuthzError } from "@/lib/server/db/authz";
import { createRoom, joinRoom, readRoom } from "@/lib/server/db/rooms";
import {
  SESSION_COOKIE,
  cookieOptions,
  currentOrNewSession,
} from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 512 * 1024;

/**
 * Create a room, or join one.
 *
 * Membership has to exist before a socket can subscribe, and a WebSocket
 * upgrade is a poor place to do a write — so this is the one HTTP step in an
 * otherwise realtime flow. It is also the only place a client's own player id
 * is accepted, and even here it is bound to the session rather than believed:
 * a seat already held by another browser is refused.
 */
export async function POST(request: Request) {
  if (!databaseConfigured()) {
    return NextResponse.json({ error: "This deployment has no hosted backend." }, { status: 501 });
  }

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "That request is too large." }, { status: 413 });
  }

  let body: unknown;
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "That request is too large." }, { status: 413 });
    }
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Expected an object." }, { status: 400 });
  }
  const input = body as Record<string, unknown>;

  const code = typeof input.code === "string" ? input.code.toUpperCase() : "";
  const playerId = typeof input.playerId === "string" ? input.playerId : "";
  const experienceId = typeof input.experienceId === "string" ? input.experienceId.slice(0, 64) : "";
  const asHost = input.asHost === true;

  // Session first: everything below is scoped to it, and a first-time visitor
  // needs one minted before they can own anything.
  const { ctx, freshToken } = await currentOrNewSession();

  const respond = (payload: unknown, status = 200) => {
    const response = NextResponse.json(payload, { status });
    if (freshToken) response.cookies.set(SESSION_COOKIE, freshToken, cookieOptions());
    return response;
  };

  try {
    // Joining is tried first even for a host: a refresh re-enters the room it
    // created rather than colliding with itself on the unique code.
    try {
      const joined = await joinRoom(ctx, { code, playerId });
      return respond({ code: joined.code, state: joined.state, version: joined.version });
    } catch (error) {
      const missing = error instanceof AuthzError && error.status === 404;
      if (!missing || !asHost) throw error;
    }

    if (!input.state || typeof input.state !== "object") {
      return respond({ error: "A new room needs its initial state." }, 400);
    }

    const created = await createRoom(ctx, {
      code,
      experienceId,
      playerId,
      state: input.state as RoomState,
    });
    return respond({ code: created.code, state: created.state, version: created.version });
  } catch (error) {
    if (error instanceof AuthzError) {
      return respond({ error: error.message }, error.status);
    }
    // A unique-violation means someone took the code between the join attempt
    // and the insert. Read it back rather than reporting an internal error.
    if ((error as { code?: string }).code === "23505") {
      try {
        const existing = await readRoom(ctx, code);
        return respond({ code: existing.code, state: existing.state, version: existing.version });
      } catch {
        return respond({ error: "That room code is taken." }, 409);
      }
    }
    console.error("[api/rooms] failed", error);
    return respond({ error: "Something went wrong." }, 500);
  }
}
