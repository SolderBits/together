# Going live on Railway

Every step has a way to tell whether it worked. Don't move on until it says so.

```
RAILWAY PROJECT ──> POSTGRES ──> VARIABLES ──> FIRST DEPLOY ──> RESTRICTED ROLE
        ──> WEBSOCKET URL ──> R2 ──> HEALTH ──> TWO DEVICES ──> PRIVATE BETA
```

Nothing here contains a real credential, and nothing here asks you to put one in
a file that Git tracks. Every value goes into Railway's variable settings or
your local `.env.local`, which is ignored.

> Supabase is still installed and still works. It is removed at stage 14 of
> [RAILWAY-MIGRATION-PLAN.md](RAILWAY-MIGRATION-PLAN.md), once this path has run
> on real infrastructure. Nothing below needs a Supabase key, and
> `SUPABASE_SERVICE_ROLE_KEY` is not required by anything in the application.

---

## Before you start

Locally, from the project root:

```bash
npm run verify
```

Types, all nine suites, a real build, and a scan of that build for leaked
secrets. Then the deployment rehearsal — a clean production-only install of the
built artefacts, booted and driven the way Railway will:

```bash
npm run check:production
```

Both must pass before any of what follows. They are what makes the rest of this
document a checklist rather than a hope.

---

## 0. The one thing that must be done by hand

```bash
railway login
```

Everything else below can be driven from the CLI, but this cannot: it opens a
browser and authenticates *you*. Nothing automated should ever hold your
Railway session.

The Cloudflare side (step 7) is the same — creating the account, the bucket and
the API token is yours to do, and the four values go straight into Railway
without passing through anything else.

---

## 1. Create the Railway project

