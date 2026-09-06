import { NextResponse } from "next/server";
import { databaseConfigured } from "@/lib/server/config";
import { AuthzError, NotFoundError } from "@/lib/server/db/authz";
import { downloadUrl } from "@/lib/server/media-service";
import { currentSession } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A short-lived URL for one photo.
 *
 * Authorization is membership of the room the media row names — not of a room
 * the caller names — so holding a media id from another room gets you a 404,
 * and guessing an object key gets you nothing at all because object keys are
 * never accepted from a request.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!databaseConfigured()) {
    return NextResponse.json({ error: "This deployment has no hosted backend." }, { status: 501 });
  }

  const { id } = await context.params;
  if (!UUID.test(id)) {
    return NextResponse.json({ error: "No such media." }, { status: 404 });
  }

  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "No session." }, { status: 401 });

  try {
    const { url, contentType } = await downloadUrl(session, id, new URL(request.url).origin);
    return NextResponse.json({ url, contentType });
  } catch (error) {
    if (error instanceof AuthzError || error instanceof NotFoundError) {
      // The same answer whether the media does not exist or is not theirs.
      return NextResponse.json({ error: "No such media." }, { status: 404 });
    }
    console.error("[api/media/:id] failed", error);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
