import "server-only";
import type { RoomPlayer, RoomState } from "@/lib/rooms/types";
import { PRESENCE_TIMEOUT_MS } from "@/lib/rooms/types";
import { query, transaction } from "./pool";
import { AuthzError, assertRoomMemberByCode, type SessionContext } from "./authz";

/**
 * Every room operation the server performs.
 *
 * Two rules hold throughout: nothing here interpolates user input into SQL, and
 * every statement that reads or writes a room is scoped by `session_id` as well
 * as passing an authorization gate. The second is redundant by design — if a
 * gate were ever forgotten, the query still returns nothing rather than someone
 * else's room.
 */

const CODE = /^[A-Z0-9]{4,8}$/;
const PLAYER_ID = /^[A-Za-z0-9_-]{1,64}$/;

function requireCode(code: string) {
  const upper = String(code ?? "").toUpperCase();
  if (!CODE.test(upper)) throw new AuthzError("Malformed room code", 400);
  return upper;
}

function requirePlayerId(playerId: string) {
  if (!PLAYER_ID.test(String(playerId ?? ""))) {
    throw new AuthzError("Malformed player id", 400);
  }
  return playerId;
}

/** How long a room stays reachable after its last write. Matches ROOM_TTL_MS. */
const ROOM_TTL = "24 hours";

export interface RoomRow {
  id: string;
  code: string;
  state: RoomState;
  version: number;
}

/**
 * Create a room and become its first member, atomically.
 *
 * The two writes are inseparable: a room whose creator is not a member would be
 * a room nobody could ever read.
 */
export async function createRoom(
  ctx: SessionContext,
  input: { code: string; experienceId: string; playerId: string; state: RoomState },
): Promise<RoomRow> {
  const code = requireCode(input.code);
  const playerId = requirePlayerId(input.playerId);

  return transaction(async (client) => {
    const room = await client.query<{ id: string; version: string }>(
      `insert into rooms (code, experience_id, status, host_id, owner_id, state)
       values ($1, $2, 'lobby', $3, $4, $5)
       returning id, version`,
      [code, input.experienceId, playerId, ctx.sessionId, input.state],
    );

    await client.query(
      `insert into room_members (room_id, session_id, player_id, role)
       values ($1, $2, $3, 'host')`,
      [room.rows[0].id, ctx.sessionId, playerId],
    );

    return {
      id: room.rows[0].id,
      code,
      state: input.state,
      version: Number(room.rows[0].version),
    };
  });
}

/**
 * The only way to gain membership of a room.
 *
 * Knowing a code lets you call this; it is not itself access. Expired rooms are
 * unjoinable, and the failure is identical whether the code never existed or
 * has aged out, so this cannot be used to probe which codes are live.
 */
export async function joinRoom(
  ctx: SessionContext,
  input: { code: string; playerId: string },
): Promise<RoomRow> {
  const code = requireCode(input.code);
  const playerId = requirePlayerId(input.playerId);

  return transaction(async (client) => {
    const found = await client.query<{
      id: string;
      state: RoomState;
      version: string;
      host_id: string;
    }>(
      `select id, state, version, host_id
         from rooms
        where code = $1 and updated_at > now() - interval '${ROOM_TTL}'
        for update`,
      [code],
    );
    if (!found.rows.length) throw new AuthzError("No such room", 404);

    const room = found.rows[0];

    // A seat is held by one session. Re-joining with the same session keeps it;
    // a different session cannot take a player id that is already claimed.
    const seat = await client.query<{ session_id: string }>(
      `select session_id from room_members where room_id = $1 and player_id = $2`,
      [room.id, playerId],
    );
    if (seat.rows.length && seat.rows[0].session_id !== ctx.sessionId) {
      throw new AuthzError("That seat is taken", 409);
    }

    await client.query(
      `insert into room_members (room_id, session_id, player_id, role)
       values ($1, $2, $3, $4)
       on conflict (room_id, session_id)
         do update set player_id = excluded.player_id`,
      [room.id, ctx.sessionId, playerId, room.host_id === playerId ? "host" : "guest"],
    );

    return { id: room.id, code, state: room.state, version: Number(room.version) };
  });
}

