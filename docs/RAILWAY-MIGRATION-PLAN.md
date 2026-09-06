# Supabase → Railway migration plan

**Status: proposal. Nothing has been changed.** The Supabase implementation is
untouched and stays that way until you approve this and the Railway path is
tested alongside it.

Written after reading every Supabase touchpoint in the tree. Measurements in
here are measured, not estimated; where I could not measure something I say so.

---

## 0. What I found first: the migration is smaller than it looks

The realtime backend sits behind one interface, `RoomTransport`
(`lib/realtime/transport.ts`), and one factory, `createTransport(code)`. Every
experience talks to `useRoom()`, which talks to `RoomSession`, which talks to
that interface. **No experience imports Supabase.** The 20 experiences, the
game content, the UI and the design system are all downstream of a seam that
already exists precisely for this.

That means the migration is: write a third transport, add a server behind it,
and replace an auth model. It is not a rebuild, and none of the 20 experiences
need to change — with two exceptions, both about photos, described in §8.

One useful discovery: `lib/supabase/server.ts` is **dead code**. Nothing imports
it. It can be deleted outright.

---

## 1. Every current Supabase dependency

| # | Dependency | Where | What it does today |
|---|---|---|---|
| 1 | `@supabase/ssr` browser client | `lib/supabase/client.ts` | Creates the client; `getAuthedSupabaseClient()` ensures an anonymous session |
| 2 | **Anonymous auth** | `lib/supabase/client.ts:58` | `signInAnonymously()` — gives every guest an `auth.uid()` so RLS has something to check. **The keystone of the whole security model.** |
| 3 | Email + Google sign-in | `lib/supabase/auth.ts`, `components/auth/auth-panel.tsx` | Optional OTP and OAuth. **Currently decorative** — nothing reads the session; no data is scoped to a signed-in user |
| 4 | Server client | `lib/supabase/server.ts` | **Dead code.** Never imported |
| 5 | Postgres access | `lib/realtime/supabase-transport.ts` | `.from("rooms").select/update` via PostgREST |
| 6 | RPC `create_room` / `join_room` | same | The only way to create a room or gain membership |
| 7 | RPC `get_gift` | `supabase/schema.sql:406` | Capability read for gift pages; enforces the reveal date |
| 8 | **38 RLS policies** | `supabase/schema.sql` | All authorization. 19 tables |
| 9 | Realtime channels | `supabase-transport.ts:33` | `broadcast` for events, `postgres_changes` on `rooms` as the reconnect path |
| 10 | Optimistic concurrency | `supabase-transport.ts:118` | `rooms.version` compare-and-set; retries on conflict |
| 11 | Storage buckets | `schema.sql:922` | `photos` + `drawings`, private, path-prefixed by user id. **Declared but never used** — no code uploads to them |
| 12 | `prune_stale_rooms()` | `schema.sql:479` | 24-hour room expiry. Never scheduled |
| 13 | Transport factory | `lib/realtime/index.ts` | Chooses Supabase when configured, else local |
| 14 | Backend label in UI | `components/experiences/profile.tsx:173` | Shows "Supabase" vs "this browser" |
| 15 | `backend` type union | `room-provider.tsx:39`, `transport.ts:9` | `"local" \| "supabase"` |
| 16 | RLS test suites | `supabase/rls.test.mjs` (76 assertions), `rls.live.test.mjs` | Prove the policies |
| 17 | Env vars | `.env.example` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (empty, unused) |
| 18 | Docs | `README.md`, `docs/GOING-LIVE.md`, three audit docs | Describe the Supabase path |

**Not a Supabase dependency, but worth stating:** everything under
`lib/store/index.ts` — memories, letters, gifts, scrapbook, photo strips, print
designs, goals, completions — is **localStorage only**. `schema.sql` has tables
for all of it; nothing writes to them. See Decision E.

---

## 2. Railway replacement for each dependency

