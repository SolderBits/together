# Launch blockers — what was fixed, what was not

Follow-up to `LAUNCH-AUDIT.md`. Every claim below was verified by running it;
where a test exists, it is named.

Run the suites with `npm test` (host election, then the RLS matrix).

---

## 1. Fixed

### P0 — Host migration (audit C2)

`hostId` was set once and never reassigned, so a host whose phone locked left the
room frozen with no message and no recovery. There is now a documented election
rule, implemented in `electHost()` (`lib/rooms/api.ts`) and claimed on the
existing heartbeat — no new timers, no second room architecture.

**The rule.** The host changes only when all of these hold against one snapshot
of the room document:

1. the named host's heartbeat is older than `PRESENCE_TIMEOUT_MS` (45 s),
2. the last handover was more than `HOST_ELECTION_COOLDOWN_MS` (15 s) ago,
3. at least one player is inside the presence window,
4. the successor is the online player with the lowest id, compared as a string.

Ids are opaque and random, so "lowest id" is arbitrary but **stable** and
**identical on every client**: every participant derives the same successor from
the same document without exchanging a message, and only that one client writes.

**Why it cannot produce two hosts.** The claim goes through the same
read-modify-write path as every other room update and re-checks its
preconditions against `current` *inside* the write. A second claimant — one
either side of a partition, say — reads a document whose `hostId` has already
moved and whose `hostSince` is inside the cooldown, so its patch collapses to a
no-op. The cooldown also covers the window where a new host has not yet written
its first heartbeat and so still looks stale.

**Game state is untouched.** The patch carries `hostId`, `hostSince` and the two
affected player rows. Answers, scores, drawings and chat are not part of it.

**Refresh no longer costs you the room.** `leave()` gained a `departing` flag.
Pressing "Leave" gives the seat up immediately by zeroing the heartbeat; a
component unmounting says nothing, because that is usually a refresh and the
same tab is about to return with the same identity. Before this, a host who
reloaded the page handed the room to the other player.

**Tested — `npm run test:election`, 15 assertions:** live host is never replaced;
30 s and 44 s gaps do not migrate; 46 s does; lowest id wins regardless of map
order; three clients derive one answer; the cooldown blocks a second handover and
releases after it; an empty room elects nobody; the last player standing takes
authority; a returning ex-host stays a guest; a deliberate exit migrates at once;
a room created before `hostSince` existed still works; a `hostId` naming an
absent player still resolves.

**Tested — two live browser clients, the sequence from the brief:**

| Step | Result |
|---|---|
| A creates, B joins, A is host | ✓ |
| A's connection cut (writes and broadcasts dropped; tab and identity intact) | ✓ |
| 10 s / 17 s / 24 s / 31 s / 38 s stale | **A still host** — no premature migration |
| past 45 s | **B is host**, A demoted to guest, stable across 83 s with no flapping |
| game state | seed, question index and both players' round-one answers all intact |
| B continues alone | ✓ answered and advanced |
| A reconnects | heartbeat fresh in 1–3 s; **B remains host** across 25 s |
| A plays on | ✓ as a guest |
| host refreshes the page | **keeps the seat**, state intact |

Also verified live in Love Match: B took over 34 s after A went dark and the
round continued from question 1 of 14.

**Announced.** `RoomAnnouncer` says "You're running the room now — the previous
host dropped out." in an assertive live region. Confirmed firing in the browser.

---

### P0 — Supabase RLS (audit C6)

The old policies were `using (true)` on rooms, room players, sessions, answers,
scores, drawings and gift pages: any anon key could `select *` and read every
room's full state, and overwrite any of it.

**The problem underneath.** Guests have no account, so there was no `auth.uid()`
for a policy to check, and "knowing the room code" is not something a policy can
see. Both are now solved:

* **Every visitor has an identity.** The client calls `auth.signInAnonymously()`
  before touching a room (`getAuthedSupabaseClient`). No email, no password.
* **A code lets you *ask* to join, not read.** `join_room(code, player_id)` is a
  `security definer` function and the only way to obtain membership; it records a
  row in the new `room_members` table. Every policy on rooms and everything
  hanging off them checks that membership. `room_members` has **no insert or
  update policy at all**, so a client cannot enrol itself.
* `create_room` makes the creator a member in the same transaction.
* Rooms older than 24 hours cannot be joined, and the failure message is
  identical whether the code never existed or has expired, so it cannot be used
  to probe which codes are live.

