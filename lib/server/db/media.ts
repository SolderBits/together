import "server-only";
import { query, transaction } from "./pool";
import { AuthzError, assertMediaAccess, assertRoomSeatByCode, type SessionContext } from "./authz";

/**
 * Media rows: who uploaded what, into which room.
 *
 * The bytes are in object storage. This table exists to answer one question —
 * may this session have a URL for this object — and to know which objects to
 * delete when a room expires.
 */

export interface MediaRow {
  id: string;
  roomId: string;
  objectKey: string;
  contentType: string;
  bytes: number;
  uploaded: boolean;
}

/**
 * Reserves a row before the upload, so the object key exists before the bytes
 * do and an abandoned upload is a row we can find rather than an orphan we
 * cannot.
 */
export async function reserveMedia(
  ctx: SessionContext,
  input: { code: string; playerId: string; kind: string; contentType: string; mediaId: string; objectKeyFor: (roomId: string, mediaId: string) => string },
): Promise<{ id: string; roomId: string; objectKey: string }> {
  return transaction(async (client) => {
    const { roomId } = await assertRoomSeatByCode(ctx, input.code, input.playerId, client);
    const objectKey = input.objectKeyFor(roomId, input.mediaId);

    await client.query(
      `insert into media (id, room_id, session_id, player_id, kind, object_key, content_type)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [
        input.mediaId,
        roomId,
        ctx.sessionId,
        input.playerId,
        String(input.kind).slice(0, 32),
        objectKey,
        input.contentType,
      ],
    );

    return { id: input.mediaId, roomId, objectKey };
  });
}

/** Marks an upload as landed, once the server has checked what actually arrived. */
export async function completeMedia(
  ctx: SessionContext,
  mediaId: string,
  facts: { bytes: number; contentType: string },
): Promise<void> {
  const { rowCount } = await query(
    `update media
        set uploaded_at = now(), bytes = $3, content_type = $4
      where id = $1 and session_id = $2 and uploaded_at is null`,
    [mediaId, ctx.sessionId, facts.bytes, facts.contentType],
  );
  if (!rowCount) throw new AuthzError("No such upload", 404);
}

/** The object behind a media id, if this session is in that media's room. */
export async function mediaForDownload(
  ctx: SessionContext,
  mediaId: string,
): Promise<{ objectKey: string; contentType: string }> {
  const { objectKey, contentType } = await assertMediaAccess(ctx, mediaId);
  return { objectKey, contentType };
}

/** Drops a reservation whose bytes never arrived, or arrived wrong. */
export async function discardMedia(ctx: SessionContext, mediaId: string): Promise<string | null> {
  const { rows } = await query<{ object_key: string }>(
    `delete from media where id = $1 and session_id = $2 returning object_key`,
    [mediaId, ctx.sessionId],
  );
  return rows[0]?.object_key ?? null;
}

/**
 * Object keys with nothing left to belong to.
 *
 * Two kinds: reservations whose upload never completed, and media whose room
 * has aged out. Both are storage nobody will ever read and everybody is paying
 * for. The rows go in the same transaction; the caller deletes the objects.
 */
export async function collectAbandonedMedia(
  { abandonedAfterMinutes = 30, roomTtlHours = 24 } = {},
): Promise<string[]> {
  return transaction(async (client) => {
    const stale = await client.query<{ object_key: string }>(
      `delete from media
        where uploaded_at is null
          and created_at < now() - ($1 || ' minutes')::interval
        returning object_key`,
      [String(abandonedAfterMinutes)],
    );

    const expired = await client.query<{ object_key: string }>(
      `delete from media
        where room_id in (
          select id from rooms where updated_at < now() - ($1 || ' hours')::interval
        )
        returning object_key`,
      [String(roomTtlHours)],
    );

    return [...stale.rows, ...expired.rows].map((r) => r.object_key);
  });
}

/** Every object belonging to a room, for tests and for diagnostics. */
export async function mediaKeysForRoom(roomId: string): Promise<string[]> {
  const { rows } = await query<{ object_key: string }>(
    `select object_key from media where room_id = $1 order by created_at`,
    [roomId],
  );
  return rows.map((r) => r.object_key);
}