| Supabase | Railway replacement |
|---|---|
| Anonymous auth | **Own session service.** Server mints a signed JWT on first visit, sets it as an HttpOnly cookie. No account, no prompt — same guest experience |
| Email/Google sign-in | **Removed for now** (Decision D) |
| Postgres via PostgREST | **Railway PostgreSQL** behind a server-side data layer. No database client in the browser, ever |
| `create_room` / `join_room` RPCs | Server route handlers doing the same work in a transaction |
| `get_gift` RPC | Server route; same token + reveal-date check |
| 38 RLS policies | **Explicit server-side authorization** — a single `assertRoomMember()` / `assertOwner()` gate every query passes through (§7) |
| Realtime broadcast + postgres_changes | **WebSocket server** (`ws`), authenticated by the session JWT, authorized per room (§6) |
| `rooms.version` compare-and-set | Same column, same semantics, enforced server-side in a transaction |
| Storage buckets | **Cloudflare R2** with pre-signed URLs (§8) |
| `prune_stale_rooms()` | Same SQL, run on an interval inside the server process |
| `SupabaseRoomTransport` | `RailwayRoomTransport` implementing the identical `RoomTransport` interface |
| `LocalRoomTransport` | **Untouched.** Still the default with no env configured |
| RLS test suites | Equivalent HTTP/WS integration suite (§ Security testing) |

---

## 3. Proposed Railway services

**Start with two services, not three.**

```
GitHub ──> Railway project
             ├── web         Next.js + WebSocket server, one process
             └── postgres    Railway PostgreSQL
                    ↓
             Cloudflare R2   photos (external, required)
```

The WebSocket server runs **inside** the Next.js service via a custom Node
server, sharing the process and the port. Reasons:

- Saves roughly $5/month, which matters at your target price.
- The session JWT is verified the same way on both, so there is one auth path.
- At your scale one process handles both comfortably.

It is not a lock-in: `RailwayRoomTransport` reads a `NEXT_PUBLIC_WS_URL`, so
splitting the WS server into its own service later is an env change and a
`railway.json`, not a rewrite. §15 says when to split.

**At 10k users you will also want** a third service, Redis, for cross-instance
WebSocket fan-out and shared rate limiting. Not before.

---

## 4. PostgreSQL migration plan

`schema.sql` is 985 lines and mostly survives. What changes is **who enforces
access**, not what the tables look like.

**Kept as-is:** every `create table`, every constraint, every foreign key, every
existing index, the `version` column, `room_members`, `rooms.code` regex check,
the unique constraints on `(room_id, player_id)`, `(session_id, question_id,
player_id)`, `(couple_id, experience_id)`.

**Dropped:** all 38 `create policy` statements, all `alter table … enable row
level security`, the `anon`/`authenticated` grants, `auth.uid()`, the
`auth.users` foreign keys, `handle_new_user()`, `is_room_member()`,
`is_room_host()`, `is_couple_member()`. All of that is Supabase-shaped. The
authorization it expressed moves to §7 — it is not lost, it moves.

**Changed:**
- `profiles.id` currently references `auth.users(id)`. Becomes a standalone
  `sessions` table (§5), with `user_id` referencing it.
- `rooms.owner_id`, `photos.owner_id` etc. likewise point at `sessions`.
- `join_room`/`create_room`/`get_gift` become server code. Same logic, same
  validation regexes, same "no such room" message that does not reveal whether
  a code exists.

**Added indexes** (the ones the new access patterns need):
```sql
create index rooms_code_active_idx    on rooms(code) where updated_at > now() - interval '24 hours';
create index room_members_room_idx    on room_members(room_id);
create index room_members_session_idx on room_members(session_id);
create index sessions_expires_idx     on sessions(expires_at);
create index media_room_idx           on media(room_id);
create index rooms_expiry_idx         on rooms(updated_at);   -- cleanup sweep
```

**Tooling:** plain SQL migration files run by a small runner, not an ORM.
Queries go through `pg` with **parameterised placeholders only** — no string
interpolation of user input anywhere, which is the same guarantee PostgREST was
giving us. I am proposing SQL over an ORM because the existing schema is already
written and hand-tuned, and an ORM would mean re-expressing it for no benefit.

