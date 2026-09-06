# Launch-readiness audit

Audited at feature freeze. 20 experiences, ~18k lines, local transport active, Supabase
present in code but not configured.

Findings are ordered by severity. Each says what is wrong, where, why it matters, and the
recommended fix. **Only the CRITICAL items marked `FIXED` were changed** — everything else
is left exactly as it is, per the brief.

---

## CRITICAL

### C1. One verdict fires nine judge requests — `FIXED`
**What** The judging effect in Couples Court and Debate re-runs every ~3 seconds while a
verdict is in flight, firing a fresh `POST /api/judge` each time. `data.verdict` only
guards *after* a response lands, and `cancelled` suppresses the state write, not the
request.

**Where** `components/experiences/couples-court.tsx:60`, `components/experiences/debate.tsx:65`.
The effects depend on `roster` and `names`, which are `useMemo`s on `state`; the 3-second
presence heartbeat replaces `state` on every beat, so both arrays get a new identity and
the effect re-runs.

**Why it matters** Measured in the browser with a 12-second judge response: **9 requests
for a single verdict.** With `ANTHROPIC_API_KEY` set that is 9× the token spend and 9×
the rate-limit pressure on an endpoint that is public and unauthenticated. It also races —
whichever response lands last wins, so the verdict shown is not necessarily the one for
the arguments on screen.

**Fix** A ref keyed on the round, set before the request and cleared on reset.

**Verified** Re-ran the same measurement after the fix: **1 request per verdict**, verdict
still lands, phase still advances. Played two consecutive cases in one room — 2 requests
total, one each.

---

### C2. The host leaving freezes the room permanently — NOT FIXED (needs host migration)
**What** `hostId` is assigned once at room creation and never reassigned. Every state
transition is gated on `isHost`. When the host closes the tab, locks their phone past the
45-second presence window, or loses their `sessionStorage` player id, no client is host
any more and the room stops advancing.

**Where** `lib/rooms/api.ts:25` (assignment), `components/room/room-provider.tsx:134`
(derivation). Host-gated transitions: `couples-court.tsx:61,94`, `debate.tsx:67,89`,
`draw-together.tsx:129`, `love-match.tsx:84`, `photobooth.tsx:194`, `snap-hunt.tsx:79`,
`truth-or-dare.tsx:74,82`, `quiz-engine.tsx:112`.

**Why it matters** This is the single most likely real-world failure — one person's phone
sleeps — and it produces a dead screen with no message, no timeout and no recovery. The
remaining player waits forever on "the bench is deliberating…". Quiz questions never get a
deadline, so the clock never starts either.

**Fix** Host migration: when the current `hostId` has no heartbeat inside the presence
window, the lowest-id online player claims host in a single guarded patch. Roughly 20 lines
in `RoomSession`, but it changes who owns room authority, so it is a design decision rather
than a safe drop-in. Ship it before launch.

---

### C3. "Delete everything" leaves all shared content behind — `FIXED`
**What** The clear-data action iterates a hardcoded list of 12 keys and misses the room
documents entirely.

**Where** `components/experiences/profile.tsx:16,71`. Missing: `together:room:*` (every
room ever created on this device), `together:identity` (name and emoji),
`together:player-id` (sessionStorage), `together:booth:*`.

**Why it matters** `together:room:*` holds the actual content of everything two people
played — Know Me answers, Honest Cards responses, Court arguments, drawings, Watch Together
chat. A user who presses "Delete everything" on a shared or borrowed device is told their
data is gone while the most personal part of it stays in localStorage indefinitely. That is
a direct violation of what the button promises.

**Fix** Sweep every `together:` key rather than a hand-maintained list, and clear
sessionStorage too. The confirmation copy now names the rooms and the profile explicitly.

**Verified** Seeded three room documents plus a sessionStorage booth mirror, pressed
"Delete everything": all gone, and the stored identity was genuinely replaced (Maple →
Nova) rather than surviving.

