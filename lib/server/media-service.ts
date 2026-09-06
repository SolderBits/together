import "server-only";
import type { SessionContext } from "./db/authz";
import { AuthzError } from "./db/authz";
import {
  completeMedia,
  discardMedia,
  mediaForDownload,
  reserveMedia,
} from "./db/media";
import {
  DOWNLOAD_TTL_SECONDS,
  MAX_UPLOAD_BYTES,
  SNIFF_BYTES,
  checkSize,
  isAllowedContentType,
  newMediaId,
  objectKeyFor,
  objectStore,
  sniffImageFormat,
} from "./storage";

/**
 * The media flow, in one place.
 *
 * Both experiences use these three calls and nothing else, so there is one
 * media architecture rather than one per experience — and swapping R2 for
 * something else touches `lib/server/storage/` alone.
 */

export interface UploadTicket {
  mediaId: string;
  url: string;
  headers: Record<string, string>;
  expiresAt: number;
  maxBytes: number;
}

/**
 * Step one: authorize, reserve a row, hand back a URL good for one object.
 *
 * The key is generated here from the room and a fresh uuid. Nothing the caller
 * sent contributes to it.
 */
export async function beginUpload(
  ctx: SessionContext,
  input: { code: string; playerId: string; kind: string; contentType: string; origin?: string },
): Promise<UploadTicket> {
  if (!isAllowedContentType(input.contentType)) {
    throw new AuthzError("That file type isn't supported.", 415);
  }

  const mediaId = newMediaId();
  const store = objectStore(input.origin ?? "");

  const { objectKey } = await reserveMedia(ctx, {
    code: input.code,
    playerId: input.playerId,
    kind: input.kind,
    contentType: input.contentType,
    mediaId,
    objectKeyFor: (roomId, id) => objectKeyFor(roomId, id, input.contentType),
  });

  const presigned = await store.presignUpload(objectKey, input.contentType, MAX_UPLOAD_BYTES);

  return {
    mediaId,
    url: presigned.url,
    headers: presigned.headers,
    expiresAt: presigned.expiresAt,
    maxBytes: MAX_UPLOAD_BYTES,
  };
}

/**
 * Step two: check what actually landed.
 *
 * With a presigned PUT the bytes never pass through this server, so this is the
 * only place they can be inspected — and the client's declared content type is
 * ignored in favour of the file's own leading bytes. Anything that is not one
 * of three real image formats, or is the wrong size, is deleted rather than
 * left costing money.
 */
export async function finishUpload(
  ctx: SessionContext,
  mediaId: string,
  origin = "",
): Promise<{ bytes: number; contentType: string }> {
  const store = objectStore(origin);
  const { objectKey } = await mediaForDownload(ctx, mediaId);

  const found = await store.head(objectKey, SNIFF_BYTES);
  if (!found) {
    await discardAndRemove(ctx, mediaId, objectKey, origin);
    throw new AuthzError("That upload didn't arrive.", 400);
  }

  const size = checkSize(found.object.bytes);
  if (!size.ok) {
    await discardAndRemove(ctx, mediaId, objectKey, origin);
    throw new AuthzError(size.reason ?? "That upload is the wrong size.", 413);
  }

  const format = sniffImageFormat(found.prefix);
  if (!format) {
    await discardAndRemove(ctx, mediaId, objectKey, origin);
    throw new AuthzError("That file isn't an image we can read.", 415);
  }

  await completeMedia(ctx, mediaId, { bytes: found.object.bytes, contentType: format });
  return { bytes: found.object.bytes, contentType: format };
}

/**
 * Step three: a URL for reading, if this session is in the room the media
 * belongs to — the room on the *row*, not one the caller names.
 */
export async function downloadUrl(
  ctx: SessionContext,
  mediaId: string,
  origin = "",
): Promise<{ url: string; contentType: string }> {
  const store = objectStore(origin);
  const { objectKey, contentType } = await mediaForDownload(ctx, mediaId);
  return {
    url: await store.presignDownload(objectKey, DOWNLOAD_TTL_SECONDS),
    contentType,
  };
}

async function discardAndRemove(
  ctx: SessionContext,
  mediaId: string,
  objectKey: string,
  origin: string,
) {
  await discardMedia(ctx, mediaId).catch(() => null);
  await objectStore(origin).remove([objectKey]).catch(() => {});
}