**Data migration: there is none to do.** No production Supabase project exists —
you have not run the setup step. This is a greenfield database. That removes the
riskiest part of a normal migration entirely.

---

## 5. Anonymous authentication / session design

Replacing `signInAnonymously()` with something equally server-verifiable.

**On first request** (Next.js middleware): if there is no valid session cookie,
`POST /api/session` creates one.

```
sessions
  id           uuid primary key
  created_at   timestamptz
  last_seen_at timestamptz
  expires_at   timestamptz          -- 30 days, sliding
  user_agent   text                  -- coarse, for abuse triage only
```

The client receives a **JWT signed with HS256** using `SESSION_SECRET`
(server-only), carrying `{ sub: session_id, exp }`, set as:

```
HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000
```

**Properties this gives us:**

- **Server-verifiable.** Every API route and the WebSocket handshake verify the
  signature. A forged or edited token fails.
- **Not readable or writable by client JavaScript** — strictly better than the
  Supabase anon JWT, which lived in `localStorage`.
- **No account, no prompt, no email.** Identical guest experience.
- **Survives refresh** the way the Supabase session did.

**Relationship to the existing player id.** `lib/rooms/identity.ts` keeps a
`player_id` in `sessionStorage` (deliberately per-tab, so two tabs act as two
devices). That stays exactly as it is. The session cookie is the *authorization*
identity; `player_id` remains the *seat* identity. `room_members` binds them:
`(room_id, session_id, player_id)` — which is what `join_room` already records
today, with `session_id` replacing `user_id`.

One consequence worth naming: two tabs in one browser share a cookie, so they
share a session but hold different player ids. That already matches how
`room_members` is keyed today. Local two-tab testing keeps working.

**Rotation:** `SESSION_SECRET` rotation invalidates all sessions, which logs
every guest out of their rooms. Acceptable, and rare. I will support two secrets
(current + previous) so rotation is not a hard cutover.

---

## 6. WebSocket / realtime architecture

`ws` server mounted on the Next.js HTTP server at `/ws`.

**Handshake.** The cookie is sent automatically on the upgrade request. The
server verifies the JWT before `handleUpgrade`; an invalid or missing session is
rejected with `401` and the socket never opens. Browser WebSocket cannot set
headers, which is exactly why the token is a cookie rather than an
`Authorization` header.

**Subscription.** After connecting, the client sends
`{ t: "subscribe", code }`. The server checks `room_members` for
`(room_id, session_id)` **in the database, on every subscribe** — not from
anything the client sent. Non-members get `{ t: "denied" }` and are added to no
fan-out set. This is requirement "prevent non-members from receiving room
events", enforced at the only place it can be.

**Message types**, mapping the existing interface one-to-one:

| Client → server | Server → client | Replaces |
|---|---|---|
| `subscribe { code }` | `state { room }` | `connect()` + `readState()` |
| `patch { code, version, state }` | `state { room }` broadcast to members | `patchState()` |
| `event { code, type, payload }` | `event { … }` to other members | `broadcast()` |
| `presence { code, playerId }` | `state { room }` when the roster changes | today's heartbeat |
| — | `denied`, `conflict`, `error` | new, explicit |

**Patch semantics — a decision, see Decision A.** The client keeps doing
read-modify-write and sends the resulting full document plus the version it was
derived from. The server applies it in a transaction:

```sql
update rooms set state = $1, version = version + 1, updated_at = now()
 where id = $2 and version = $3
returning version;
```

Zero rows means someone else landed first; the server replies `conflict` with
the current state and the client re-applies — precisely what
`SupabaseRoomTransport.patchState` does today, and why `patchState(fn)` keeps
working unchanged for all 20 experiences.

