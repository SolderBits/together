# Stage 11 — deployment readiness

What was wrong, what was done, and the test that proves it. The deployment
instructions themselves are in [GOING-LIVE.md](GOING-LIVE.md).

The theme of this stage: everything before it tested the source. Railway runs
something else — a production-only install of built artefacts, started by
`node dist/server.mjs`, with no TypeScript, no loader and no devDependencies on
disk. Two of the issues below were invisible until something actually ran that.

```bash
npm run check:production   # the rehearsal: clean --omit=dev install, real boot
npm run predeploy          # verify + the rehearsal, everything before a deploy
```

---

## Issues found and fixed

### 1. The built server could not find its migrations — BLOCKER

`server/index.ts` imports `../db/migrate.mjs`, which locates its SQL files
relative to its own `import.meta.url`. esbuild inlined it into `dist/server.mjs`
— so at runtime that resolved to `dist/migrations`, which does not exist. The
first production boot would have exited on `ENOENT`.

Nothing caught it because every test calls `migrate()` from source through tsx.
The bundle had never run.

**Fixed** by marking `../db/migrate.mjs` external, so it stays a real file with
an honest location, plus an explicit error in the runner naming the cause if it
ever happens again. **Proven** by the rehearsal, which boots the built server
and sees `{"event":"boot.migrated","applied":3}`.

### 2. `esbuild` was an undeclared dependency — HIGH

`scripts/build-server.mjs` imports it. It is in neither `dependencies` nor
`devDependencies` — the build worked only because `tsx` happens to depend on it
and npm hoisted it. A tsx release that changes that breaks the build.

**Fixed** by declaring it. **Proven** by `check:production`, which asserts
esbuild is absent from a production install and present for the build.

### 3. Nothing enforced the restricted database role — HIGH

`db/role.sql` creates `together_app`, which can touch five tables and nothing
else. Nothing checked that the application actually connected as it, and the
easy path — point `DATABASE_URL` at the superuser Railway hands you — works
perfectly, looks fine, and quietly removes the only thing standing between a bug
in the authorization code and a breach.

**Fixed** with `assertRestrictedRole()` on boot: in production, a connection
that is a superuser, bypasses RLS, can create objects, or owns the tables stops
the deploy. Railway holds traffic on the previous deployment while it exits.

**Proven** twice: in the deployment suite, and in the rehearsal, which boots a
real production process on a privileged connection and asserts it exits 1 naming
`role.sql` — without printing the connection string.

`DB_ROLE_ENFORCEMENT=warn` downgrades it, for local rehearsals against a PGlite
database that has only one role. Every boot that uses it says so loudly, and the
rehearsal boots once *without* it to prove the strict path still refuses.

### 4. `db/role.sql` had never been executed by anything — MEDIUM

It is run once by hand and trusted forever. The deployment suite now runs it
against a real schema and then tries to break out: create a table, drop one,
alter one, read the migration ledger, read `pg_authid`. All five refused; a
plain `select` on `rooms` allowed.

### 5. The health check could not see most of what it reported on — HIGH

It pinged the database and returned `ok`. A process with a half-applied schema,
or with no WebSocket server attached, passed and took traffic.

The naive fix would have been worse than the bug: `server/index.ts` is bundled
by esbuild while route handlers are compiled by Next, so each has its own module
instances. Importing `realtimeStats()` into the route reports on a second, idle
copy — reliably saying "no realtime" while realtime works perfectly.

**Fixed** with `lib/server/runtime-status.ts`, a symbol on `globalThis` written
by whoever performs a step and read by whoever reports on it. `/api/health` now
answers per component and is healthy only when all are:

```json
{"ok":true,"mode":"hosted",
 "checks":{"database":true,"migrations":"ready","realtime":"listening"}}
```

**Proven** by 14 assertions covering pending migrations, failed migrations,
detached realtime, a draining instance, an unreachable database, and recovery —
plus `no-store` at every cache layer and a check that the payload describes
nothing about the deployment.

### 6. A refused first database connection failed the deploy — MEDIUM

Railway starts the application and Postgres as separate services and does not
order them. A container that boots a moment early gets its first connection
refused and exits; with three restart retries, a deploy can fail for something
that resolved itself two seconds later.

**Fixed** with `waitForDatabase()` — bounded retry with backoff, on the first
connection only. A later failure is a real failure and belongs in the health
check, not in a loop.