**Classification** (documented in the schema header): PUBLIC — `experiences`
only. PRIVATE — profiles, photos, photo_strips, scrapbook_items, letters,
gift_pages, tree progress. COUPLE-SHARED — couples, and the personal tables via
`is_couple_member`. ROOM-SHARED — rooms, room_members, room_players,
game_sessions, game_answers, game_scores, drawings, drawing_strokes.
CAPABILITY — the gift read path.

**Other changes.** Letters are unreadable by the partner until `deliver_on`
arrives, in the policy rather than the page. Gift pages are not selectable by
anyone but the owner; recipients call `get_gift(share_token)`, which returns one
row and refuses before the reveal date. Vision boards with neither a couple nor
a room are unreachable rather than public. Storage objects are addressed
`<user-uuid>/<file>` so ownership is provable from the path; a partner may read,
only the uploader may write or delete. Every policy names its roles.

**Lost updates fixed too** (audit H5). `rooms` gained a `version` column; writes
are conditional on the version they were derived from and retry on a miss. Two
clients answering at the same moment can no longer erase each other.

**Tested — `npm run test:rls`, 76 assertions against real Postgres.** The suite
runs `schema.sql` in PGlite (Postgres 18, in-process), recreates Supabase's
`auth`/`storage` objects and its `anon`/`authenticated` roles, then acts as each
caller. Nothing goes through a client library that could be fooled.

| Actor | Verified |
|---|---|
| Anonymous | cannot list or read rooms, state, members, profiles, letters, gifts, scrapbook, drawings or answers; cannot insert a room, overwrite state, enrol itself, or even call `join_room` |
| Random attacker (signed in, never joined) | cannot enumerate rooms, read one by uuid **or by code**, read membership or presence, overwrite state, delete the room, grant itself membership, or read a stranger's profile |
| Room member | reads and updates the room they joined; reads a co-member's profile; **cannot** read a room they did not join; cannot delete a room they do not own |
| Non-member vs gameplay | reads no answers and no sessions; cannot write an answer |
| User A vs User B | neither reads, edits, deletes nor forges the other's scrapbook or letters |
| Couple | partner cannot read a letter before its date, can after; an outsider never can, and cannot read the couple row |
| Gift recipient | cannot list gift pages; an unrevealed gift stays shut even holding its token; the intended gift opens on its date; a made-up token opens nothing; cannot alter the gift |
| Storage | owner and partner read; outsider reads nothing; nobody uploads into another's folder; even the partner cannot delete |
| Concurrency | first writer lands, second is rejected rather than clobbering, surviving document is the first writer's, version moves exactly once |
| Policy sweep | no unconditional read outside the catalogue; no unconditional write; every policy scoped to a role; RLS on for every public table; no table left with RLS and no policy |

---

### P1 — `/api/judge` (audit H1)

Public and unauthenticated by necessity, so it is defended by shape. New
`lib/ai/guard.ts`:

* **Body cap** at 16 KB, checked against `content-length` *and* against the
  bytes actually read, so a lying or absent header does not get past it.
* **The payload is rebuilt, not inspected.** Only known fields survive
  `validateJudgeRequest`, so a model name, a system prompt or a `max_tokens`
  cannot ride along. The model comes from `ANTHROPIC_MODEL` on the server.
* **Caps** of 4 submissions, 2000 chars per argument or evidence, 300 per topic.
* **Rate limit** of 12/minute per caller.
* **Prompt injection**: player text is wrapped in `<submission>` tags, `<` and
  `>` are replaced, and the model is told the contents are never instructions.
* **Errors never leak.** An upstream failure is logged server-side and answered
  with the deterministic offline judge, which is unchanged.

Also fixed the cause of most of the load: the duplicate judge requests from the
previous pass (9 per verdict → 1).

**Tested against the running server:** valid 200; malformed JSON, missing topic,
empty submissions, `null` body, array body and 200 submissions all 400; a 400 KB
body 413; a chunked body with no content-length 413; 20 rapid requests → 12×200
then 8×429 with `retry-after: 60`; a second caller unaffected.

### P1 — iOS downloads (audit H3)

`<a download>` on a `data:` URL is ignored by iOS Safari, so the photo strip
export did nothing on the likeliest device. New `lib/media/export-image.ts`
tries three routes in order and **reports which one actually happened**:

