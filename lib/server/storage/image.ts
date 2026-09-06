import "server-only";

/**
 * What counts as a photo.
 *
 * The client's `Content-Type` is a claim, not evidence — anyone can PUT a shell
 * script and label it `image/jpeg`. These checks read the leading bytes of what
 * actually arrived and decide from those. Everything else is rejected, and the
 * object is deleted rather than left paid for.
 */

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const MIN_UPLOAD_BYTES = 64;

/** Enough for every signature below, including WebP's twelve. */
export const SNIFF_BYTES = 16;

export type ImageFormat = "image/jpeg" | "image/png" | "image/webp";

const starts = (bytes: Uint8Array, prefix: number[], offset = 0) =>
  prefix.every((b, i) => bytes[offset + i] === b);

/**
 * The real format of some bytes, or null.
 *
 * Only the three formats a browser canvas can produce and every browser can
 * display. Notably absent: SVG, which is a document that can carry script, and
 * GIF, which nothing here creates.
 */
export function sniffImageFormat(bytes: Uint8Array): ImageFormat | null {
  if (bytes.length < 12) return null;

  // JPEG: FF D8 FF
  if (starts(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (starts(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";

  // WebP: "RIFF" .... "WEBP"
  if (starts(bytes, [0x52, 0x49, 0x46, 0x46]) && starts(bytes, [0x57, 0x45, 0x42, 0x50], 8)) {
    return "image/webp";
  }

  return null;
}

export function isAllowedContentType(value: string): value is ImageFormat {
  return value === "image/jpeg" || value === "image/png" || value === "image/webp";
}

export interface SizeVerdict {
  ok: boolean;
  reason?: string;
}

export function checkSize(bytes: number): SizeVerdict {
  if (!Number.isFinite(bytes) || bytes < MIN_UPLOAD_BYTES) {
    return { ok: false, reason: "That upload is empty or truncated." };
  }
  if (bytes > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      reason: `That image is ${Math.round(bytes / 1_048_576)} MB; the limit is ${MAX_UPLOAD_BYTES / 1_048_576} MB.`,
    };
  }
  return { ok: true };
}

/**
 * The largest a thumbnail may be to travel inside the room document.
 *
 * A thumbnail is a placeholder, not media: it exists so a partner sees
 * *something* in the moment between the shutter and the upload landing. At this
 * size a full Photobooth session's worth adds under 10 KB to a document that is
 * re-read on every change, which is the budget that matters.
 */
export const MAX_THUMBNAIL_BYTES = 2_048;