**Presence stops rewriting the room document.** Today a heartbeat rewrites the
whole `state` blob every 3 seconds — with a Draw Together session in progress
that document holds every stroke both players have drawn (measured: ~1.4 KB per
stroke, so a detailed round is well over 100 KB) and it is re-serialised twenty
times a minute. This was audit finding H4 and the WebSocket server is the right
place to fix it: presence becomes its own message updating `room_players`, and
the room document is written only when game state actually changes. **This is an
infrastructure fix with no user-visible change**, and it is the single biggest
reason the Railway architecture is cheaper to run than the Supabase one would
have been.

**Host migration is preserved and hardened.** `electHost()` stays exactly as it
is — the rule, the 45 s tolerance, the 15 s cooldown, the lowest-online-id
successor, all 15 passing assertions. The server additionally **validates** the
claim before committing it: a patch that moves `hostId` is accepted only if the
outgoing host really is stale and the cooldown really has elapsed, judged from
`room_players.last_seen` server-side. Today that check exists only on the
client. Two clients claiming at once still resolve by version — one gets
`conflict` — so duplicate hosts remain impossible, now for two independent
reasons.

**Disconnect and reconnect.** On socket close the server marks the member
offline and tells the room. On reconnect the client re-subscribes and receives
the current state, which is the existing reconnect path. Idempotency already
built for this — chat lines deduped by id, reactions by sender id, photos by
`photoId`, answers keyed by `(question, player)` — carries over unchanged.

---

## 7. Authorization model replacing RLS

RLS was a guarantee that held even if application code was wrong. Giving it up
is the **most significant loss in this migration** and I want to be plain about
it. The replacement has to be structural, not a convention.

**Every database call goes through one module** (`lib/server/db/`), and every
function in it takes a `SessionContext` as its first argument. There is no
exported way to query the pool directly. The gates:

```
assertRoomMember(ctx, roomId)   → throws 403 unless room_members has (roomId, ctx.sessionId)
assertRoomHost(ctx, roomId)     → member AND rooms.host_id = their player_id
assertOwner(ctx, table, rowId)  → owner_id = ctx.sessionId
assertCoupleMember(ctx, id)     → partner_one or partner_two = ctx.sessionId
```

These are the same four predicates the 38 policies expressed — `is_room_member`,
`is_room_host`, `is_couple_member`, `owner_id = auth.uid()` — lifted into code.

**How I keep it honest, given the compiler cannot:**

1. Every room query is parameterised by `session_id` in the `WHERE` clause as
   well as being gated. Belt and braces: even a missing gate returns no rows.
2. The Postgres role the app connects as has **no superuser and no bypass**;
   it owns only what it needs.
3. The security suite (§ below) tests the *endpoints*, not the helpers — a
   forgotten gate fails a test, not just a review.
4. A lint rule rejects `pool.query` outside `lib/server/db/`.

**Media authorization** is the case RLS made easy and code makes easy to get
wrong, so it gets its own check: a signed URL is issued only after
`assertRoomMember` passes for the room that media belongs to (§8).

---

## 8. Media and object storage

**Measured payload sizes**, from the real encoders this app uses:

| Payload | Size | Frequency |
|---|---|---|
| `booth:shot` (1000 px, q0.86) | **391 KB** | 4 per player per session |
| `hunt:photo` (1000 px, q0.80) | **310 KB** | 5 per player per session |
| `booth:frame` live preview (220 px, q0.45) | 7 KB | **every 700 ms while the camera is on** |
| Snap Hunt thumbnail (48 px) | 1.3 KB | stays in room state, fine |
| `draw:stroke` | 1.4 KB | per stroke |

A Photobooth session moves **3.05 MB** of photos; a Snap Hunt session **3.02 MB**.
Over `BroadcastChannel` that is free. Over a WebSocket to a server it is not,
and requirement 5 forbids it.

**Proposal: Cloudflare R2.** Railway has volumes (per-service disks) but no
object storage with signed URLs, so an external service is genuinely required.
R2 is the right pick because **egress is free** — photos are read far more than
written, and S3 egress would dominate the bill.

**The flow, which keeps the user-visible behaviour identical:**