1. the Web Share sheet with the file attached (the route that reaches the camera
   roll on iOS), 2. a real download via a blob URL where the attribute is
   honoured, 3. opening the full-size image in a new tab with a press-and-hold
   instruction.

Output is untouched — the strip is still composed at 2400 wide and neither
resampled nor recompressed. A cancelled share sheet is treated as a choice, not
a failure. Blob URLs are revoked on a timer rather than immediately, which
previously cancelled the download in Safari and Firefox, and anchors are
appended to the document, which Firefox requires.

Every export path now uses it: photobooth, draw together, print studio,
scrapbook, birthday gift QR, our future. `downloadDataUrl` is gone.

**Tested:** the strip and drawing exports return "Saved — check your downloads"
on this desktop browser, which is the truthful branch here. *The iOS branches
are written from the documented behaviour and could not be exercised — no Apple
device or simulator is available in this environment.* Flagged below.

### P1 — Snap Hunt media (audit C5, now properly fixed)

Previously mitigated by shrinking the image; now moved onto the Photobooth
architecture. `Shot` in room state holds `photoId`, a ~1.4 KB thumbnail, `msLeft`
and dimensions. The pixels travel over the event channel and live in
sessionStorage, keyed by `photoId` so a re-delivery is a no-op. Capture quality
went back **up** (640→1000 px) because size no longer costs anything replicated.

