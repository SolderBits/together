# Together — orientation

Read this first. It is written for whoever picks the repository up next, human
or otherwise, and it says what the code is, what state it is in, and which
decisions are already settled so you do not re-litigate them.

The [README](README.md) describes the product but **predates the backend
migration** — where the two disagree, this file and `docs/` are current.

---

## What it is

Twenty small two-player experiences — quizzes, drawing, debates, a photobooth,
keepsakes. One person starts a room, gets a six-character code and an invite
link; the other opens it. **Nobody makes an account.** That constraint drives
most of the architecture below.

Next.js 15.5 (App Router) · React 19 · TypeScript strict · Tailwind 3.4 ·
Node 20 · Postgres · a custom Node server hosting Next and a WebSocket server in
one process.

`Together` is a placeholder name, living in `lib/site.ts` and
`components/layout/brand.tsx`. Change those two files to rename the product.

---

## Where the project is right now

Migrating from **Supabase to Railway**, on the `railway-migration` branch.
Stages 1–11 are complete. Stage 12 — deploying to real Railway infrastructure —
**has not happened**: no Railway project, no Cloudflare R2 bucket, nothing
deployed. The plan and its checklist are in
[docs/RAILWAY-MIGRATION-PLAN.md](docs/RAILWAY-MIGRATION-PLAN.md).

**Supabase is still installed and still works.** It is deliberately not removed
until the Railway path has been proven on real infrastructure (stage 14). Do not
delete it because Railway looks finished.

What has never been exercised, and must not be described as working:

- **Cloudflare R2** — the adapter is written and tested against a local
  filesystem adapter with real bytes and real HMAC signatures. It has never
  moved a byte to Cloudflare.
- **Real network Postgres** — TLS, latency, connection limits, failover.
- **The restricted database role on a real connection.** `db/role.sql`'s grants
  are proven; the application actually *connecting* as that role is not, because
  PGlite ignores the user in a connection string.
- **Railway's proxy handling the WebSocket upgrade.**
- **Two devices on two networks.**

---

## Architecture

### One interface, three transports

Everything realtime goes through `RoomTransport` (`lib/realtime/transport.ts`).
Three implementations:

| Transport | When | What it uses |
|---|---|---|
| `LocalRoomTransport` | no backend configured | `BroadcastChannel` + `localStorage`, two tabs on one machine |
| `SupabaseRoomTransport` | Supabase configured | Supabase Realtime — the previous backend |
| `RailwayRoomTransport` | `NEXT_PUBLIC_WS_URL` set | the WebSocket server in `lib/server/ws/` |

`createTransport()` in `lib/realtime/index.ts` picks one **once, from the
environment, with no fallback between modes**. This is deliberate: a Railway
deployment whose realtime server is unreachable must fail loudly. Silently
falling back to local mode gives two players separate rooms on their own
machines that look like they are working.

### How a room is written

Client-side read-modify-write with server-side compare-and-set. `rooms.version`
is a bigint; a writer sends the version it derived its patch from and the server
refuses anything stale, answering `conflict` with the current state.

Frames carry a **request id (`rid`)**, echoed on `ack`/`conflict`/`denied`.
This is not decoration: room state is broadcast to everyone, so "the next state
frame" is not an answer to anything. Correlating by frame type caused silent
data loss under concurrent writes — a client accepted the broadcast from
*someone else's* successful patch while its own had conflicted.

**Presence is out of band**, in `room_players`, not in `rooms.state`. A
heartbeat that rewrote the room document would rewrite every stroke of a drawing
twenty times a minute.

### Host election

`electHost()` in `lib/rooms/api.ts` (timings in `lib/rooms/types.ts`) is deterministic and runs identically
on every client — host considered stale after 45s, a 15s cooldown between
handovers, successor is the lowest online player id lexicographically. Only the
elected client writes. The server independently validates any host claim
against `room_players.last_seen`, so a client cannot simply assert it.

### Media: two artefacts

A photo becomes two things. A **≤2KB thumbnail** travels in room state and over
the socket; the **full-resolution original** goes to object storage and is
fetched by `mediaId`. Measured: original 391KB, thumbnail 1291 bytes, room
document 1701 bytes. Never put raw image data in room state or a WebSocket
frame — a size cap in `lib/server/ws/protocol.ts` enforces it.

### The one process

`server/index.ts` runs Next and the WebSocket server together, built by esbuild
to `dist/server.mjs`. They share a port, a session secret and a database pool.
Splitting them later is an environment variable, because the browser is *told*
where to connect (`NEXT_PUBLIC_WS_URL`) rather than assuming same-origin.

---

## Security model

There is no login, so **the session cookie is the whole identity**: an HS256 JWT
in an HttpOnly cookie, 30-day sliding expiry. Both a valid signature *and* a
live `sessions` row are required — a validly signed token for a deleted session
is refused.

Authorization is structural, in four layers, because any one of them can be
forgotten:

1. **Centralised gates** — `lib/server/db/authz.ts`: `assertRoomMember`,
   `assertRoomSeat`, `assertRoomHost`, `assertOwner`, `assertMediaAccess`, plus
   `...ByCode` variants for callers holding a room code rather than an id.
2. **Every room query is also scoped by `session_id`**, redundantly. If a gate
   is ever missed, the query returns nothing rather than someone else's room.
3. **A restricted database role** (`db/role.sql`). `together_app` can read and
   write five tables and do nothing else — no DDL, no other schema, no
   `pg_authid`. In production the app *refuses to boot* on a privileged
   connection (`lib/server/db/role-check.ts`), because pointing `DATABASE_URL`
   at Railway's superuser works perfectly and quietly removes this layer.
