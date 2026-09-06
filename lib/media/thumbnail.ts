"use client";

/**
 * Thumbnails small enough to travel inside the room document.
 *
 * A thumbnail here is a placeholder, not a picture: it fills the gap between
 * the shutter firing and the original landing in storage, on the other person's
 * screen. It is deliberately tiny, because the room document is re-read on
 * every change and a Photobooth session holds eight of these.
 *
 * The budget is a hard limit, not a target. Quality settings do not translate
 * to bytes predictably across images and browsers — a busy photo at q0.4 can
 * easily exceed a flat one at q0.7 — so this measures what it produced and
 * steps down until it actually fits, rather than assuming.
 */

/** Matches MAX_THUMBNAIL_BYTES on the server, which validates the same value. */
export const MAX_THUMBNAIL_BUDGET = 2_048;

const STEPS: Array<{ width: number; quality: number }> = [
  { width: 64, quality: 0.45 },
  { width: 48, quality: 0.4 },
  { width: 40, quality: 0.35 },
  { width: 32, quality: 0.3 },
  { width: 24, quality: 0.25 },
  { width: 16, quality: 0.2 },
];

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That image could not be read."));
    img.src = dataUrl;
  });
}

export interface Thumbnail {
  dataUrl: string;
  bytes: number;
  width: number;
  height: number;
}

/**
 * A thumbnail guaranteed to be within budget, or null.
 *
 * Null rather than a throw: a photo whose thumbnail could not be made is still
 * a photo, and the capture should not fail because the placeholder did.
 */
export async function makeThumbnail(
  dataUrl: string,
  budget = MAX_THUMBNAIL_BUDGET,
): Promise<Thumbnail | null> {
  let image: HTMLImageElement;
  try {
    image = await loadImage(dataUrl);
  } catch {
    return null;
  }
  if (!image.width || !image.height) return null;

  for (const step of STEPS) {
    const scale = Math.min(1, step.width / image.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    const encoded = canvas.toDataURL("image/jpeg", step.quality);
    if (encoded.length <= budget) {
      return { dataUrl: encoded, bytes: encoded.length, width: canvas.width, height: canvas.height };
    }
  }

  // Every step overshot, which should not happen for a photograph. Better to
  // send no placeholder than to put something oversized into shared state.
  return null;
}

/**
 * The guard the room document is protected by.
 *
 * Checked again wherever a thumbnail is about to be written into shared state,
 * because `makeThumbnail` is not the only way a value could get there — a
 * replayed message from an older client, for instance.
 */
export function isWithinThumbnailBudget(value: unknown, budget = MAX_THUMBNAIL_BUDGET): boolean {
  return (
    typeof value === "string" &&
    value.startsWith("data:image/") &&
    value.length > 0 &&
    value.length <= budget
  );
}