**Measured in the browser:** one photo in a live two-player room →
**room document 2 KB** (4 KB with both players' shots), 339 KB of pixels in
sessionStorage, and `"dataUrl"` appears nowhere in the room document. Before,
the same photo put ~250 KB straight into state, re-serialised to localStorage
every 3 seconds. The partner received the full frame over the channel, and after
a mid-game refresh both photos came back at full size (339 KB and 329 KB) — own
from sessionStorage, partner's re-requested.

### P1 — Accessibility (audit H7)

There were zero live regions. Now one app-wide `Announcer` (polite + assertive,
both `sr-only`, repeats collapsed within 4 s) with an `announce()` /
`useAnnounce()` API, plus `RoomAnnouncer` per room. Covers: partner joined,
partner left, ready state, start and finish, host migration, connection lost and
reconnected, countdown, new question with whose turn it is, answer reveal with
the explanation, and Watch Together play/pause/seek naming who did it. Nothing
is visible; the UI is unchanged.

**Tested:** "Fig left the room." and "You're running the room now — the previous
host dropped out." both observed in the live regions during real sessions.

### P1 — Reconnection idempotency

Watch Together chat lines are deduplicated by id, so a re-delivery or a local
echo shows once. Reactions carry a sender-generated id and their timers are
tracked and cleared on unmount. Snap Hunt photos are keyed by `photoId` and a
repeat is a no-op. Photobooth shots were already keyed by round and player.
Answers, scores and drawings are keyed by (question, player) in the room
document and so are idempotent by construction. A brief interruption does not
migrate the host (verified to 44 s above).

### Other HIGH items from the audit

* **H2** — room codes from the URL go through `normalizeCode()` and anything
  that is not six characters 404s, so junk never reaches the transport or, later,
  a realtime filter string. Verified: `/room/not-a-code` renders "That room isn't
  there" rather than creating one.
* **H6** — gift links capped at 28 KB instead of 1.5 MB; photos are dropped above
  it and the sender is already told.
* **H8** — local rooms untouched for 24 h are pruned on load; `recentRooms()`
  filters by the same TTL; `join_room` refuses anything older; `prune_stale_rooms`
  now carries its pg_cron line.
* **H9** — uploads reject non-images and anything over 12 MB before reading, and
  name HEIC explicitly when decoding fails.
* **H10** — the modal traps Tab, focuses the first real control on open, restores
  focus to the trigger on close, and the scrim is `aria-hidden` rather than a
  full-screen button announced before the dialog.

---

## 2. Left unresolved, deliberately

| Item | Why |
|---|---|
| **iOS export not tested on a device** | The code paths are written to the documented behaviour of Web Share and `<a download>`, but no Apple device or simulator exists in this environment. **Test on a real iPhone before launch.** |
| **Supabase never connected** | Out of scope by instruction. The schema and client are aligned and the policies are tested against real Postgres, but no live project has run them. |
| **Rate limiting is per-process** | In-memory, so it caps one instance and merely thins traffic across several. Fine for a single deployment; put a shared limiter in front before this endpoint carries real spend. |
| **Write amplification (audit H4)** | The heartbeat still writes the whole room document. Locally that is cheap; on Supabase it is ~40 round trips a minute per room. Moving presence to Supabase Presence is the fix, and it changes the transport's shape. |
| **"Peek anyway" on sealed gifts** | A deliberate product affordance. The database now enforces the reveal date in `get_gift`, but the local build cannot — the payload is in the URL fragment. Sealing is a courtesy locally and a real boundary once hosted. |
| **MEDIUM and LOW findings** | Untouched, as scoped. Safe-area insets, offline detection, YouTube load timeout, mixed-content video, camera `track.onended`, `seenEvents` growth, sitemap/robots, and the cosmetic timer leaks. |
| **Anonymous sign-in must be enabled** | The RLS model depends on it. With it off, every room query fails; the client logs a specific message saying so. |

---

## 3. Security findings from the final sweep

| Searched | Result |
|---|---|
| `service_role`, `SUPABASE_SERVICE_ROLE_KEY` | One occurrence: an empty, documented placeholder in `.env.example`, marked server-only. No key present, and nothing reads the variable. *(Corrected — the original sweep said "no occurrences anywhere", having searched only `.ts`/`.tsx`/`.sql`/`.json`/`.md` and missed dotfiles.)* |
| `ANTHROPIC_API_KEY` | One occurrence, `app/api/judge/route.ts:54`, server-only. No client component references it; it cannot reach a bundle. |
| `NEXT_PUBLIC_*` | Three, all intended to be public: site URL, Supabase URL, Supabase anon key. |
| `using (true)` | Four occurrences: three in comments, one real — `experiences`, a static catalogue of game titles. Asserted by the policy sweep. |
| Public storage buckets | None. Both buckets are created with `public = false`. |
| Unrestricted API routes | One route exists; it now has rate limiting, size caps and schema validation. |
| Raw image payloads in room state | None. Snap Hunt was the last one and now stores `photoId` + thumbnail. |
| `data:` URL downloads | None left. The only remaining `a.download` is the profile JSON export, which uses a blob URL, is appended to the document and revokes late. |

Two further notes. The `security definer` functions are the only elevated paths
and each is explicitly revoked from `public`/`anon` and granted to
`authenticated`. `prune_stale_rooms` is revoked from everyone.

---

## 4. Tests performed

**Automated** (`npm test`): 15 host-election assertions, 76 RLS assertions
against real Postgres. Both suites are in the repo.

**Endpoint**: 9 validation and size cases against the running server, plus a
20-request rate-limit burst and a second-caller check.

**Two live browser clients**: the full host-migration sequence from the brief
including the sub-timeout blip and the host refresh; Know Me played across a
migration with state verified intact; Love Match host takeover mid-game;
Draw Together to the compare screen with both submissions and a working export;
Snap Hunt end to end with room-document size measured and refresh recovery
verified; Couples Court two consecutive cases with judge-call counting;
gift privacy on a sealed gift.

**Mobile**: nine routes at 375 px — `/`, `/hub`, `/photobooth`, `/profile`,
`/studio`, `/play/arcade`, `/play/love-match`, `/play/watch-together`, `/` —
zero horizontal overflow on every one. A fresh tab showed no console errors
except the expected 404 from a deliberately bad URL.

**Build**: `npm run build` clean, `tsc --noEmit` exit 0.

---

## 5. Before production launch

1. **Enable anonymous sign-in** in Supabase (Authentication → Providers). The
   whole RLS model depends on it.
2. **Run `schema.sql`** on the project, then **re-run `npm run test:rls` against
   the real instance** rather than trusting the PGlite run alone.
3. **Test the export on a real iPhone.** The only significant path not exercised
   here.
4. **Put a shared rate limiter in front of `/api/judge`** (Upstash, Vercel KV, or
   the platform's own) before configuring `ANTHROPIC_API_KEY`.
5. **Schedule `prune_stale_rooms`** with pg_cron.
6. **Address audit H4** — move presence off the room document before more than a
   handful of concurrent rooms.
7. Work through the MEDIUM list, particularly safe-area insets and offline
   detection, both of which are mobile-visible.

**This is not production ready yet.** Host migration and the RLS matrix both
pass, and pass genuinely — the election against 15 assertions and two live
clients, the policies against real Postgres. But the database has never run
outside a test harness, and the iOS export path has never run on iOS. Items 1–3
are the difference.
