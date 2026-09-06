# Launch-readiness audit — feature freeze

Second pass, run at freeze. Every finding in the earlier `LAUNCH-AUDIT.md` was re-checked
against the current source rather than taken on trust; that file's `FIXED` claims are
verified below, and its "nothing to report" section turned out to be wrong in one
important place (duplicate submissions).

Scope: 20 experiences, ~19k lines, local transport active, Supabase present in code but
not configured. No feature changes, no redesign, no gameplay changes, no Supabase setup.

**Only the two CRITICAL items marked `FIXED` were changed.** Everything else is reported
and left alone.

---

## CRITICAL

### K1. The camera keeps running after you leave the page — `FIXED`

**What** `useCamera` releases the stream in an unmount cleanup that reads
`streamRef.current`. If the component unmounts while `getUserMedia` is still pending —
which is exactly the window in which the browser is showing its permission prompt — the
ref is still `null`, so cleanup stops nothing. The promise then resolves into the
already-unmounted hook, assigns `streamRef.current = stream`, and those tracks are never
stopped by anything.

**Where** `lib/media/use-camera.ts:32-36` (`stop`), `:48-53` (assignment after the await),
`:113-117` (the cleanup). Reached from Photobooth, Snap Hunt, Mood Filter and Print
Studio via `components/photo/photo-input.tsx`.

**Why it matters** The camera stays live and the hardware indicator light stays on after
the user has navigated away — on a page they only glanced at, having just been asked for
permission. There is no UI left to turn it off; only a full page reload releases it. For a
consumer product that asks two people to point cameras at themselves, a camera that
outlives the screen is the most serious thing in this audit. It is also a trivially
reachable path: tap "Use camera", see the prompt, hit back.

**Fix applied** A disposal flag on the hook. `stop()` sets it, the post-`await` assignment
checks it and stops the freshly-acquired stream instead of storing it, and the unmount
cleanup marks the hook disposed. No behaviour change on the normal path.

---

### K2. Both players can advance the round, and the round advances twice — `FIXED`

**What** Five experiences show a "Next question" / "Next riddle" / "Next hunt" button to
*both* players after the reveal, and the handler advances shared state with a
non-idempotent increment: `setData(c => ({ ...c, index: c.index + 1 }))`. Two people
looking at the same reveal screen both tap it, which is the expected behaviour, not an
edge case. Whichever ordering the two read-modify-write cycles take, the index can land
two ahead — and a question is silently skipped, never shown, never scored.

**Where**
- `components/games/quiz-engine.tsx:162-169`, button at `:364` (drives **IQ Duel** and **The Lab**)
- `components/experiences/know-me.tsx:108-115`, button at `:295`
- `components/experiences/riddle-night.tsx:95-102`, button at `:225`
- `components/experiences/snap-hunt.tsx:113-120`, button at `:268`

**Why it matters** The previous audit's "Categories with nothing to report" says *"every
host-driven transition apart from the judge call is idempotent"*. These four transitions
are not host-driven and not idempotent, and they sit in the core progression path of five
of the twenty experiences. The failure is silent: the pair sees question 3 follow question
1 and has no way to know a question was dropped, while the scoreboard is computed over
questions that were never asked. `WriteQueue` does not help — it serialises writes within
one client, and these are two different clients.

This is the same defect class that will get worse, not better, on Supabase: the local
transport at least reads and writes one synchronous localStorage slot, whereas the hosted
transport has a network round trip between the read and the write (see H5).

**Fix applied** The target index is captured from the render the clicking player is
looking at, and written absolutely rather than incrementally, clamped monotonic:
`index: Math.max(c.index, target)`. A second tap on the same reveal computes the same
target and is a no-op; a genuinely later tap still advances. Four call sites, same shape,
no change to any other logic.

---

### K3. Supabase RLS lets anyone read and overwrite every room — NOT FIXED (schema change)

**What** The room policies are unconditional.

