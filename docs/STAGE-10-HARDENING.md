# Stage 10 — production hardening

What was wrong, what was done about it, and the test that proves it. Nothing
below is asserted from reading the code: every fix has an attack in
`lib/server/security.test.mts` that performs the thing and checks what came
back.

Run it with `npm run test:security`. Run everything with `npm run verify`.

---

## Issues found and fixed

### 1. The judging endpoint could be made to spend without limit — HIGH

**What was wrong.** `/api/judge` calls Anthropic, and each call costs money. It
has no sign-in by design — two people playing a game are never asked for one —
so its rate limit counted against `x-forwarded-for`. That header is written by
the caller. Rotating it defeats the limit completely.

Measured before the fix, from a single client:

```
5000 of 5000 requests from one attacker were allowed through
```

Every one of those would have been a paid model call.

**How it was fixed.** No per-caller scheme can fix this, because on an endpoint
with no identity there is nothing trustworthy to count against. So the bound is
on the total instead: `claimAiCall()` in `lib/ai/guard.ts` caps upstream calls
per minute for the whole process (`AI_CALLS_PER_MINUTE`, default 120). Past the
ceiling the deterministic offline judge answers — the same graceful path already
taken when the model is unreachable, so players still get a verdict.

**Test.** *"rotating the forwarded-for header does not buy unlimited paid
calls"* — 400 requests, a fresh spoofed address on each, with `fetch`
substituted so the count of real upstream calls is observable. Asserts upstream
calls ≤ ceiling **and** that all 400 players still got a verdict. Verified to
fail without the fix: `400 upstream calls from 400 spoofed requests, ceiling 120`.

### 2. The production server would not boot — HIGH

**What was wrong.** `dist/server.mjs` imports `ws` at runtime, but `ws` was a
**devDependency**. A production install omits those, so the deployed service
would have crashed on start with `ERR_MODULE_NOT_FOUND`. It passed every local
check because dev dependencies are installed here.

```
$ npm ls ws --omit=dev
together@0.1.0
`-- (empty)
```

**How it was fixed.** Moved `ws` to `dependencies`. Then a guard in
`scripts/check-bundle.mjs` reads every bare import out of the built server and
fails if any is not a production dependency — this class of bug is invisible
locally and only appears on the platform, so it needed a mechanism rather than
attention.

**Test.** The guard, verified by moving `ws` back and watching it fail:
`dist/server.mjs imports "ws", which is not a production dependency`.

### 3. Three dependency advisories, one critical — HIGH

`next@15.5.4` carried a critical RCE in the React flight protocol plus, among
others, *"Server-Side Request Forgery in Server Actions on custom servers"* —
which is exactly what this deployment runs. `postcss` and `sharp` came in
underneath it.

Fixed by `next@15.5.25` (a patch bump) plus overrides pinning `sharp@^0.35`
and `postcss` to the already-safe direct version. `npm audit` now reports **0
vulnerabilities**. Build, typecheck and all 357 assertions stay green on the
bumped versions.

### 4. No endpoint had a rate limit — MEDIUM

Every write endpoint creates something that costs money or space — a session
row, a room, a presigned URL, an object — and none required an account, by
design. Without a ceiling one script fills the database and the bucket, and the
first sign of it is the bill.

`lib/server/rate-limit.ts` adds per-caller budgets: sessions 20/min, rooms
30/min, media 60/min, media reads 240/min. Keyed on the session where there is
one (it survives a changing address) and the forwarded address otherwise. Only
counted when a session would actually be *created*, so a browser that already
has one is never throttled for asking.

**Tests.** *"room creation is rate limited"*, *"anonymous session creation is
rate limited"*, *"and a different caller is unaffected"*.

### 5. No cap on WebSocket connections — MEDIUM

One session could open unlimited sockets, each holding a subscription and a
database presence row. `MAX_SOCKETS_PER_SESSION = 12` and `MAX_TOTAL_SOCKETS`
(`WS_MAX_CONNECTIONS`, default 2000) are now enforced **at the handshake** — a
refused connection never becomes a socket at all.

**Test.** *"sockets per session are capped"* and *"the cap is enforced at the
handshake"* — 16 connections attempted, refusals counted.

### 6. A bad configuration failed at the first player, not at the deploy — MEDIUM

Nothing checked the environment on boot. A missing `SESSION_SECRET`, a secret
short enough to brute-force, `ws://` in production, or a secret hiding behind a
`NEXT_PUBLIC_` name would all pass the health check and fail later, in front of
someone.