### 7. Logging was ad-hoc and unredacted — MEDIUM

Nineteen `console.*` calls with bracket prefixes, several passing whole error
objects. Now one structured logger: JSON per line in production, readable lines
otherwise, with redaction by field name, by value shape, and recursively —
because the realistic way a token reaches a log is not `log.info("token", t)`,
it is an error that happens to carry a request.

Redacted: session tokens, cookies, JWTs, database URLs with passwords, API keys,
private key blocks, and **signed URLs** — a signed URL is a bearer capability,
and logging one hands it to whoever reads the log.

**Proven** by throwing seven secrets at the logger under obvious names, innocent
names, nested five deep, inside errors and inside causes, then asserting none
appears — including in fragments.

**And the first version was wrong.** Mutation testing showed the field-name rule
never fired: an anchored `^(.*_)?(secret|…)$` catches `SESSION_SECRET` and sails
straight past `r2Secret`, `apiKey`, `secretAccessKey`. Worse, the test that
should have caught it named a secret it never actually logged. Both fixed: the
matcher now splits camelCase and matches word by word, and the suite asserts on
14 names that must be redacted and 10 — `sessionId`, `roomCode`, `playerId` —
that must survive, because a logger that redacts everything is safe and useless.

### 8. Shutdown could hang until the platform killed it — LOW

`server.close()` waits for in-flight requests, including keep-alive connections
that will never send another. Railway then SIGKILLs, turning an orderly shutdown
into a hard one. Added a `SHUTDOWN_TIMEOUT_MS` deadline (10s default).

**Proven** by the rehearsal: SIGTERM to a real production process, asserting
exit 0, under 15 seconds, `shutdown.begin` through `shutdown.complete`, and
**not** via the forced path.

### 9. A localhost public URL would have deployed cleanly — MEDIUM

`ws://` in production was already refused. `wss://localhost:3000/ws` was not —
and it is the mistake that survives review, because it is correct everywhere
except production, where it points every visitor's browser at their own machine.
Now `NEXT_PUBLIC_WS_URL` and `NEXT_PUBLIC_SITE_URL` are both refused if they
name a loopback host.

### 10. No deployment configuration at all — MEDIUM

No `railway.json`, no Node pin. The platform would have guessed the build
command, the start command and the Node major — the last of which matters,
because the server bundle targets node20.

Added `railway.json` (build, start, `/api/health` check, restart policy),
`.node-version`, and an `engines` field.

---

## New structural guards

`npm run check:db` grew from six checks to eight:

7. **No debug, test or environment-dumping endpoints.** A debug route is written
   to be temporary and then is not.
8. **`.gitignore` keeps env files out of Git.**

`npm run check:bundle` already refuses a runtime import that is not a production
dependency. `npm run check:production` is new and is the strongest of them: it
builds, installs with `--omit=dev` into a clean directory, and boots the result.

Every guard above was verified by planting a violation and watching it fail.

---

## What the rehearsal proves

50 assertions, against a production-only install of the built artefacts:

- every production dependency installs; every devDependency is absent
- every bare import in `dist/server.mjs` resolves — `ws`, `pg`, `jose`, `next`,
  both AWS SDK packages
- migrations run from the bundle and find their SQL
- a privileged connection stops the boot, exit 1, naming the fix, without
  printing the connection string
- the server binds `PORT`, becomes healthy, and reports every component
- boot logs are JSON, one object per line, carrying no secret
- pages serve; a guest session is created; the cookie is HttpOnly, Secure and
  SameSite=Lax
- a WebSocket upgrade with a session succeeds and without one is refused
- SIGTERM exits 0, promptly, logged start to finish, not forced

---

## Still requires real Railway infrastructure

- **R2 has never moved a byte.** The adapter is written, typechecked and tested
  against the local adapter with real bytes and real signatures. Cloudflare
  itself is untouched.
- **Real network Postgres** — TLS, latency, connection limits, failover.
- **The restricted role on a real connection.** PGlite ignores the user in a
  connection string, so the *grants* are proven and the *connection* is not.
- **Railway's proxy** handling the WebSocket upgrade. Verified against Node's
  own HTTP server.
- **Multiple instances.** Rate limits, the AI ceiling and socket bookkeeping are
  per-process.
- **Two devices on separate networks** — stage 14.