**Where** `supabase/schema.sql:336-343`:
```sql
create policy rooms_read   on public.rooms for select using (true);
create policy rooms_write  on public.rooms for insert with check (true);
create policy rooms_update on public.rooms for update using (true) with check (true);
create policy room_players_all on public.room_players for all using (true) with check (true);
```
Same shape for `game_sessions`, `game_answers`, `game_scores`, `drawings`,
`drawing_strokes` (`:349-356`), and `gift_pages_read` (`:379`). `rooms` is also added to
the realtime publication with `replica identity full` (`:414-415`).

**Why it matters** The intent is "knowing the code is the credential", but
`select using (true)` is not code-gated. With nothing but the public anon key — which ships
in the client bundle by design — `select * from rooms` returns every room's full `state`
jsonb: display names, Know Me answers, Honest Cards responses, Court arguments, drawings,
Watch Together chat. The realtime publication means a subscriber receives every room's
changes live, as they are typed. `update using (true)` lets anyone overwrite any room's
state, and `insert with check (true)` lets anyone create rooms at will.

**Why it is not fixed here** Supabase is explicitly out of scope for this pass, and this is
a schema change that requires a matching client change — rooms must be fetched by code
through a `security definer` RPC rather than an open select, which is a change to how
`SupabaseRoomTransport.readState` works.

**Fix** Drop the blanket policies. Expose room reads through
`create function get_room(code text) returns jsonb security definer` with a rate limit, and
gate writes on membership recorded at join time. **Do not set the Supabase env vars until
this is done** — the moment they are set, `createTransport` switches every room onto this
schema (`lib/realtime/index.ts:12-16`).

---

### K4. The host never migrates, so a sleeping phone freezes the room — NOT FIXED (architecture)

**What** `hostId` is assigned once at room creation and never reassigned. Every state
transition that drives a room forward is gated on `isHost`. When the host closes the tab,
locks their phone past the 45-second presence window, or loses their `sessionStorage`
player id, no client is host any more and the room stops advancing.

**Where** `lib/rooms/api.ts:19-33` (assignment), `components/room/room-provider.tsx:134`
(derivation). Host-gated transitions: `couples-court.tsx:71,111`, `debate.tsx:74,102`,
`draw-together.tsx:129`, `love-match.tsx:84`, `photobooth.tsx:194`, `snap-hunt.tsx:79`,
`truth-or-dare.tsx:74,82`, `quiz-engine.tsx:107-118`.

**Why it matters** One person's phone sleeping is the single most likely real-world
failure, and it produces a dead screen with no message, no timeout and no recovery. The
remaining player waits forever on "the bench is deliberating…". In the quiz engine it is
worse than a stall: the per-question deadline is opened by the host
(`quiz-engine.tsx:107-118`), so with no host the clock never starts, `expired` never
becomes true, and the reveal never fires either.

**Fix** Host migration: when the current `hostId` has no heartbeat inside the presence
window, the lowest-id online player claims host in a single guarded patch. Roughly 20 lines
in `RoomSession`, but it changes who owns room authority, so it is a design decision rather
than a safe drop-in. Ship it before launch.

---

## HIGH

### H1. `/api/judge` is public, unauthenticated and unbounded
**Where** `app/api/judge/route.ts:17-42`. No auth, no rate limit, no body-size cap, no cap
on `submissions.length`, no length cap on `topic` / `argument` / `evidence` before they are
interpolated into the prompt at `:47-68`.
**Why** With `ANTHROPIC_API_KEY` set, anyone who finds the endpoint can spend the
deployment's entire Anthropic budget, and a single request can carry megabytes of prompt.
**Fix** Reject bodies over ~32 KB, cap `submissions` at 4 and each text field at ~2000
chars, and put a per-IP rate limit in front of it. Consider requiring an existing room code.