4. **A build-time guard** — `npm run check:db`, eight structural checks.

Two conventions worth knowing:

- **A refusal never reveals whether the thing exists.** A room you are not in
  and a room that never existed both return `404 No such room`, in the same
  words. Same for media.
- **Signed URLs are capabilities.** They are never cached, never logged, and
  cover key + method + expiry so one cannot be edited into another.

---

## Testing

**No mocks for anything security-relevant.** The claims are negative — "a
non-member receives nothing" — and a mock that was never wired up satisfies them
trivially. So the suites run PGlite behind a real Postgres wire-protocol socket,
driven by the real `pg` driver through the real data layer, with real `ws`
clients and real HMAC-signed URLs.

**Tests are verified by mutation.** Defences are removed one at a time to
confirm the test that covers them actually goes red. This has caught tests that
were green for the wrong reason more than once — including a redaction test that
named a secret it never actually logged.

433 assertions across nine suites, plus 50 in the production rehearsal.

| Command | What it does |
|---|---|
| `npm test` | all nine suites |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run check:db` | structural guards: DB access confinement, SQL interpolation, secret-shaped `NEXT_PUBLIC_` names, committed credentials, unauthenticated routes, debug endpoints, `.gitignore` |
| `npm run check:bundle` | builds with canary secrets in the environment, then greps the output for them |
| `npm run check:production` | clean `--omit=dev` install of the built artefacts, boots the real server, drives it over HTTP and WebSocket, SIGTERMs it |
| `npm run verify` | typecheck + test + check:bundle |
| `npm run predeploy` | verify + check:production — run before any deploy |

Individual suites: `test:session`, `test:realtime`, `test:transport`,
`test:media`, `test:photobooth`, `test:security`, `test:deploy`,
`test:election`, `test:rls`.

Suites needing server-only modules run with `NODE_OPTIONS=--conditions=react-server`,
which is how `tsx` resolves the `server-only` package.

---

## Running it

```bash
npm install
npm run dev          # local mode, no configuration needed, two tabs = two players
npm run dev:railway  # in-process PGlite + the custom server, the full backend
npm run build        # next build, then esbuild the server to dist/server.mjs
npm start            # node dist/server.mjs — what Railway runs
```

`.env.example` documents every variable, grouped by where the value is allowed
to go. Nothing is required: with an empty environment the app runs in local
mode and every experience works.

---

## Map

```
app/                Next App Router. api/ has 7 routes: health, session, rooms,
                    media, media/[id], media/blob, judge
components/         UI, 71 files. The design system is settled; do not redesign
content/            question banks, prompts, card decks
db/                 migrate.mjs (forward-only, advisory-locked), migrations/,
                    role.sql (the restricted role, run once by hand)
lib/
  experiences.ts    the registry of all 20 experiences
  games/            per-experience logic
  realtime/         RoomTransport + the three implementations
  rooms/            room types and timings, host election (api.ts)
  media/            thumbnail generation, photo upload/fetch
  server/           server-only. db/ is the ONLY place that touches Postgres
    ws/             the WebSocket server and its wire protocol
    storage/        ObjectStore: r2.ts, local.ts, image sniffing
scripts/            build-server.mjs, dev-railway.mjs, and the three check:* guards
server/index.ts     the custom server: boot, migrate, role check, listen, shutdown
supabase/           the previous backend — schema.sql and its RLS tests. Legacy,
                    still working, removed at stage 14
docs/               see below
```

### Documentation

| File | What is in it |
|---|---|
| [RAILWAY-MIGRATION-PLAN.md](docs/RAILWAY-MIGRATION-PLAN.md) | the 17-section plan, six approved decisions, the 15-stage checklist, cost model |
| [GOING-LIVE.md](docs/GOING-LIVE.md) | step-by-step Railway deployment, rollback, secret rotation |
| [STAGE-10-HARDENING.md](docs/STAGE-10-HARDENING.md) | nine security issues, severity, fix, and the test proving each |
| [STAGE-11-DEPLOYMENT-READINESS.md](docs/STAGE-11-DEPLOYMENT-READINESS.md) | ten deployment issues, same format |
| [LAUNCH-AUDIT.md](docs/LAUNCH-AUDIT.md) | the pre-migration audit, 20 risk categories |

---

## Rules that are not up for renegotiation

These were decided deliberately, usually after something broke. Changing one is
a real decision, not a cleanup.

- **No secret ever gets a `NEXT_PUBLIC_` prefix.** That prefix means "compile
  this into the page source". `check:db` fails the build for it.
- **Nothing outside `lib/server/db/` touches the database.** `check:db` enforces
  it. When something legitimately needs a lifecycle hook, it gets a narrow
  module (`lifecycle.ts`) rather than an exception to the rule.
- **No SQL is built by string interpolation.** Parameterised, always.
- **No fallback between transport modes.** See above.
- **No raw media in room state or WebSocket frames.**
- **Migrations are forward-only**, idempotent, and must never be bundled — the
  runner locates its SQL relative to its own `import.meta.url`, so esbuild
  inlining it once broke the first production boot. It is external in
  `scripts/build-server.mjs`, and the comment there explains why.
- **The health check must be willing to say no.** It reports database,
  migrations and realtime separately and is healthy only when all three are.
- **Never claim something works because the code looks right.** If it has not
  been run against the real thing, say so.

---

## If you are continuing the migration

The next action is stage 12, and it is blocked on two things that require a
person: `railway login`, and creating a Cloudflare R2 bucket and API token.
`docs/GOING-LIVE.md` has the exact sequence, including which variable names to
set. Everything after login can be driven from the Railway CLI.

Do not merge `railway-migration` into `main` until the deployment is proven.
