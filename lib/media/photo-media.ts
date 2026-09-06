"use client";

import { backendMode } from "@/lib/realtime";
import { MAX_THUMBNAIL_BUDGET } from "./thumbnail";

/**
 * The client half of the media flow.
 *
 * One module, used by both Photobooth and Snap Hunt, sitting on the stage 6
 * service. It is not a second storage abstraction — it is the browser's side of
 * the one that already exists, in the same way `RailwayRoomTransport` is the
 * browser's side of the realtime server.
 *
 * Every capture produces two things and they go to different places:
 *
 *   thumbnail   ≤2 KB, into the room document and across the socket, so the
 *               other person sees something the moment the shutter fires
 *   original    full resolution, straight to object storage, never through
 *               the room document, the socket, or localStorage
 *
 * With no hosted backend configured there is nowhere to upload to, so the
 * original stays where it always has: in memory, shared between two tabs over
 * BroadcastChannel. That path is unchanged, which is what keeps local
 * development working with no Cloudflare account and no database.
 */

export const THUMBNAIL_BUDGET_BYTES = MAX_THUMBNAIL_BUDGET;

export function mediaBackendAvailable(): boolean {
  return backendMode() === "railway";
}

export interface UploadResult {
  /** The id everyone refers to the photo by. Server-issued when uploaded. */
  mediaId: string;
  /** True when the bytes are in object storage rather than only in this tab. */
  stored: boolean;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, encoded] = dataUrl.split(",");
  const mime = /:(.*?);/.exec(meta)?.[1] ?? "image/jpeg";
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * Puts the original where it belongs and returns its id.
 *
 * Three steps, and a failure at any of them leaves nothing behind: the server
 * discards a reservation whose bytes never arrived, and the sweep collects any
 * that slip through. The caller gets `stored: false` and carries on with the
 * photo it already has in memory — a failed upload costs the export its full
 * resolution, not the session.
 */
export async function uploadOriginal(input: {
  code: string;
  playerId: string;
  kind: "booth" | "hunt";
  dataUrl: string;
  signal?: AbortSignal;
}): Promise<UploadResult> {
  const localId = `local_${crypto.randomUUID()}`;
  if (!mediaBackendAvailable()) return { mediaId: localId, stored: false };

  const blob = dataUrlToBlob(input.dataUrl);

  try {
    const ticketResponse = await fetch("/api/media", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        code: input.code,
        playerId: input.playerId,
        kind: input.kind,
        contentType: blob.type || "image/jpeg",
      }),
      signal: input.signal,
    });
    if (!ticketResponse.ok) return { mediaId: localId, stored: false };

    const ticket = (await ticketResponse.json()) as {
      mediaId: string;
      url: string;
      headers: Record<string, string>;
    };

    const put = await fetch(ticket.url, {
      method: "PUT",
      headers: ticket.headers,
      body: blob,
      signal: input.signal,
    });
    if (!put.ok) return { mediaId: localId, stored: false };

    // The server reads the first bytes of what actually landed and decides
    // whether it is really an image. A reservation left unconfirmed is swept.
    const complete = await fetch("/api/media", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ completeId: ticket.mediaId }),
      signal: input.signal,
    });
    if (!complete.ok) return { mediaId: localId, stored: false };

    return { mediaId: ticket.mediaId, stored: true };
  } catch {
    // Offline, aborted, or the server said no. The photo is still on screen.
    return { mediaId: localId, stored: false };
  }
}

/**
 * Fetches an original back, as an object URL.
 *
 * Authorization is the server's: it checks membership of the room named on the
 * media row. A thumbnail carries no capability — holding one, or the id beside
 * it, gets a stranger a 404 exactly as an invented id would.
 */
export async function fetchOriginal(mediaId: string): Promise<string | null> {
  if (!mediaBackendAvailable() || mediaId.startsWith("local_")) return null;

  try {
    const response = await fetch(`/api/media/${mediaId}`, { credentials: "include" });
    if (!response.ok) return null;
    const { url } = (await response.json()) as { url: string };

    const bytes = await fetch(url);
    if (!bytes.ok) return null;
    return URL.createObjectURL(await bytes.blob());
  } catch {
    return null;
  }
}