### H2. Room codes from the URL are never validated
**Where** `app/room/[roomCode]/page.tsx:22` — `roomCode.toUpperCase()` only.
`normalizeCode` exists (`lib/utils.ts:32`) but is used solely on typed input
(`experience-launcher.tsx:35`, `join-room-dialog.tsx:19`). `joinRoom` also only uppercases
(`lib/rooms/api.ts:238`).
**Why** Arbitrary path segments reach the transport. Locally that means junk localStorage
keys under `together:room:*`. With Supabase the code is interpolated straight into a
realtime filter string — ``filter: `code=eq.${this.code}` `` at
`lib/realtime/supabase-transport.ts:46` — where a comma or operator character changes the
filter's meaning.
**Fix** `normalizeCode()` in the route; render not-found for anything that does not
normalise to six characters.

### H3. Every download uses a `data:` URL anchor — broken on iOS Safari
**Where** `lib/utils.ts:137-144` (`downloadDataUrl`), used by `photobooth.tsx:293`,
`draw-together.tsx:325,336`, `print-studio.tsx:168`, `scrapbook.tsx:238`,
`birthday-gift.tsx:390`.
**Why** iOS Safari ignores the `download` attribute on `data:` URLs; the strip either opens
as a raw blob in a new tab or nothing happens at all. The flagship output of this product
is a photo strip, and the most likely device to produce one is an iPhone.
**Fix** Convert to a Blob and `URL.createObjectURL`; on iOS fall back to opening the image
with a "press and hold to save" hint.

### H4. "Export my data" silently omits the room documents
**Where** `components/experiences/profile.tsx:17-30` (`STORAGE_KEYS`), used by
`exportData` at `:66-71` and by the usage figure at `:59-63`.
**Why** The delete path was fixed to enumerate the whole `together:` namespace
(`allStoredKeys`, `:38-45`), but export and the usage figure still walk a hardcoded
twelve-key list that excludes `together:room:*`. So the two halves disagree: "Delete
everything" removes the room documents — the answers, arguments, drawings and chat, the
most personal content the app holds — while "Export" hands the user a file that never
contained them. A user exporting before deleting loses data they were told they had a copy
of. The usage figure understates real consumption for the same reason, so someone about to
hit the quota sees a reassuring number.
**Fix** Have `exportData` and the usage figure use `allStoredKeys(window.localStorage)`,
the same enumeration `clearData` already uses.

### H5. Lost updates across clients once Supabase is on
**Where** `lib/realtime/supabase-transport.ts:95-102`. `WriteQueue` (`queue.ts`) serialises
writes *within one client only*.
**Why** Client A reads, client B reads, A writes, B writes — A's change is gone. The local
transport mostly hides this because both tabs hit the same synchronous localStorage slot.
It will appear the day Supabase is switched on, as answers that vanish. K2 is the same
defect surfacing today in the one place where it is reachable without a network hop.
**Fix** Optimistic concurrency: a `version` column, `update … where version = $n`, retry on
conflict. Or move the merge server-side into an RPC.

### H6. Supabase write amplification
**Where** `lib/realtime/supabase-transport.ts:121-134`, plus `HEARTBEAT_INTERVAL_MS = 3_000`
(`lib/rooms/types.ts:58`).
**Why** Every heartbeat does a full `SELECT state`, a full-row `UPDATE` of the entire jsonb
document, *and* a broadcast of the whole state. Two players is roughly 40 round trips a
minute per room before anyone has played a turn. With Snap Hunt's photo payload each of
those carries megabytes, and Supabase's realtime broadcast limit (~256 KB) will silently
drop the message.
**Fix** Presence over Supabase Presence rather than the state document; patch with a jsonb
merge instead of rewriting the whole row.

