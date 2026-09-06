import "server-only";
import { randomUUID } from "node:crypto";
import { LocalObjectStore } from "./local";
import { R2ObjectStore } from "./r2";
import type { ObjectStore } from "./types";

export type { ObjectStore, PresignedUpload } from "./types";
export { DOWNLOAD_TTL_SECONDS, UPLOAD_TTL_SECONDS } from "./types";
export { LocalObjectStore, verifyLocalSignature } from "./local";
export {
  MAX_THUMBNAIL_BYTES,
  MAX_UPLOAD_BYTES,
  SNIFF_BYTES,
  checkSize,
  isAllowedContentType,
  sniffImageFormat,
} from "./image";

let cached: ObjectStore | null = null;

/**
 * The object store for this deployment.
 *
 * R2 when it is configured, the local adapter otherwise — the same choice, for
 * the same reason, as the room transport. There is no third path and no
 * fallback between them at runtime: a deployment that has R2 configured and
 * broken should say so rather than quietly writing a couple's photos to a
 * container's ephemeral disk.
 */
export function objectStore(origin = ""): ObjectStore {
  if (cached) return cached;

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;

  cached =
    accountId && accessKeyId && secretAccessKey && bucket
      ? new R2ObjectStore({ accountId, accessKeyId, secretAccessKey, bucket })
      : new LocalObjectStore(origin);

  return cached;
}

/** Only for tests, which build several stores in one process. */
export function resetObjectStore() {
  cached = null;
}

/**
 * The key an object is stored under.
 *
 * Generated here and nowhere else. Nothing in a request contributes to it, so
 * path traversal is not something to validate against — there is no path the
 * client can influence. The room prefix also means expiring a room's media is a
 * prefix delete rather than a join.
 */
export function objectKeyFor(roomId: string, mediaId: string, format: string): string {
  const extension = format === "image/png" ? "png" : format === "image/webp" ? "webp" : "jpg";
  return `rooms/${roomId}/${mediaId}.${extension}`;
}

export function newMediaId(): string {
  return randomUUID();
}