---

### C4. Storage quota failures are silent — `FIXED`
**What** `write()` catches the quota exception and dispatches `together:store-error`.
Nothing anywhere listens for that event.

**Where** `lib/store/index.ts:56-67`. Verified: zero listeners in the codebase.

**Why it matters** localStorage is ~5 MB. A photo strip is a full-size data URL; the store
keeps up to 40 strips and 60 scrapbook items. Quota is reached in ordinary use. When it is,
the save silently no-ops, the UI shows "Saved to your scrapbook", and the photo is gone on
refresh. The code comment says "surface it rather than silently losing someone's photo
strip" — the surfacing was never wired up.

**Fix** A small listener mounted in the root layout that shows what failed and why —
`components/layout/storage-notice.tsx`, rendered from `app/layout.tsx`.

**Verified** The notice appears on the event the store already dispatches, matches the
design system, and does not overflow at 375 px.

---

### C5. Snap Hunt puts multi-megabyte photos in the replicated room document — MITIGATED
**What** `Shot.dataUrl` is stored inside the shared room state, which is re-serialised and
rewritten on every presence heartbeat.

**Where** `components/experiences/snap-hunt.tsx:26-38` (`shots: Record<string, Record<string, Shot>>`),
captured at `components/photo/photo-input.tsx:91` (`width: 1200`, quality 0.92) or
`lib/media/use-camera.ts` `fileToDataUrl` (maxWidth 1400, quality 0.88).

**Why it matters** 5 prompts × 2 players at roughly 150–400 KB per data URL is ~3 MB living
in `room.data`. `LocalRoomTransport.write()` runs `JSON.stringify` plus
`localStorage.setItem` on that **every 3 seconds**, synchronously on the main thread, and
structured-clones it over BroadcastChannel. It also exceeds the 5 MB origin quota on its
own, at which point (see C4) persistence silently stops and a refresh loses the game.
Photobooth deliberately avoids exactly this — its own comment reads *"Photos deliberately
never enter the replicated room document"* — Snap Hunt does the thing Photobooth was
written to avoid.

**Mitigation applied** Snap Hunt now captures at 640 px / quality 0.62. Measured in the
browser against the previous 1200 px / 0.92: **9.1× smaller per photo** (714 KB → 79 KB on
a worst-case noisy source), taking a full five-round room from ~7 MB — over quota, certain
failure — to ~0.8 MB. **This is not the fix.** The real fix is to move Snap Hunt onto the
Photobooth pattern — pixels over the event channel, mirrored into sessionStorage — which is
a restructure of that experience and out of scope here.

---

### C6. Supabase RLS lets anyone read and overwrite every room — NOT FIXED (schema change)
**What** The room policies are unconditional.

**Where** `supabase/schema.sql:336-343`:
```sql
create policy rooms_read   on public.rooms for select using (true);
create policy rooms_update on public.rooms for update using (true) with check (true);
create policy room_players_all on public.room_players for all using (true) with check (true);
```
Same shape for `game_sessions`, `game_answers`, `game_scores`, `drawings`,
`drawing_strokes` (`:349-356`) and `gift_pages` select (`:379`).

**Why it matters** The comment says "knowing the code is the credential", but
`select using (true)` is not code-gated — it permits `select * from rooms` with the
anon key, returning every room's full `state` jsonb: names, answers, arguments, drawings,
chat. `rooms` is also in the `supabase_realtime` publication with `replica identity full`,
so a subscriber gets every room's changes live. `update using (true)` lets anyone overwrite
any room. `gift_pages_read using (true)` exposes every gift page including ones not yet
revealed.

**Why it is not fixed here** Supabase is explicitly out of scope and this is a schema
change that needs a matching client change (rooms must be fetched by code through a
`security definer` RPC, not by open select). **Do not enable Supabase until this is done.**