### H7. Room-state writes fail silently when storage is full
**Where** `lib/realtime/local-transport.ts:122-129` — the `catch` around
`localStorage.setItem` is empty, with the comment "the in-memory broadcast still works".
**Why** The store has a matching failure path that was wired up to `StorageNotice`
(`lib/store/index.ts:58-68` → `components/layout/storage-notice.tsx`), but the room
transport dispatches nothing. Once the origin is over quota — which Snap Hunt's photos
reach on their own — the room appears to keep working, because the in-memory and
BroadcastChannel paths still fan out, while nothing is being persisted. The game is lost on
the next refresh, with no warning at any point.
**Fix** Dispatch the same `together:store-error` event from this catch; `StorageNotice` is
already listening.

### H8. Gift links can reach 1.5 MB
**Where** `lib/gift-link.ts:9` — `MAX_HASH_BYTES = 1_500_000`.
**Why** Browsers and messaging apps cap URL length far below this; most chat apps truncate
well under 100 KB. A gift with photos produces a link that silently breaks when pasted, and
the failure looks to the recipient like a corrupt gift.
**Fix** Drop the ceiling to ~30 KB, always strip photos above it, and tell the sender their
photos were not included.

### H9. No live regions anywhere in gameplay
**Where** Verified across the codebase: the only `aria-live` / `role="status"` /
`role="alert"` is `components/layout/storage-notice.tsx:30`.
**Why** This is a realtime product in which most screen changes are caused by *the other
person* — partner joined, verdict landed, question advanced, timer expired. A screen-reader
user is told none of it.
**Fix** A polite live region in `GameShell` announcing phase and turn changes, and
`role="alert"` on the inline form errors that already exist
(`experience-launcher.tsx:118`, `join-room-dialog.tsx:61`, `photo-input.tsx:148`).

### H10. No room expiry, local or hosted
**Where** Local rooms persist in localStorage forever; `prune_stale_rooms`
(`supabase/schema.sql:435`) exists but is never scheduled; `recentRooms()`
(`lib/rooms/api.ts:358`) has no age filter and `ResumeRooms` labels the result
"Still open" (`components/room/resume-rooms.tsx:19`).
**Why** Room documents accumulate indefinitely against the same 5 MB quota the photo
features need. "Still open" offers rooms from weeks ago that lead to "That room isn't
there" — and rooms the host destroyed on leaving, since `forgetRoom` only runs on the
leaver's own device.
**Fix** Drop local rooms untouched for 24 h on load; filter `recentRooms` by age; schedule
`prune_stale_rooms` with pg_cron when Supabase lands.

### H11. Uploads have no size or type guard
**Where** `lib/media/use-camera.ts:133-154` (`fileToDataUrl`); callers in Photobooth, Snap
Hunt, Print Studio, Our Future, Birthday Gift.
**Why** The file is read fully into memory as base64 and drawn to a canvas with no size
check. A 50 MB photo — routine from a modern phone — can crash the tab on mobile Safari.
HEIC, the iPhone default, fails `img.onload` on non-Safari browsers and surfaces as a bare
"That file isn't an image we can read."
**Fix** Reject over ~15 MB with a clear message before reading; name HEIC explicitly.

### H12. "Leave & delete" does nothing once Supabase is on
**Where** `lib/rooms/api.ts:188` — `if (options.destroy && this.transport.kind === "local")`.
Called with `destroy = isHost` from `components/games/game-shell.tsx:105`.
**Why** The host pressing "Leave" is told the room is deleted, and locally it is. On the
hosted transport the branch is skipped entirely: the row stays in `public.rooms`, with the
full state jsonb, indefinitely — and with no expiry job scheduled (H10) nothing ever
removes it. The same button means two different things depending on an env var.
**Fix** Delete the row on the Supabase path too (the `rooms_delete` policy at
`schema.sql:339` already exists), or change the copy.

### H13. No security headers
**Where** `next.config.mjs` — the whole config is `reactStrictMode` and
`eslint.ignoreDuringBuilds`.
**Why** No `Content-Security-Policy`, no `frame-ancestors` / `X-Frame-Options`, no
`Referrer-Policy`, no `X-Content-Type-Options`, no `Permissions-Policy`. The app is
clickjackable, and it is an app that asks for camera permission — a `Permissions-Policy`
limiting `camera=(self)` is the cheap control that stops any embedded frame inheriting it.
Gift payloads also live in URL fragments, which a permissive referrer policy makes more
exposed than it needs to be.
**Fix** A `headers()` block in `next.config.mjs`. Note that `eslint.ignoreDuringBuilds:
true` also means lint never blocks a release — worth revisiting separately.