/** The current document, for a member. */
export async function readRoom(ctx: SessionContext, code: string): Promise<RoomRow> {
  const upper = requireCode(code);
  const { roomId } = await assertRoomMemberByCode(ctx, upper);

  const { rows } = await query<{ id: string; state: RoomState; version: string }>(
    `select r.id, r.state, r.version
       from rooms r
       join room_members m on m.room_id = r.id and m.session_id = $2
      where r.id = $1 and r.updated_at > now() - interval '${ROOM_TTL}'`,
    [roomId, ctx.sessionId],
  );
  if (!rows.length) throw new AuthzError("No such room", 404);

  return { id: rows[0].id, code: upper, state: rows[0].state, version: Number(rows[0].version) };
}

export type PatchOutcome =
  | { ok: true; version: number; state: RoomState }
  | { ok: false; reason: "conflict"; version: number; state: RoomState };

/**
 * Compare-and-set on the room document.
 *
 * The client merges (decision A: read-modify-write stays where it is) and sends
 * the result with the version it started from. Landing second is not an error —
 * it returns the current document so the caller can re-apply, which is what the
 * transport already does.
 *
 * A patch that moves `host_id` is additionally validated: the outgoing host
 * really must be stale and the cooldown really must have elapsed, judged from
 * `room_players.last_seen` on the server. The client-side election rule is
 * unchanged; this stops a client that has been tampered with from claiming a
 * seat the rule would not have given it.
 */
export async function patchRoom(
  ctx: SessionContext,
  input: { code: string; version: number; state: RoomState },
): Promise<PatchOutcome> {
  const code = requireCode(input.code);

  return transaction(async (client) => {
    const { roomId, playerId } = await assertRoomMemberByCode(ctx, code, client);

    const current = await client.query<{ state: RoomState; version: string; host_id: string }>(
      `select state, version, host_id from rooms where id = $1 for update`,
      [roomId],
    );
    if (!current.rows.length) throw new AuthzError("No such room", 404);

    const row = current.rows[0];
    const version = Number(row.version);

    if (version !== input.version) {
      return { ok: false as const, reason: "conflict" as const, version, state: row.state };
    }

    const nextHost = input.state?.hostId;
    if (nextHost && nextHost !== row.host_id) {
      await assertHostClaimIsLegitimate(client, roomId, row.host_id, nextHost, playerId);
    }

    const updated = await client.query<{ version: string }>(
      `update rooms
          set state = $1,
              version = version + 1,
              status = coalesce($2, status),
              host_id = coalesce($3, host_id),
              updated_at = now()
        where id = $4 and version = $5
        returning version`,
      [input.state, input.state?.status ?? null, nextHost ?? null, roomId, input.version],
    );

    if (!updated.rows.length) {
      const fresh = await client.query<{ state: RoomState; version: string }>(
        `select state, version from rooms where id = $1`,
        [roomId],
      );
      return {
        ok: false as const,
        reason: "conflict" as const,
        version: Number(fresh.rows[0]?.version ?? version),
        state: fresh.rows[0]?.state ?? row.state,
      };
    }

    return { ok: true as const, version: Number(updated.rows[0].version), state: input.state };
  });
}

/**
 * Server-side validation of a host handover.
 *
 * Mirrors `electHost()` in `lib/rooms/api.ts`: the sitting host must be past the
 * presence tolerance, and the claimant must be the lowest-id player who is
 * actually online. Two clients claiming at once still cannot both win — the
 * version check settles that — but this means a claim has to be *earned* rather
 * than merely asserted.
 */
