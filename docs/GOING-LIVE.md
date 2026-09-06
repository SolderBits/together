# Going live

The path from here, one node at a time. Each step has a way to tell whether it
worked — don't move on until it says so.

```
CURRENT ──> SUPABASE SETUP ──> REAL DATABASE TEST ──> DEPLOY ──> PHONE + LAPTOP ──> PRIVATE BETA
```

---

## Where you are

Codebase and local tests are done. `npm test` runs 91 assertions — 15 on host
election, 76 on the RLS policies against an in-process Postgres — and both pass.

That proves the policies are correct **as written**. It cannot prove they are
correct **as deployed**: that the SQL actually ran, that anonymous sign-in is on,
that PostgREST enforces what the file says. That is the next two nodes.

---

## 1. SUPABASE SETUP — yours to do

This is the one step I can't do for you. It needs your account, and I shouldn't
be handling your keys. It's about ten minutes.

1. **Create a project** at supabase.com. Pick a region near you and your tester.

2. **Enable anonymous sign-in.** Authentication → Providers → Anonymous sign-ins.
   **The entire security model depends on this.** Guests never make an account,
   so anonymous sessions are what give them an `auth.uid()` for the policies to
   check. With it off, every room query fails.

3. **Run the schema.** SQL Editor → paste `supabase/schema.sql` → Run. It is
   written to be safe to run more than once, so if you're unsure, run it again.

4. **Copy the keys** into `.env.local` (copy `.env.example` first):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<the anon / public key>
   ```
   Project Settings → API. **Use the anon key, not the service role key.** The
   anon key is meant to be public — every browser gets it — which is exactly why
   the policies have to hold on their own.

5. Leave `ANTHROPIC_API_KEY` empty for now. The offline judge is good, and an
   unmetered key behind a public endpoint is the wrong thing to add on the day
   you first go live. Add it after the beta, with a shared rate limiter.

---

## 2. REAL DATABASE TEST

```bash
npm run test:rls:live
```

Same matrix as the offline suite, but against your project, using nothing but
the anon key — exactly what a browser has, and exactly what an attacker would
have. It creates three anonymous visitors, has one host a room and one join it,
then checks what the third can reach. It cleans up after itself.

It also checks the two things that go wrong most often at this step, and names
them specifically: anonymous sign-in still switched off, and the schema not
actually applied.

Beyond the offline matrix it verifies two things only a real instance can show:
concurrent writes are rejected rather than blended, and **a non-member receives
no realtime changes** for a room they aren't in — realtime is a separate
enforcement path from PostgREST, and it's the one people forget.

**Do not deploy until this is green.** If anything fails, re-run `schema.sql`
and check anonymous sign-in.

---

## 3. DEPLOY

Push to Vercel (or wherever). Set the same two `NEXT_PUBLIC_*` variables in the
host's environment — they're baked in at build time, so a deploy without them
silently ships local mode and cross-device rooms won't work.

Set `NEXT_PUBLIC_SITE_URL` to the deployed origin so invite links and QR codes
point at the right place.

Then, from the deployed URL:
- open a room, check the browser console for the anonymous-sign-in warning the
  client logs if the provider is off;
- confirm `Profile → Connection` reads `supabase` rather than `local`.

---

## 4. PHONE + LAPTOP

The first test that has never been possible before: two *devices*, not two tabs.

Work through these in order. The first three are the ones most likely to break,
because they've only ever run against the local transport:

1. **A room across devices.** Create on the laptop, join by code on the phone.
   Both seats fill.
2. **Host migration for real.** Lock the phone. Wait past 45 seconds. The laptop
   takes over and the game continues. Unlock the phone: the laptop keeps it.
   Locally verified; over a real network with real latency is a different claim.
3. **Reconnection.** Put the phone in airplane mode mid-game for 20 seconds,
   then back. No duplicate answers, no lost score, no spurious migration.
4. **The iOS export.** Photobooth → four photos → Save the strip. This is the
   path I could not test — no Apple device here. Expect the share sheet. Confirm
   the strip reaches the camera roll at full size, and that the message on screen
   matches what actually happened.
5. **Snap Hunt with a real camera**, which has also never run on real hardware.
6. **Watch Together** with both devices on the same video.
7. **375px reality check** — it passes in an emulated viewport, but check the
   safe-area behaviour on a notched phone. `viewport-fit=cover` is set and there
   are no `env(safe-area-inset-*)` paddings yet; this is where that shows up.

---

## 5. PRIVATE BETA

Before handing it to anyone:

- **Schedule room cleanup:**
  ```sql
  select cron.schedule('prune-rooms', '17 * * * *', $$select public.prune_stale_rooms()$$);
  ```
- **Re-run `npm run test:rls:live` against production** if it's a different
  project from the one you tested.
- Decide what you're doing about the MEDIUM findings in `LAUNCH-AUDIT.md` —
  offline detection and safe-area insets are the two a beta tester will notice.
- Tell testers plainly that rooms disappear after 24 hours and that anything
  they keep lives on their own device.

**Still true after all of this:** presence writes the whole room document every
three seconds (audit H4). Fine for a handful of rooms, wrong at scale. Fix it
before the beta grows, not before it starts.

---

## Correction to `LAUNCH-BLOCKERS-FIXED.md`

That report's security sweep said `service_role` had **no occurrences anywhere**.
That was overstated — my search covered `.ts`, `.tsx`, `.sql`, `.json` and `.md`,
and missed dotfiles. `SUPABASE_SERVICE_ROLE_KEY` appears in `.env.example`, as an
empty, documented placeholder marked server-only.

No key is present and nothing reads that variable, so the conclusion holds. The
claim was wrong; the finding wasn't. Worth knowing since you're about to fill
that file in — **leave it empty.**