### H14. Modal has no focus management
**Where** `components/ui/modal.tsx`.
**Why** No focus trap (Tab escapes to the page behind), no initial focus, no restoration on
close, and the background is not inert. Escape and scroll-lock *are* handled, so the gap is
specifically keyboard and screen-reader navigation.
**Fix** Trap Tab within the dialog, focus the first control on open, restore the trigger on
close, `aria-hidden` the rest of the page.

---

## MEDIUM

| # | Issue | Where | Fix |
|---|---|---|---|
| M1 | `metadataBase` falls back to `http://localhost:3000`, so with `NEXT_PUBLIC_SITE_URL` unset in production every OG and Twitter image URL points at localhost | `app/layout.tsx:9,31` | Fail the build, or fall back to the deployment URL (`VERCEL_URL`) |
| M2 | Export anchor is never appended to the DOM — Firefox ignores the click | `profile.tsx:80-83` | Append, click, remove (as `downloadDataUrl` does) |
| M3 | `URL.revokeObjectURL` runs synchronously after `click()` — Firefox and Safari may cancel the download | `profile.tsx:84` | Revoke inside `setTimeout(…, 0)` |
| M4 | `?host=1` on a mistyped link silently *creates* a room instead of reporting not-found | `lib/rooms/api.ts:77-82`, `app/room/[roomCode]/page.tsx:24` | Only honour `host=1` when arriving from the launcher |
| M5 | Room codes are generated with no uniqueness check; a collision drops you into a stranger's room | `experience-launcher.tsx:30` → `api.ts:230-234` | Check existence before routing; retry on collision |
| M6 | No `sitemap.ts`, no `robots.ts`, no `manifest.ts`; `public/` is empty (no `apple-touch-icon`) | `app/` | Add them; keep `/room` and `/gift` excluded from indexing |
| M7 | `seenEvents` grows without bound for the tab's lifetime | `local-transport.ts:28`, `supabase-transport.ts:23` | Cap at ~500 ids, FIFO |
| M8 | No offline detection at all — `navigator.onLine` and the `offline` event are unused codebase-wide | everywhere | Banner on `offline`; queue or block room writes |
| M9 | The client-side judge fetch has no timeout, and the `judging` ref is only cleared in `.catch()` — a hung request strands the room on "deliberating" with no retry | `lib/ai/client.ts:12-16`, `couples-court.tsx:68-94`, `debate.tsx:71-97` | `AbortSignal.timeout` on the client fetch to match the server's 25 s |
| M10 | YouTube API load never times out — a blocked script leaves the player in "loading" forever | `components/watch/video-surface.tsx:65-66` | Reject after ~10 s and show a retry |
| M11 | `http:` video sources are blocked as mixed content with no message | `lib/media/video-source.ts:70` | Reject `http:` when the page is https, and say why |
| M12 | `viewport-fit=cover` is set but no `env(safe-area-inset-*)` padding exists | `app/layout.tsx:65`, `app/globals.css` | Pad the fixed header, footer and bottom-sheet |
| M13 | Camera does not react to the OS revoking the stream | `lib/media/use-camera.ts` | Handle `track.onended`; return to the idle state |
| M14 | Sealed letters and gifts are readable before their date — the payload sits in the URL fragment / localStorage in cleartext | `lib/gift-link.ts:44-47`, `lib/store/index.ts:156-169` | Either say plainly that sealing is a courtesy, or encrypt with a date-derived key |
| M15 | A double-tap on a quiz answer overwrites the first choice, because the guard reads replicated state that lags | `quiz-engine.tsx:141-157` | Guard on a local ref as well as `myEntry` |
| M16 | Print Studio range inputs have visual labels but no programmatic association | `print-studio.tsx:326,338` | `id` + `htmlFor`, or `aria-label` |
| M17 | `profiles_read using (true)` exposes every display name | `supabase/schema.sql:308` | Restrict to couple members |
| M18 | A partner dropping mid-game is never surfaced — the seat just empties | `game-shell.tsx:85-89` | "They've dropped out — waiting" after the presence timeout |
| M19 | Prompt injection: user text goes straight into the judge prompt | `app/api/judge/route.ts:52-59` | Delimit and instruct the model to treat it as data |
| M20 | `RoomProvider`'s context value is rebuilt on every render, and the 3 s presence tick replaces `state` — every consumer re-renders and every `useMemo` over `state` gets a new identity. This is the root cause the C1 judge-storm fix worked around with a ref | `room-provider.tsx:124-166` | Memoise the value; split presence out of the state document |
| M21 | `STORAGE_KEYS` in Profile duplicates `KEYS` in the store and has already drifted (see H4) | `profile.tsx:17` vs `lib/store/index.ts:26` | Export `KEYS` and consume it |