`lib/server/env.ts` validates on startup, before anything listens, and throws.
Railway holds traffic on the previous deployment when boot fails, so a
misconfiguration now stops the deploy instead of reaching users.

**Test.** Six bad configurations, each asserted to throw; one good one asserted
to pass.

### 7. Signed-URL responses were sniffable — LOW

`/api/media/blob` served every object as `image/jpeg` with no
`X-Content-Type-Options`. An object a browser sniffs as HTML would run as a
same-origin page. Now the content type comes from the extension the *server*
chose when it minted the key, with `nosniff` and `content-disposition: inline`.

**Test.** *"blob responses forbid content sniffing"*.

### 8. Signed URLs were cacheable — LOW

`/api/media/:id` returns a short-lived capability. Without `no-store` a shared
cache could outlive it and hand it to whoever shares the cache. `no-store` added
there, on `/api/session`, on `/api/rooms` and on `/api/judge`.

### 9. The gates themselves were intermittently unreliable — LOW

One `npm run verify` failed and then would not reproduce. The cause was in the
test rig, not the app: all five database suites picked a random port from a
fixed band and hoped it was free, which fails occasionally. That matters more
than a flaky test usually does, because these suites *are* the evidence for
every claim in this document — and a gate that fails now and then teaches
everyone to wave the next real failure through as "that flake again".

`lib/server/testing/pg-socket.mts` now asks the operating system for a free
port and retries if something takes it in the gap. All five suites use it.

---

## Attacks proven to fail

The 69 assertions in `lib/server/security.test.mts`, against real Postgres
(PGlite over the wire protocol, driven by the real `pg` driver), the real
WebSocket server, real `ws` clients and real HMAC-signed URLs. Route handlers
are called directly — they read the session from their `Request`, so the code
under attack is the code that deploys.

| Attack | Result |
|---|---|
| Unauthenticated API access | 401 |
| Token signed with another key | 401 |
| Valid token for a **deleted** session | 401 |
| `alg:none` token | 401 |
| Malformed cookie headers (6 shapes) | handled, no crash |
| Seat spoofing over HTTP | 409 |
| Room-code substitution | 404, wording identical to a room that never existed |
| Invalid JSON, bare string, array, `null` | 400 |
| Oversized body, with and without `content-length` | 413 |
| SQL-injection-shaped codes and player ids | 400; tables intact |
| Error responses | no stack traces, SQL, paths or connection strings |
| Cross-room media access | 404, identical to media that does not exist |
| Upload ticket for a room you are not in | refused |
| Uploading as another player | refused |
| Tampered signed-URL key | 403 |
| Expired signed URL | 403 |
| Upload URL replayed as a download | 403 |
| Object key guessed without a signature | 403 |
| Path-traversal key | refused |
| WebSocket upgrade with no session / forged / deleted | refused at handshake |
| Cross-room WebSocket subscribe | denied, and no state frame arrives |
| Event leaking from one room into another | never arrives |
| Superseded socket marking a live seat offline | seat stays online |
| Connection flooding | capped at the handshake |
| Rotating spoofed addresses against a paid endpoint | bounded upstream calls |
| Six invalid startup configurations | boot refused |

Covered by `lib/server/ws/realtime.test.mts` (56 assertions), not repeated here:
malformed WS frames, oversized frames, deeply nested payloads, inline photo
payloads, message-rate flooding (closes with 1008), concurrent conflicting
writes (compare-and-set, first writer wins, version moves once), patching as
another player, host spoofing, a host claim while the host is alive, and handing
the host seat to a third party.

