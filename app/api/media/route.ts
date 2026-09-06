import { NextResponse } from "next/server";
import { databaseConfigured } from "@/lib/server/config";
import { AuthzError } from "@/lib/server/db/authz";
import { beginUpload, finishUpload } from "@/lib/server/media-service";
import { currentSession } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 4096;

/**
 * Ask for somewhere to put a photo, or confirm one arrived.
 *
 * The bytes never come through here — the client PUTs them straight to object
 * storage with a URL this server signed for exactly one key. What this route
 * decides is whether it will sign one at all, and afterwards, whether what
 * landed is really an image of a sane size.
 */
export async function POST(request: Request) {
  if (!databaseConfigured()) {
    return NextResponse.json({ error: "This deployment has no hosted backend." }, { status: 501 });
  }

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "That request is too large." }, { status: 413 });
  }

  const session = await currentSession();
  if (!session) {
    return NextResponse.json({ error: "No session." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "That request is too large." }, { status: 413 });
    }
    const parsed = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null) throw new Error("not an object");
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const origin = new URL(request.url).origin;

  try {
    // Confirming an upload that has already happened.
    if (typeof body.completeId === "string") {
      const facts = await finishUpload(session, body.completeId, origin);
      return NextResponse.json({ mediaId: body.completeId, ...facts });
    }

    const ticket = await beginUpload(session, {
      code: String(body.code ?? ""),
      playerId: String(body.playerId ?? ""),
      kind: String(body.kind ?? "photo"),
      contentType: String(body.contentType ?? "image/jpeg"),
      origin,
    });
    return NextResponse.json(ticket);
  } catch (error) {
    if (error instanceof AuthzError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[api/media] failed", error);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
