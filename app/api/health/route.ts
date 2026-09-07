import { NextResponse } from "next/server";
import { databaseConfigured } from "@/lib/server/config";
import { pingDatabase } from "@/lib/server/db/lifecycle";
import { runtimeStatus } from "@/lib/server/runtime-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Is this deployment actually able to serve people.
 *
 * Railway holds traffic on the previous deployment until this passes, which
 * only helps if it is willing to say no. So it reports each part separately and
 * is healthy only when all of them are: the database answers, migrations
 * finished, and the realtime server is attached. A process that is listening on
 * a port while the schema is half-applied is not healthy — it is a process that
 * will fail in front of the first person to open a room.
 *
 * Deliberately says nothing about how anything is configured: no host names, no
 * versions, no counts, no role names. A health check is not a place to describe
 * the estate to whoever asks.
 */

const NO_STORE = {
  // A cached health check is worse than none: it reports the last time things
  // were fine as though it were now. `no-store` for shared caches, and the CDN
  // hints because Railway's proxy and any front cache honour their own.
  "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
  pragma: "no-cache",
  expires: "0",
  "cdn-cache-control": "no-store",
} as const;

export async function GET() {
  const status = runtimeStatus();
  const uptimeSeconds = Math.round((Date.now() - status.startedAt) / 1000);

  // No hosted backend configured: rooms are local to each device and there is
  // nothing else that could be unwell.
  if (!databaseConfigured()) {
    return NextResponse.json(
      { ok: true, mode: "local" as const, uptimeSeconds },
      { headers: NO_STORE },
    );
  }

  const database = await pingDatabase();
  const checks = {
    database,
    migrations: status.migrations,
    realtime: status.realtime,
  };

  const ok = database && status.migrations === "ready" && status.realtime === "listening";

  return NextResponse.json(
    { ok, mode: "hosted" as const, checks, uptimeSeconds },
    { status: ok ? 200 : 503, headers: NO_STORE },
  );
}