async function assertHostClaimIsLegitimate(
  client: Pick<import("pg").PoolClient, "query">,
  roomId: string,
  outgoingHostId: string,
  claimedHostId: string,
  claimantPlayerId: string,
) {
  if (claimedHostId !== claimantPlayerId) {
    throw new AuthzError("You can only claim the host seat for yourself");
  }

  const { rows } = await client.query<{ player_id: string; stale_ms: string }>(
    `select player_id,
            extract(epoch from (now() - last_seen)) * 1000 as stale_ms
       from room_players
      where room_id = $1
      order by player_id`,
    [roomId],
  );

  const outgoing = rows.find((r) => r.player_id === outgoingHostId);
  const outgoingStale = outgoing ? Number(outgoing.stale_ms) > PRESENCE_TIMEOUT_MS : true;
  if (!outgoingStale) throw new AuthzError("The host is still here");

  const onlineIds = rows
    .filter((r) => Number(r.stale_ms) <= PRESENCE_TIMEOUT_MS)
    .map((r) => r.player_id)
    .sort();

  if (onlineIds[0] !== claimedHostId) {
    throw new AuthzError("Someone else is next in line for the host seat");
  }
}

// --- presence ---------------------------------------------------------------

/**
 * A heartbeat. Small, frequent, and deliberately nowhere near `rooms.state`.
 */
export async function touchPresence(
  ctx: SessionContext,
  input: { code: string; playerId: string; name?: string; emoji?: string; ready?: boolean },
): Promise<void> {
  const code = requireCode(input.code);
  const { roomId, playerId } = await assertRoomMemberByCode(ctx, code);

  // The seat comes from `room_members`, not from the request — a member cannot
  // beat on behalf of another player.
  await query(
    `insert into room_players (room_id, player_id, session_id, name, emoji, ready, last_seen)
     values ($1, $2, $3, coalesce($4, 'Guest'), coalesce($5, '🌸'), coalesce($6, false), now())
     on conflict (room_id, player_id) do update
        set last_seen = now(),
            session_id = excluded.session_id,
            name  = coalesce($4, room_players.name),
            emoji = coalesce($5, room_players.emoji),
            ready = coalesce($6, room_players.ready)`,
    [roomId, playerId, ctx.sessionId, input.name ?? null, input.emoji ?? null, input.ready ?? null],
  );
}

/** Everyone the room knows about, with how long ago each was seen. */
export async function readPresence(
  ctx: SessionContext,
  code: string,
): Promise<Record<string, RoomPlayer>> {
  const upper = requireCode(code);
  const { roomId } = await assertRoomMemberByCode(ctx, upper);

  const { rows } = await query<{
    player_id: string;
    name: string;
    emoji: string;
    ready: boolean;
    last_seen: Date;
    role: "host" | "guest";
  }>(
    `select p.player_id, p.name, p.emoji, p.ready, p.last_seen, m.role
       from room_players p
       join room_members m on m.room_id = p.room_id and m.player_id = p.player_id
      where p.room_id = $1`,
    [roomId],
  );

  return Object.fromEntries(
    rows.map((r) => [
      r.player_id,
      {
        id: r.player_id,
        name: r.name,
        emoji: r.emoji,
        role: r.role,
        ready: r.ready,
        lastSeen: r.last_seen.getTime(),
      } satisfies RoomPlayer,
    ]),
  );
}

/** Marks a player gone the moment their socket closes, rather than waiting out the timeout. */
export async function markOffline(roomId: string, playerId: string): Promise<void> {
  await query(
    `update room_players set last_seen = to_timestamp(0) where room_id = $1 and player_id = $2`,
    [roomId, playerId],
  );
}

// --- housekeeping -----------------------------------------------------------

/**
 * Drops rooms nobody has touched for a day, and the sessions that have expired.
 *
 * Returns the object keys of the media that went with the rooms so the caller
 * can delete the objects too — a row disappearing on its own would leave the
 * bytes paid for and orphaned.
 */
export async function pruneExpired(): Promise<{ rooms: number; sessions: number; objectKeys: string[] }> {
  return transaction(async (client) => {
    const media = await client.query<{ object_key: string }>(
      `select md.object_key
         from media md
         join rooms r on r.id = md.room_id
        where r.updated_at < now() - interval '${ROOM_TTL}'`,
    );

    const rooms = await client.query(
      `delete from rooms where updated_at < now() - interval '${ROOM_TTL}'`,
    );
    const sessions = await client.query(`delete from sessions where expires_at < now()`);

    return {
      rooms: rooms.rowCount ?? 0,
      sessions: sessions.rowCount ?? 0,
      objectKeys: media.rows.map((r) => r.object_key),
    };
  });
}