1. Client asks the server for an upload URL: `POST /api/media` with the room
   code. Server runs `assertRoomMember`, inserts a `media` row
   (`id, room_id, session_id, kind, content_type, bytes, created_at`), returns a
   **pre-signed PUT** valid for 5 minutes.
2. Client PUTs the JPEG straight to R2. It never touches our server.
3. Client broadcasts `{ photoId }` — **~40 bytes instead of 391 KB.**
4. Partner receives the id, calls `GET /api/media/:id`, which runs
   `assertRoomMember` **for that media's room** and returns a pre-signed GET
   valid for 15 minutes.

Objects are keyed `rooms/<room_id>/<media_id>.jpg`, the bucket is private, and
there is no public base URL. A signed URL for another room's media cannot be
obtained, because step 4 checks membership of the row's room, not the
requester's claim.

**What this changes for the user:** a photo now appears after an upload
round-trip rather than instantly. On a decent connection that is a few hundred
milliseconds. Snap Hunt already shows a 1.3 KB thumbnail immediately, so it
degrades gracefully; **Photobooth has no thumbnail and I would add one** (same
technique, ~1 KB) so the strip fills in progressively rather than popping. That
is the one UI-adjacent change I am proposing, and it exists only to stop the
migration making the experience feel worse.

**`booth:frame` stays on the WebSocket.** It is a live camera preview, not
media — 7 KB, ephemeral, worthless a second later. Round-tripping it through
object storage would be absurd. But it is **10 KB/s per player, continuously,
while the Photobooth camera is on**, and that is real: two players for a
three-minute session is ~3.5 MB of egress. At $0.05/GB it is negligible; at
10k users it is worth revisiting. Flagged, not hidden. If you want it cheaper,
the honest lever is the 700 ms interval, and that *is* a visible change, so I
have not made it.

**Local mode keeps working.** With no R2 configured, `LocalRoomTransport` and
the existing `BroadcastChannel` + `sessionStorage` path stay exactly as they
are, data URLs and all. Nothing about local development changes.

---

## 9. Environment variables

All placeholders. Nothing secret is ever committed, and nothing server-only is
ever `NEXT_PUBLIC_`.

**Server-only** — never reaches the browser:
```
DATABASE_URL=                  # Railway injects this; postgres://…
SESSION_SECRET=                # 32+ random bytes. openssl rand -hex 32
SESSION_SECRET_PREVIOUS=       # optional, for rotation without mass logout
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
ANTHROPIC_API_KEY=             # unchanged; still server-only
ANTHROPIC_MODEL=claude-sonnet-5
```

**Client-visible** — deliberately public:
```
NEXT_PUBLIC_WS_URL=            # wss://<app>.up.railway.app/ws
NEXT_PUBLIC_SITE_URL=
```