### The tests were checked for being green for the wrong reason

Six defences were removed one at a time and the suite re-run. Every planted hole
was detected:

| Hole planted | Assertions that went red |
|---|---|
| Media route stops checking for a session | 4 |
| `joinRoom` stops checking who owns the seat | 1 |
| Signed URLs no longer verified | 3 |
| Rate limiting always allows | 2 |
| Per-session socket cap raised out of the way | 1 |
| Startup validation waves everything through | 4 |

The bundle scan carries its own control: it asserts `NEXT_PUBLIC_WS_URL` **is**
present in the browser output, because a build that inlined nothing at all would
otherwise pass every secret check trivially.

---

## Structural guards

`npm run check:db` — six checks, each holding a property review cannot:

1. Database access confined to `lib/server/db/` (174 files checked)
2. No interpolated values in SQL
3. No server-only environment variable read from a client component
4. No secret-shaped `NEXT_PUBLIC_` name
5. **New** — no credential committed as a literal (database URLs with passwords,
   private keys, API keys, JWTs, AWS key ids), ignoring localhost development
   defaults
6. **New** — every `app/api/**/route.ts` either consults the session or is named
   in `PUBLIC_ROUTES` with the reason it is safe to leave open. Adding an
   endpoint that quietly reads room data without asking who is calling now fails
   the build. Three routes are declared public: `health`, `judge`, `media/blob`.

`npm run check:bundle` — builds with canary secrets in the environment and greps
the output for them. Confirms no secret reaches `.next/static`, none is baked
into `dist/server.mjs`, no development handles (`__togetherSocket`,
`__togetherConnection`) ship, and every runtime import is a production
dependency.

Both were verified by planting violations and watching them fail.

---

## Accepted risks

**Rate limiting is per-process.** On a single Railway service that is the whole
picture. Behind several replicas it thins traffic rather than capping it — an
attacker gets N times the budget. The AI spend ceiling has the same shape. The
fix is a shared store (Redis) and it is not worth its cost before there is
traffic to justify it. Revisit before scaling past one instance.

**`x-forwarded-for` is spoofable.** It is a throttle, not a gate. What makes an
individual request cheap is the size caps beside it, and what bounds paid work
is the global ceiling rather than the per-caller one.

**Supabase packages are still installed.** `@supabase/ssr` and
`@supabase/supabase-js` remain dependencies until stage 14, per the migration
plan — the old implementation is not deleted until the new one has run on real
infrastructure. They are unreferenced by the Railway path.

**Sessions are anonymous and bearer-based.** Whoever holds the cookie is the
session. It is HttpOnly, `SameSite=Lax`, `Secure` in production, and 30 days
sliding. There is no account to recover, by design.

---

## Still requires real Railway infrastructure

None of these can be closed locally, and none is claimed as passing:

- **R2.** Every media test runs against the local adapter. The R2 adapter is
  written and typechecked but has never moved a byte. Stage 12.
- **Postgres over the network.** Tests use PGlite over a real wire-protocol
  socket with the real driver — real SQL, but not real latency, TLS, connection
  limits or failover.
- **Multi-instance behaviour.** Rate limits, the AI ceiling and in-memory socket
  bookkeeping are all per-process and untested against replicas.
- **Deployment boot path.** `validateEnvironment`, migrate-on-boot under
  Railway's health-check hold, and SIGTERM draining are tested as functions, not
  as a deployment.
- **Two devices on separate networks.** Stage 14.
- **iOS photo export** and **canvas thumbnail encoding**, which need a real
  browser and a real device.

---

## Gate results

```
npx tsc --noEmit    0 errors
npm run check:db    6 checks pass
npm test            357 assertions, 0 failed, across 8 suites
npm run build       clean; dist/server.mjs 41.3 kB
npm run check:bundle no secrets in the browser bundle; 6 runtime imports, all production
npm audit           0 vulnerabilities
```

Suite breakdown: session 21, realtime 56, transport 38, media 43, photobooth 39,
**security 69**, election 15, RLS 76.