**Fix** Drop the blanket policies; expose room reads through
`create function get_room(code text) returns jsonb security definer` with a rate limit, and
gate writes on membership recorded at join time.

---

### C7. No error boundary anywhere — `FIXED`
**What** There is no `error.tsx`, `global-error.tsx` or `loading.tsx` in the entire `app/`
tree.

**Where** `app/` — verified absent.

**Why it matters** Any uncaught error in a client component takes down the whole route. In
production that is an unstyled browser error page with no way back. Realistic triggers:
a corrupted localStorage payload deserialising into the wrong shape, a room document from
an older build, a canvas call on a browser that lacks it. The app has plenty of `try/catch`
around storage but nothing catching a render throw.

**Fix** Standard Next.js `error.tsx` and `global-error.tsx` with a reset action, styled to
match the existing `not-found.tsx`. `global-error.tsx` is styled inline because a failure in
the root layout cannot rely on the token stylesheet.

**Verified** In a production build, poisoning `together:scrapbook` with a wrong-shaped
payload previously blanked the route; it now renders the in-product error page with the
header and footer intact, and "Try again" recovers without a reload once the bad payload is
cleared.

---

## HIGH

### H1. `/api/judge` is public, unauthenticated and unbounded
**Where** `app/api/judge/route.ts:18`. No auth, no rate limit, no body-size cap, no cap on
`submissions.length`, no length cap on `topic` / `argument` / `evidence` before they are
interpolated into the prompt.
**Why** With a key configured, anyone who finds the endpoint can spend the deployment's
Anthropic budget at will, and a single request can carry megabytes of prompt. C1 was
already multiplying legitimate traffic ninefold on top of that.
**Fix** Cap the body (reject > 32 KB), cap `submissions` at 4 and each text field at ~2000
chars, and put a per-IP rate limit in front of it. Consider requiring a room code that
exists.

### H2. Room codes from the URL are never validated
**Where** `app/room/[roomCode]/page.tsx:22` — `roomCode.toUpperCase()` only; `normalizeCode`
exists in `lib/utils.ts:31` but is used solely on typed input.
**Why** Arbitrary path segments reach the transport. Locally that means junk localStorage
keys. With Supabase, the code is interpolated into a realtime filter string —
`filter: \`code=eq.${this.code}\`` at `lib/realtime/supabase-transport.ts:47` — where a
comma or operator character changes the filter's meaning.
**Fix** `normalizeCode()` in the route; render not-found for anything that does not
normalise to six characters.

### H3. Downloads use `data:` URL anchors — broken on iOS Safari
**Where** `lib/utils.ts:137` (`downloadDataUrl`), used by Photobooth, Draw Together, Print
Studio, Scrapbook, Birthday Gift.
**Why** iOS Safari ignores the `download` attribute on `data:` URLs; the strip either opens
as a raw blob in a new tab or nothing happens. For a product whose flagship output is a
photo strip on a phone, the export path is broken on the most likely device.
**Fix** Convert to a Blob and `URL.createObjectURL`, and on iOS fall back to opening the
image with a "press and hold to save" hint.

### H4. Supabase write amplification
**Where** `lib/realtime/supabase-transport.ts:118-134` plus `HEARTBEAT_INTERVAL_MS = 3_000`.
**Why** Every heartbeat does a full `SELECT state` then a full-row `UPDATE` of the entire
jsonb document, plus a broadcast of the whole state. Two players is ~40 round trips a
minute per room before anyone plays. With Snap Hunt's payload (C5) each of those carries
megabytes, and Supabase's realtime broadcast limit (~256 KB) will silently drop the
message.
**Fix** Send presence over Supabase Presence rather than the state document, and patch with
a jsonb merge instead of writing the whole row.