1. Sign in at [railway.com](https://railway.com) and create a project.
2. **Deploy from GitHub repo** → pick this repository → the `railway-migration`
   branch (or `main`, once merged).
3. Railway reads [`railway.json`](../railway.json) and does not need any build
   configuration entered by hand. It says:

   | Setting | Value |
   |---|---|
   | Builder | Nixpacks |
   | Build command | `npm run build` |
   | Start command | `npm start` |
   | Health check | `/api/health`, 120s timeout |
   | Restart policy | on failure, 3 retries |

4. Node version comes from [`.node-version`](../.node-version) and the `engines`
   field: **Node 20**. Don't override it — the server bundle targets node20.

**The first deploy will fail.** It has no database and no session secret, and
the environment check stops it rather than starting something half-configured.
That is the correct behaviour and the next steps fix it.

---

## 2. Add PostgreSQL

In the project: **New → Database → Add PostgreSQL**.

Railway creates it with its own superuser and exposes `DATABASE_URL` to the
project. **Do not leave the application pointed at that connection** — step 5
replaces it. If you do, the app refuses to start in production and tells you so.

Two connection strings matter, from the Postgres service's **Variables** tab:

- `DATABASE_URL` — the private network address (`*.railway.internal`). Use this
  between services: no egress cost, no public exposure.
- `DATABASE_PUBLIC_URL` — reachable from your laptop. You need it once, in
  step 5, and never again.

---

## 3. Configure variables

On the **application** service → **Variables**. Full descriptions are in
[`.env.example`](../.env.example), grouped the same way.

### Required

| Variable | Where it comes from |
|---|---|
| `DATABASE_URL` | Set in step 5 to the `together_app` connection. Until then, reference Postgres's own: `${{Postgres.DATABASE_URL}}` |
| `MIGRATE_DATABASE_URL` | The **owner** connection: `${{Postgres.DATABASE_URL}}`. Used only to run migrations on boot |
| `SESSION_SECRET` | Generate: `openssl rand -hex 32`. 32 characters minimum, or the app refuses to start |
| `NEXT_PUBLIC_WS_URL` | Set in step 6, once you have the public domain. Must be `wss://` |

`PORT` is injected by Railway. Do not set it. The server binds `process.env.PORT`
on `0.0.0.0`, which is what the platform expects.

### Recommended

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://<your-app>.up.railway.app` — invite links and QR codes |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | Step 7. All four together or none |
| `ANTHROPIC_API_KEY` | Optional. Without it, Debate and Couples Court use the offline judge |

### Leave unset

`DB_ROLE_ENFORCEMENT` — local rehearsal only. Setting it in production turns off
the check that keeps a bug in the authorization code from becoming a breach.

`SESSION_SECRET_PREVIOUS` — only for one deploy after rotating the secret.

> **Never** prefix a secret with `NEXT_PUBLIC_`. That prefix means "compile this
> into the page source". `npm run check:db` fails the build for secret-shaped
> `NEXT_PUBLIC_` names, and `npm run check:bundle` greps the built output.

---

## 4. First real deploy, and the migrations

Push, or hit **Deploy**. Migrations run automatically on boot, before the
process listens, using `MIGRATE_DATABASE_URL`:

- an advisory lock, so two instances starting together don't race
- a ledger (`schema_migrations`), so nothing runs twice
- each file in its own transaction, so a failure leaves the last good state

Railway holds traffic on the previous deployment until `/api/health` passes, so
a failed migration cannot take the site down.

**Verify** — in the deploy logs, one JSON line per event:

```
{"level":"info","event":"boot.migrated","applied":3}
{"level":"info","event":"boot.realtime","path":"/ws"}
{"level":"info","event":"boot.ready","hostname":"0.0.0.0","port":8080}
```

If you ever need to run them by hand:

```bash
MIGRATE_DATABASE_URL='<owner connection>' npm run db:migrate
```

---

## 5. Create the restricted application role

This is the step that makes the authorization model hold when the application
code is wrong. Do not skip it — in production the app checks and refuses to
start on a privileged connection.

1. Open [`db/role.sql`](../db/role.sql) and replace `REPLACE_ME` with a password
   you generate (`openssl rand -hex 24`). Do not save that edit into Git.
2. Run it once against the database, as the owner. Either paste it into
   Railway's Postgres **Data → Query** tab, or:

   ```bash
   psql '<DATABASE_PUBLIC_URL>' -f db/role.sql
   ```

3. Build the application's connection string from the owner's, replacing the
   user and password with `together_app` and the password from step 1, keeping
   the same host, port and database name.
4. Set the app's `DATABASE_URL` to that string. Leave `MIGRATE_DATABASE_URL`
   as the owner.
5. Redeploy.

**Verify** — the deploy logs show:

```
{"level":"info","event":"boot.database-role","role":"together_app","restricted":true}
```

If it says `restricted:false`, or the deploy fails with
`PrivilegedConnectionError`, the app is still on the owner connection. What the
role can and cannot do is covered by `npm run test:deploy`, which runs
`db/role.sql` against a real schema and then tries to break out of it.

---

## 6. Public URL and the WebSocket

1. Application service → **Settings → Networking → Generate Domain**. You get
   `https://<something>.up.railway.app`.
2. Set on the application service:
   - `NEXT_PUBLIC_WS_URL` = `wss://<something>.up.railway.app/ws`
   - `NEXT_PUBLIC_SITE_URL` = `https://<something>.up.railway.app`
3. Redeploy. Both are compiled into the browser bundle at build time, so a
   change to either needs a rebuild, not just a restart.

Notes that matter:

- **`wss://`, not `ws://`.** The app refuses to start on `ws://` in production —
  an unencrypted socket would carry the session cookie in the clear.
- **Not `localhost`.** The app refuses that too. In a browser it means the
  visitor's own machine.
- **Same host as the site.** HTTP and the socket are one service on one port
  (Decision C). Railway's proxy handles the upgrade on `/ws` with no extra
  configuration. Splitting them later is an environment variable, because the
  browser is told where to connect rather than assuming same-origin.

---

## 7. Cloudflare R2

Without this, photos are written to the container's disk and **lost on every
deploy**. The app boots and warns; it does not stop you. Photobooth and Snap
Hunt are the features that depend on it.

1. Cloudflare dashboard → **R2 → Create bucket**. Any name.
2. **Keep it private.** No public access, no custom public domain. Every read
   and write goes through a URL this server signs for one object, for a few
   minutes.
3. **Manage R2 API Tokens → Create API token**, permission **Object Read &
   Write**, scoped to that bucket.
4. Set on the application service: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
   `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`. All four, or the app refuses to start —
   three of four is a deployment that silently writes to disk.

**Verify** — logs show `"storage":"r2"` rather than `"local-disk"`, then take a
photo in Photobooth on one device and confirm it appears on the other.

> Untested until you do this: the R2 adapter is written, typechecked and covered
> against a local adapter with real bytes and real signatures, but it has never
> moved a byte to Cloudflare. This is the first time it will.

---

## 8. Health check

`GET /api/health` answers for each part separately and is only healthy when all
of them are:

```json
{
  "ok": true,
  "mode": "hosted",
  "checks": { "database": true, "migrations": "ready", "realtime": "listening" },
  "uptimeSeconds": 42
}
```

- **200** — serving.
- **503** — something named in `checks` is not ready. Railway holds traffic on
  the previous deployment.

It deliberately reveals nothing about the deployment: no host names, no
versions, no counts, no role names. It is uncacheable at every layer.

```bash
curl -i https://<your-app>.up.railway.app/api/health
```

---

## 9. Two devices, two networks

The step that finds what nothing local can. Phone on mobile data, laptop on
wifi — **not** the same wifi, or you are testing your router.

1. Laptop: open the site, start a room, note the code.
2. Phone: join with the code.
3. Both see each other in the lobby, with names and presence.
4. Play a round of something turn-based (Know Me), something realtime (Draw
   Together), and something with a photo (Photobooth).
5. Put the phone in flight mode for 30 seconds, then bring it back. It should
   reconnect and resynchronise without losing the room.
6. Redeploy while both are connected. Both should report reconnecting and then
   recover — the server tells clients before it closes their sockets.

---

## 10. Rollback

**Fastest — a bad deploy.** Railway keeps every previous deployment. Project →
**Deployments** → the last good one → **Redeploy**. It takes about a minute and
does not touch the database.

**A bad environment variable.** Fix it in **Variables** and redeploy. Anything
`NEXT_PUBLIC_` needs a rebuild, not a restart.

**A bad migration.** Migrations are forward-only by design — there are no down
scripts, because a down script that has never been run is not a rollback plan.
Recovery is:

1. Redeploy the previous version. It will not re-run the new migration, and
   `if not exists` means the schema being ahead is usually harmless.
2. If the schema change is genuinely incompatible, restore the database from a
   Railway backup, then redeploy the previous version.

Take a backup before any deploy carrying a migration:
**Postgres service → Backups → Create backup**.

**Rotating a leaked secret.** `SESSION_SECRET`: set `SESSION_SECRET_PREVIOUS`
to the old value and `SESSION_SECRET` to a new one, deploy, then remove the
previous one on the next deploy — nobody is signed out. R2 keys: create a new
token, update all four variables, deploy, then delete the old token. Database:
`alter role together_app with password '...'`, update `DATABASE_URL`, deploy.

---

## The CLI path

The dashboard steps above have an equivalent sequence, which is what a repeat
setup should use. After `railway login`:

```bash
railway init                          # create the project, name it
railway add --database postgres       # provision Postgres
railway link                          # link this directory to the service
```

Set variables without their values ever appearing in a terminal history or a
log — the shell substitutes, the CLI transmits, nothing prints:

```bash
railway variables --set "SESSION_SECRET=$(openssl rand -hex 32)"
railway variables --set 'MIGRATE_DATABASE_URL=${{Postgres.DATABASE_URL}}'
railway variables --set 'DATABASE_URL=${{Postgres.DATABASE_URL}}'
```

`DATABASE_URL` is replaced with the `together_app` connection in step 5; until
then the app will refuse to start in production, which is the point.

```bash
railway domain                        # generate the public domain
railway up                            # build and deploy from this directory
railway logs --deployment             # watch the boot sequence
railway connect Postgres              # psql, for db/role.sql
```

The R2 values are the exception. Paste them in the dashboard, or:

```bash
railway variables --set "R2_ACCOUNT_ID=..."       # your values, your terminal
```

---

## Deploying future versions

Railway redeploys on every push to the connected branch. So:

```bash
npm run predeploy    # types, 433 assertions, a real build, a production rehearsal
git push
```

`predeploy` is what makes the push safe — it builds, installs with `--omit=dev`
into a clean directory, boots the result, and drives it over HTTP and
WebSocket. If it passes and the deploy still fails, the difference is the
platform, and `railway logs --deployment` is where it will say so.

Migrations run themselves on boot, under an advisory lock, recorded in a
ledger, each in its own transaction. Take a backup first when a deploy carries
one — **Postgres service → Backups → Create backup** — because they are
forward-only by design.

Anything `NEXT_PUBLIC_` is compiled into the browser bundle at build time. A
change to one needs a redeploy, not a restart.

---

## What this costs

At ~100 monthly actives: **~$10/month** — roughly $6 for the web service, $4 for
Postgres, R2 inside its free tier. The Hobby plan is $5/month including $5 of
usage, so expect about $5 of overage. Section 15 of the migration plan has the
figures for 1,000 and 10,000 users (~$25 and ~$125).

---

## Known limits at this scale

- **Rate limits are per-process.** One instance is the whole picture; behind
  replicas they thin traffic rather than cap it. Revisit before scaling out.
- **One instance is the assumption.** Sockets, presence bookkeeping and the AI
  spend ceiling all live in the process. Two instances need a shared store.
- **Media is R2 or nothing.** Container disks are ephemeral.
