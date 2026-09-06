import { NextResponse } from "next/server";
import { databaseConfigured } from "@/lib/server/config";
import { pingDatabase } from "@/lib/server/db/lifecycle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Is this deployment actually working.
 *
 * Railway holds traffic on the previous deployment until this passes, so it has
 * to touch the database rather than merely return. It is also what the profile
 * page asks before claiming a connection is live — "NEXT_PUBLIC_WS_URL is set"
 * is a build-time fact and not an answer.
 *
 * Deliberately says nothing about how anything is configured: no host names, no
 * versions, no counts. A health check is not a place to describe the estate.
 */
export async function GET() {
  if (!databaseConfigured()) {
    return NextResponse.json(
      { ok: true, mode: "local" as const },
      { headers: { "cache-control": "no-store, max-age=0" } },
    );
  }

  const ok = await pingDatabase();
  return NextResponse.json(
    { ok, mode: "hosted" as const },
    {
      status: ok ? 200 : 503,
      // A cached health check is worse than none: it reports the last time
      // things were fine as though it were now.
      headers: { "cache-control": "no-store, max-age=0" },
    },
  );
}