### H5. Lost updates across clients on Supabase
**Where** `lib/realtime/supabase-transport.ts:95-102`. `WriteQueue` serialises writes
*within one client only*.
**Why** Client A reads, client B reads, A writes, B writes — A's change is gone. The local
transport hides this because both tabs read the same localStorage synchronously. It will
appear the day Supabase is switched on, as answers that vanish.
**Fix** Optimistic concurrency: add a `version` column, `update … where version = $n`, retry
on conflict. Or move the merge server-side into an RPC.

### H6. Gift links can reach 1.5 MB
**Where** `lib/gift-link.ts:12` — `MAX_HASH_BYTES = 1_500_000`.
**Why** Browsers and messaging apps cap URL length far below this (Safari and most chat
apps truncate well under 100 KB). A gift with photos produces a link that silently breaks
when pasted, and the failure looks like a corrupt gift.
**Fix** Drop the ceiling to ~30 KB, always strip photos above it, and tell the sender their
photos were not included in the link.

### H7. No live regions anywhere
**Where** Verified: zero `aria-live`, `role="status"` or `role="alert"` in the codebase.
**Why** This is a realtime product where most screen changes are caused by *the other
person* — partner joined, verdict landed, question advanced, timer expired. A screen-reader
user is told none of it.
**Fix** A polite live region in `GameShell` announcing phase and turn changes; `role="alert"`
on the inline form errors that already exist.

### H8. No room expiry, local or hosted
**Where** Local rooms persist in localStorage forever; `prune_stale_rooms`
(`supabase/schema.sql:435`) exists but is never scheduled; `recentRooms()`
(`lib/rooms/api.ts:333`) has no age filter.
**Why** Room documents accumulate indefinitely and count against the same 5 MB quota the
photo features need. "Still open" offers rooms from weeks ago that lead nowhere.
**Fix** Drop local rooms untouched for 24 h on load; filter `recentRooms` by age; schedule
`prune_stale_rooms` with pg_cron when Supabase lands.

### H9. Uploads have no size or type guard
**Where** `lib/media/use-camera.ts` `fileToDataUrl`; callers in Photobooth, Snap Hunt,
Print Studio, Our Future, Birthday Gift.
**Why** The file is read fully into memory as base64 and drawn to a canvas with no size
check. A 50 MB photo — routine from a modern phone — can crash the tab on mobile Safari.
HEIC (the iPhone default) fails `img.onload` on non-Safari browsers and surfaces as a bare
"That file isn't an image we can read."
**Fix** Reject over ~15 MB with a clear message before reading; name HEIC explicitly.

### H10. Modal has no focus management
**Where** `components/ui/modal.tsx`.
**Why** No focus trap (Tab escapes to the page behind), no initial focus, no restoration on
close, and the background is not inert. Escape and scroll-lock are handled, so the gap is
specifically keyboard and screen-reader navigation.
**Fix** Trap Tab within the dialog, focus the first control on open, restore the trigger on
close, `aria-hidden` the rest of the page.

---

## MEDIUM