---

## LOW

| # | Issue | Where |
|---|---|---|
| L1 | Honest Cards' 170 ms flip timer is never cleared; rapid taps stack | `honest-cards.tsx:40` |
| L2 | "Copied" toast timers are never cleared on unmount | `room-code.tsx:24`, `share-dialog.tsx:38`, `birthday-gift.tsx:379` |
| L3 | Join accepts 4-character codes while the error text says "six characters" | `experience-launcher.tsx:36`, `join-room-dialog.tsx:20` |
| L4 | The modal scrim is a full-screen `<button aria-label="Close">`, announced before the dialog content | `components/ui/modal.tsx:45-50` |
| L5 | `busy` is never reset if `router.push` does not unmount the launcher, leaving both buttons disabled | `experience-launcher.tsx:28-31` |
| L6 | Storage policies use the deprecated `storage.objects.owner` rather than `owner_id` | `supabase/schema.sql:423` |
| L7 | Face-down memory-match cards render "?" in transparent text — read aloud as "question mark" twelve times | `arcade/games.tsx` |
| L8 | `roomExists` on the hosted transport subscribes and tears down a full realtime channel just to check a row exists | `lib/rooms/api.ts:272-278` |

---

## Categories checked with nothing to report

**Empty states** — no "No data" / "Coming soon" placeholders anywhere; every collection has
a written empty state. **Timer cleanup** — every gameplay timer in the Arcade, the quiz
engine and the countdown is tracked and cleared; the only uncleared ones are the four
cosmetic toasts in L1/L2. **Secrets** — `ANTHROPIC_API_KEY` is read server-side only and
never reaches the browser; the only client-exposed values are the intended
`NEXT_PUBLIC_SUPABASE_*` pair; `.gitignore` covers `.env` and `.env.local`; no `.env` file
is present in the tree. **XSS** — no `dangerouslySetInnerHTML`, no `eval`, no
`new Function` anywhere. **Video URL handling** — protocol allow-list, host allow-list and
an 11-character id regex; no `javascript:` or `data:` path through. **Error boundaries** —
`app/error.tsx` and `app/global-error.tsx` are present and styled.

## Previous audit's fixes, verified

`C1` judge-storm ref guard — present and correct, including the reset at
`couples-court.tsx:144` and `debate.tsx:116` that stops a repeat case deadlocking.
`C3` namespace-wide delete — present (`profile.tsx:38-45`), though export was not brought
along with it (H4). `C4` storage-error listener — present and wired
(`storage-notice.tsx`). `C5` Snap Hunt capture size — present, tighter than described
(640 px / 0.62 at `photo-input.tsx:18-19`). `C7` error boundaries — present.
`C2` and `C6` remain open and are restated here as K4 and K3.