**Removed:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`.

Note what is *not* there: no database credential, no R2 key, no signing secret
has a `NEXT_PUBLIC_` prefix. A build-time check will fail the build if any
`NEXT_PUBLIC_*` value matches a secret-shaped pattern, and the security suite
fetches the built client bundles and greps them for each secret's actual value.

---

## 10. Database migration strategy

Numbered, forward-only SQL files under `db/migrations/`, applied by a runner
that records what it has run in a `schema_migrations` table and takes an
advisory lock so two booting instances cannot race.

```
0001_sessions.sql
0002_rooms_and_members.sql
0003_gameplay.sql
0004_keepsakes.sql
0005_media.sql
0006_indexes.sql
```

Run on deploy, before the server accepts traffic. Each file is idempotent
(`if not exists`) so a re-run is safe.

**No data migration.** There is no Supabase project with data in it.

**Rollback:** these are additive. If a deploy fails, the previous image is
redeployed; the schema is forward-compatible with it because nothing is dropped
in the first release. Destructive changes, when they come, go in their own
release after the code that stopped using the column has shipped.

---

## 11. Deployment strategy

1. `railway-migration` branch. Both transports coexist; `createTransport` picks
   Railway only when `NEXT_PUBLIC_WS_URL` is set, Supabase when the Supabase
   vars are, else local. **Nothing is deleted.**
2. Railway project, Postgres service, `web` service from GitHub.
3. Migrations run on boot.
4. Test against the real deployment (§ Real deployment testing).
5. Only then: delete `lib/supabase/**`, `SupabaseRoomTransport`,
   `supabase/rls*.mjs`, and the Supabase env vars, on the same branch.
6. Merge to `main`.

Health check at `/api/health` (DB ping + WS listener). Railway holds traffic on
the old deployment until it passes, so a bad migration does not take the site
down.

---

## 12. Backup and recovery

Railway Postgres offers backups on paid plans — **confirm the retention on
Hobby before relying on it**, because I could not verify Hobby-tier retention
and will not guess.

Regardless, I propose `pg_dump` to R2 nightly from a scheduled job, keeping 7
dailies and 4 weeklies. At this data size a dump is a few MB and costs
effectively nothing. Recovery is `pg_restore` into a fresh Railway Postgres and
repointing `DATABASE_URL`.

**What is genuinely at risk if the database is lost:** live rooms only. Rooms
expire in 24 hours by design. Everything a couple *keeps* — memories, letters,
gifts, scrapbook, strips — is in their own browser's localStorage and is not in
the database at all (Decision E). So the blast radius of total database loss is
"in-progress games end", not "people lose their things". That is a genuinely
comfortable position and it argues for keeping it.

R2 has no versioning by default; I will enable object versioning on the bucket
so a bad delete is recoverable.

---

## 13. Logging and error monitoring

Structured JSON to stdout, which Railway collects. Every line carries a request
id; room operations carry `room_id` and `session_id` — **never** the session
JWT, never room `state` contents (that is the players' private conversation).

Errors: Sentry's free tier (5k events/month) is sufficient and I would wire both
the Next.js and WS error paths to it. `app/global-error.tsx` and `app/error.tsx`
already exist as the client boundary.

Counters worth having from day one: WS connections, subscribe denials, patch
conflicts, host migrations, media upload failures, rate-limit rejections. The
denial and conflict counters are the ones that tell you something is wrong
before a user does.

---

## 14. Expected Railway resource requirements

Estimated from the process shapes, stated so you can check my reasoning:

| Service | RAM | vCPU | Volume |
|---|---|---|---|
| `web` (Next.js + WS), 100 users | ~400 MB | ~0.1 | — |
| `web`, 1k users | ~800 MB–1 GB | ~0.3 | — |
| `web`, 10k users | 2 × 1 GB | ~1.0 | — |
| Postgres, 100 users | ~300 MB | ~0.05 | 1 GB |
| Postgres, 1k users | ~500 MB | ~0.1 | 2 GB |
| Postgres, 10k users | ~2 GB | ~0.5 | 10 GB |

A WebSocket connection costs roughly 50–100 KB in Node, so even 1,000 concurrent
sockets is ~100 MB — connections are not the constraint; Next.js rendering is.

---

## 15. Estimated monthly cost

Railway rates used: **RAM ~$10/GB-month, vCPU ~$20/vCPU-month, volumes
$0.15/GB-month, egress $0.05/GB** (railway.com/pricing, checked today).
R2: **$0.015/GB-month, egress $0, 10 GB + 1M Class A ops free**.

"Active users" below means monthly actives; I assume ~5% concurrent at peak and
two sessions per user per month.

### ~100 active users

| | |
|---|---|
| `web` — 0.4 GB, 0.1 vCPU | ~$6 |
| Postgres — 0.3 GB, 0.05 vCPU, 1 GB volume | ~$4 |
| Egress ~2 GB | ~$0.10 |
| **Railway usage** | **~$10** |
| R2 — ~0.6 GB new/month, well inside free tier | **$0** |
| **Total** | **~$10/month** |

### ~1,000 active users

| | |
|---|---|
| `web` — 1 GB, 0.3 vCPU | ~$16 |
| Postgres — 0.5 GB, 0.1 vCPU, 2 GB volume | ~$7 |
| Egress ~20 GB | ~$1 |
| **Railway usage** | **~$24** |
| R2 — ~6 GB/month new, ~20 GB stored | **~$0.20** |
| **Total** | **~$25/month** |

### ~10,000 active users

| | |
|---|---|
| `web` — 2 instances × 1 GB, ~1 vCPU | ~$40 |
| WS split into its own service — 2 × 1 GB, 0.8 vCPU | ~$36 |
| Postgres — 2 GB, 0.5 vCPU, 10 GB volume | ~$32 |
| Redis (fan-out + shared rate limit) | ~$3 |
| Egress ~200 GB | ~$10 |
| **Railway usage** | **~$120** |
| R2 — ~200 GB stored | **~$3** |
| **Total** | **~$125/month** |

### Is the $5 Hobby plan sufficient? **No — and I would not pretend otherwise.**

Hobby is $5/month **including $5 of usage**. The minimum honest footprint here is
a web service and a database, ~$10/month of usage. So the realistic bill on
Hobby at 100 users is **$5 subscription + ~$5 overage ≈ $10/month**.

Hobby is still the **right plan to be on** — you are not blocked, you simply pay
for what you use above $5. The Free tier ($1 credit) is not viable for anything
with a database.

**If you want to get closer to $5,** the one legitimate lever is moving the
database off Railway to a provider with a real free tier (Neon and Supabase both
offer one). Railway then runs only the web service, ~$6/month → about $6 total.
The trade-off: it is no longer "Railway PostgreSQL" as you specified, you add a
cross-provider network hop on every query, and free tiers cold-start. **I am not
choosing this for you.** If keeping it on Railway is the point, budget $10.

What I will not do is trim RAM below what the process needs, or drop the
database backup, or put the WS server on a free tier that sleeps — those buy $3
and cost you reliability.

---

## 16. Additional services required

| Service | Why | Cost |
|---|---|---|
| **Cloudflare R2** | Object storage. Railway has none with signed URLs. Required by requirements 5 and 6 | $0 to ~$3/month |
| **Sentry** (optional, recommended) | Error monitoring | $0 (free tier) |
| **Redis** (10k users only) | Cross-instance WS fan-out, shared rate limiting | ~$3/month, later |

An R2 account is a Cloudflare signup and a bucket. It needs no domain and no
Cloudflare-proxied DNS.

---

## 17. Limitations and risks versus Supabase

**Honest losses:**

1. **RLS is a real guarantee; application-level checks are a discipline.** With
   RLS, a forgotten filter returns nothing. Without it, a forgotten
   `assertRoomMember` returns everything. §7 mitigates this four ways, but it is
   strictly weaker, and it is the main reason to think twice.
2. **You now operate a database.** Backups, connection limits, upgrades, disk.
   Supabase did that.
3. **Auth is yours.** Session expiry, secret rotation, cookie flags. The current
   design is small and standard, but it is code you own that you did not before.
4. **Email and Google sign-in disappear** (Decision D). They do nothing today,
   so nothing breaks — but rebuilding them later is real work.
5. **A single `web` service is a single point of failure** until you split it.
6. **Rate limiting stays per-process** until Redis, so it thins rather than caps
   across instances. Already true today.

**Honest gains:**

1. **The write-amplification problem disappears.** Presence stops rewriting the
   room document (§6). This was the outstanding H4 finding and Supabase made it
   awkward to fix; a WebSocket server makes it natural.
2. **Photos leave the message channel** for real object storage, which is what
   requirements 5 and 6 asked for and what Supabase Storage was declared for but
   never wired to.
3. **The session token stops living in `localStorage`** and becomes HttpOnly.
4. **Host claims get server-side validation**, not just client agreement.
5. **One vendor fewer**, and no PostgREST layer between the app and its data.

**The risk I would watch:** §7. Everything else is ordinary engineering.

---

## Decisions I need from you

I am not choosing these silently.

**A. Patch semantics.** I propose keeping client-side read-modify-write with a
server-side compare-and-set — identical to what the Supabase transport does, so
`patchState(fn)` and all 20 experiences are untouched. The alternative, a fully
server-authoritative model, is architecturally cleaner but means rewriting every
`setData(c => …)` call site in every experience. **Recommend: keep. Confirm?**

**B. Object storage provider.** R2 for free egress. Alternatives: Backblaze B2
(cheap, egress not free), S3 (egress expensive), self-hosted MinIO on Railway
(one more service, a volume, and ops you do not want). **Recommend: R2.**

**C. Service topology.** Next.js + WS in one service to start (~$5/month
cheaper), splitting at ~10k users. The alternative is splitting now for isolation
at higher cost. **Recommend: combined.**

**D. Email and Google sign-in.** Currently Supabase-only, and decorative —
nothing reads the session, no data is scoped to a signed-in user. Options:
(i) drop it, replacing the panel's content with the guest-session explanation
that is already there when Supabase is unconfigured; (ii) rebuild it on Railway
with a mail provider, which is real work for a feature nothing uses yet.
**Recommend: (i) drop for now.** This removes a visible (if inert) UI element,
so I want you to say yes.

**E. Keepsake data — memories, letters, gifts, scrapbook, strips, designs.**
These are localStorage-only today. Moving them server-side would enable
cross-device access, but it changes the product's privacy story ("everything you
keep stays on your device"), the copy that says so, and adds real cost and
backup obligation. **Recommend: leave local.** Moving them is a product
decision, not a backend migration, and it should be its own piece of work.

**F. Photobooth thumbnails.** Adding a ~1 KB placeholder so the strip fills in
progressively instead of popping after the upload round-trip. Snap Hunt already
works this way. It is the only UI-adjacent change I am proposing and it exists
purely so the migration does not make Photobooth feel slower. **Recommend: add.**

---

## What happens on approval

Incremental, on `railway-migration`, with `npm test`, `npm run build` and
`npx tsc --noEmit` green at every step:

1. Session layer + `sessions` table + middleware
2. Postgres data layer + migrations + authorization gates
3. WebSocket server + `RailwayRoomTransport`
4. Media: R2 + signed URLs + Photobooth/Snap Hunt upload paths
5. Security suite (the equivalent of the 76 RLS assertions, against HTTP and WS)
6. Deploy to Railway; two-device testing on real networks
7. Only then remove Supabase
8. `docs/GOING-LIVE.md` rewritten for Railway

**Nothing is deleted before step 7, and I will not call it production ready
until step 6 passes on real devices.**

---

# Migration checklist

Approved with decisions A–F as proposed. Updated as each stage lands.

| # | Stage | Status |
|---|---|---|
| 1 | Create `railway-migration` branch | ☑ done |
| 2 | Postgres data layer + migrations + authorization gates | ☑ done |
| 3 | Anonymous session layer | ☑ done |
| 4 | WebSocket / realtime server | ☐ |
| 5 | `RailwayRoomTransport` behind `RoomTransport` | ☐ |
| 6 | R2 media storage + signed URLs | ☐ |
| 7 | Photobooth thumbnail flow (Decision F) | ☐ |
| 8 | Remove decorative email/Google sign-in (Decision D) | ☐ |
| 9 | Connect experiences to the new transport | ☐ |
| 10 | Integration + security test suite | ☐ |
| 11 | Full local suite green | ☐ |
| 12 | Deploy staging instance to Railway | ☐ |
| 13 | Security tests against the deployed instance | ☐ |
| 14 | Two devices, separate networks | ☐ |
| 15 | Prepare production deployment | ☐ |
| — | Remove Supabase (only after 14 passes) | ☐ |

**Gates.** `npm test`, `npm run build` and `npx tsc --noEmit` stay green at every
stage. Supabase is not touched before stage 14 passes. No claim of production
readiness before stage 14.