| # | Issue | Where | Fix |
|---|---|---|---|
| M1 | `URL.revokeObjectURL` called synchronously after `click()` — Firefox and Safari may cancel the download | `components/experiences/profile.tsx:67` | Revoke inside `setTimeout(…, 0)` |
| M2 | Export anchors never appended to the DOM — Firefox ignores the click | `profile.tsx:64`, `our-future.tsx:206` | Append, click, remove (as `downloadDataUrl` does) |
| M3 | `?host=1` on a mistyped link silently *creates* a room instead of reporting not-found | `lib/rooms/api.ts:74`, `app/room/[roomCode]/page.tsx:23` | Only honour `host=1` when arriving from the launcher |
| M4 | Room codes are generated without a uniqueness check; a collision joins a stranger's room | `experience-launcher.tsx:31` → `api.ts:80` | Check existence before routing; retry on collision |
| M5 | No `sitemap.ts` or `robots.ts` | `app/` | Add both; keep `/room` and `/gift` excluded |
| M6 | `seenEvents` grows without bound for the tab's lifetime | `local-transport.ts:27`, `supabase-transport.ts:24` | Cap at ~500 ids, FIFO |
| M7 | No offline detection at all | codebase-wide (`navigator.onLine` unused) | Banner on `offline`; queue or block room writes |
| M8 | YouTube API load never times out — a blocked script leaves the player in "loading" forever | `components/watch/video-surface.tsx:57` | Reject after ~10 s and show a retry |
| M9 | `http:` video sources are blocked as mixed content with no message | `lib/media/video-source.ts:70` | Reject `http:` when the page is https, and say why |
| M10 | `viewport-fit=cover` is set but no `env(safe-area-inset-*)` padding exists | `app/layout.tsx:62`, `globals.css` | Pad the fixed header, footer and bottom-sheet |
| M11 | Camera does not react to the OS revoking the stream | `lib/media/use-camera.ts` | Handle `track.onended`; return to the idle state |
| M12 | Sealed letters and gifts are readable before their date — the payload is in the URL fragment / localStorage | `lib/gift-link.ts:44`, `lib/store/index.ts:154` | Either say plainly that sealing is a courtesy, or encrypt the payload with a date-derived key |
| M13 | Print Studio range inputs have visual labels but no programmatic association | `print-studio.tsx:326,338` | `id` + `htmlFor`, or `aria-label` |
| M14 | `profiles_read using (true)` exposes every display name | `supabase/schema.sql:308` | Restrict to couple members |
| M15 | A partner dropping mid-game is never surfaced — the seat just empties | `game-shell.tsx` | Show "they've dropped out — waiting" after the presence timeout |
| M16 | `STORAGE_KEYS` in Profile duplicates `KEYS` in the store and can drift | `profile.tsx:16` vs `lib/store/index.ts:23` | Export `KEYS` and consume it (addressed by the C3 fix) |
| M17 | Prompt injection: user text goes straight into the judge prompt | `app/api/judge/route.ts:56` | Delimit and instruct the model to treat it as data |
| M18 | A partner can point your browser at any URL via a "file" video source | `video-source.ts:68` | Acceptable in a two-person room; show the host before loading |

---

## LOW

| # | Issue | Where |
|---|---|---|
| L1 | Honest Cards' 170 ms flip timer is never cleared; rapid taps stack | `honest-cards.tsx:40` |
| L2 | "Copied" toast timers are never cleared on unmount | `room-code.tsx:24`, `share-dialog.tsx:38`, `birthday-gift.tsx:379` |
| L3 | Join accepts 4-character codes while the error says "six characters" | `experience-launcher.tsx:35`, `join-room-dialog.tsx:20` |
| L4 | The modal scrim is a full-screen `<button aria-label="Close">`, announced before the dialog content | `components/ui/modal.tsx:45` |
| L5 | No PWA manifest, no canonical URLs | `app/layout.tsx` |
| L6 | Storage policies use the deprecated `storage.objects.owner` rather than `owner_id` | `supabase/schema.sql:417` |
| L7 | Face-down memory-match cards render "?" in transparent text — read aloud as "question mark" twelve times | `arcade/games.tsx` |

---

## Categories with nothing to report

**Empty states** — audited in the previous pass and rewritten; no "No data" / "Coming soon"
anywhere. **Duplicate submissions in gameplay** — every host-driven transition apart from
the judge call is idempotent and guarded by the state it sets. **Timer cleanup** — every
game timer in the Arcade and the quiz engine is tracked and cleared; only the cosmetic ones
in L1/L2 are not. **Secrets** — `ANTHROPIC_API_KEY` is read server-side only and never
reaches the browser; the only client-exposed values are the intended
`NEXT_PUBLIC_SUPABASE_*` pair. **Video URL handling** — protocol allow-list, host
allow-list and an 11-character id regex; no `javascript:` or `data:` path through.
