import "server-only";
import type pg from "pg";
import { query } from "./pool";

/**
 * The authorization gates that replace the 38 RLS policies.
 *
 * RLS had a property application code does not get for free: forget a filter
 * and it returns nothing rather than everything. These four predicates are the
 * same ones the policies expressed — `is_room_member`, `is_room_host`,
 * ownership, couple membership — lifted into one module, so that losing that
 * property costs as little as possible:
 *
 *   1. Every gate throws. There is no boolean anyone can accidentally ignore.
 *   2. Every room query in `rooms.ts` *also* joins on the session id, so even a
 *      missing gate returns no rows rather than another room's.
 *   3. `scripts/check-db-access.mjs` fails the build if anything outside
 *      `lib/server/db/` imports the pool.
 *   4. The security suite tests the endpoints, not these helpers, so a
 *      forgotten gate fails a test rather than only a review.
 */

export class AuthzError extends Error {
  readonly status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.name = "AuthzError";
    this.status = status;
  }
}

export class NotFoundError extends Error {
  readonly status = 404;
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

/** Who is asking. Established by the session layer; never taken from a request body. */
export interface SessionContext {
  sessionId: string;
}

type Queryable = Pick<pg.PoolClient, "query"> | null;

const run = async <T extends pg.QueryResultRow>(
  client: Queryable,
  text: string,
  params: readonly unknown[],
) => (client ? client.query<T>(text, params as unknown[]) : query<T>(text, params));

/**
 * Membership of a room, by room id.
 *
 * Returns the caller's seat so callers that need the player id do not make a
 * second round trip and risk checking one thing and acting on another.
 */
export async function assertRoomMember(
  ctx: SessionContext,
  roomId: string,
  client: Queryable = null,
): Promise<{ playerId: string; role: "host" | "guest" }> {
  const { rows } = await run<{ player_id: string; role: "host" | "guest" }>(
    client,
    `select player_id, role from room_members where room_id = $1 and session_id = $2`,
    [roomId, ctx.sessionId],
  );
  if (!rows.length) {
    // Deliberately the same message a missing room gives, so this cannot be
    // used to discover which room ids exist.
    throw new AuthzError("No such room", 404);
  }
  return { playerId: rows[0].player_id, role: rows[0].role };
}

/** Membership by room code, for the paths that only have a code. */
export async function assertRoomMemberByCode(
  ctx: SessionContext,
  code: string,
  client: Queryable = null,
): Promise<{ roomId: string; playerId: string; role: "host" | "guest" }> {
  const { rows } = await run<{ room_id: string; player_id: string; role: "host" | "guest" }>(
    client,
    `select m.room_id, m.player_id, m.role
       from room_members m
       join rooms r on r.id = m.room_id
      where r.code = $1 and m.session_id = $2`,
    [code.toUpperCase(), ctx.sessionId],
  );
  if (!rows.length) throw new AuthzError("No such room", 404);
  return { roomId: rows[0].room_id, playerId: rows[0].player_id, role: rows[0].role };
}

/**
 * The caller holds the host seat *right now*, according to the room document
 * rather than according to anything they said.
 */
export async function assertRoomHost(
  ctx: SessionContext,
  roomId: string,
  client: Queryable = null,
): Promise<{ playerId: string }> {
  const { rows } = await run<{ player_id: string }>(
    client,
    `select m.player_id
       from room_members m
       join rooms r on r.id = m.room_id
      where m.room_id = $1 and m.session_id = $2 and r.host_id = m.player_id`,
    [roomId, ctx.sessionId],
  );
  if (!rows.length) throw new AuthzError("Only the host can do that");
  return { playerId: rows[0].player_id };
}

/** Ownership of a row in a table this module names — never a caller-supplied table. */
const OWNED_TABLES = ["rooms", "media"] as const;
export type OwnedTable = (typeof OWNED_TABLES)[number];

export async function assertOwner(
  ctx: SessionContext,
  table: OwnedTable,
  rowId: string,
  client: Queryable = null,
): Promise<void> {
  // The table name cannot come from user input: it is constrained to this
  // union at compile time and re-checked here, because an interpolated
  // identifier is the one thing a parameterised query cannot protect.
  if (!OWNED_TABLES.includes(table)) throw new AuthzError("Unknown resource", 400);
  const column = table === "rooms" ? "owner_id" : "session_id";

  const { rows } = await run<{ ok: boolean }>(
    client,
    `select true as ok from ${table} where id = $1 and ${column} = $2`,
    [rowId, ctx.sessionId],
  );
  if (!rows.length) throw new AuthzError("No such resource", 404);
}

/**
 * Access to one media object.
 *
 * The check is membership of *the room the media belongs to*, read from the
 * row — not membership of a room the caller names. That is what stops a signed
 * URL for another room's photo being obtainable by asking nicely.
 */
export async function assertMediaAccess(
  ctx: SessionContext,
  mediaId: string,
  client: Queryable = null,
): Promise<{ objectKey: string; roomId: string; contentType: string }> {
  const { rows } = await run<{ object_key: string; room_id: string; content_type: string }>(
    client,
    `select md.object_key, md.room_id, md.content_type
       from media md
       join room_members m on m.room_id = md.room_id and m.session_id = $2
      where md.id = $1`,
    [mediaId, ctx.sessionId],
  );
  if (!rows.length) throw new NotFoundError("No such media");
  return {
    objectKey: rows[0].object_key,
    roomId: rows[0].room_id,
    contentType: rows[0].content_type,
  };
}
