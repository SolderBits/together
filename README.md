# Together

Twenty small experiences built for two people — quizzes, drawings, debates,
photo strips and keepsakes — that work whether you're on the same sofa or in
different time zones.

One person starts a room and gets a six-character code plus an invite link. The
other opens it. Nobody needs an account.

> **`Together` is a placeholder name.** It appears in exactly two places:
> `lib/site.ts` (the product name and taglines) and `components/layout/brand.tsx`
> (the wordmark and mark). Change those two files and the whole app is renamed.

---

## Quick start

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. **No configuration is required.** With an empty
`.env.local` the app runs in *local mode*: rooms, realtime sync, saved memories,
letters, gifts and the scrapbook all work using browser APIs.

To try a two-player experience on one machine, open the invite link in a second
tab. The player id lives in `sessionStorage`, so each tab is a separate player
while your display name (in `localStorage`) stays shared.

```bash
npm run build      # production build
npm run typecheck  # tsc --noEmit
npm run start      # serve the production build
```

---

## What needs configuring, and what doesn't

Everything below is optional. Each one upgrades a capability that already works.

| Feature | With no config | Once configured |
| --- | --- | --- |
| Rooms & realtime | `BroadcastChannel` + `localStorage` — two tabs on one machine | Supabase Realtime — two devices anywhere |
| Accounts | Guest identity per browser | Guest identity per browser — there is no account to make |
| Saved memories | This browser only | This browser only |
| Debate / Couples Court judging | Deterministic offline judge | Anthropic model, scored server-side |
| Letters | Unseal in-app on the delivery date | Could be emailed on the date |

Copy `.env.example` to `.env.local` and fill in what you want. The file documents
each variable and where to get it. The short version:

```bash
# Rooms, realtime, auth and storage across devices
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...

# AI judging for Debate and Couples Court (server-side only, never shipped to the browser)
ANTHROPIC_API_KEY=...
```

Then run [`supabase/schema.sql`](supabase/schema.sql) in your project's SQL
editor. It creates every table, turns on Row Level Security, adds the policies,
registers `rooms` with the realtime publication and creates two private storage
buckets.

**API keys are never read in client code.** The only key-consuming path is
`app/api/judge/route.ts`, which runs on the server. If the key is absent or the
call fails, it falls back to the offline judge and the UI says which one produced
the verdict.

---

## Architecture

```
app/
  (routes)            /  /about  /hub  /profile  /scrapbook  /studio  /photobooth
  play/[experience]   room launcher for every multiplayer experience
  play/…              standalone experiences (arcade, honest cards, letters, gift)
  room/[roomCode]     the live room — lobby, then the experience itself
  gift/[giftId]       a shared gift page, openable from a QR
  api/judge           server-side AI judging with an offline fallback

components/
  ui/                 Button, Card, Modal, Badge, fields, icon set
  layout/             header, footer, page shell, brand
  room/               provider, lobby, stage, room code, presence, share dialog
  games/              GameShell, QuestionCard, ScoreBoard, Countdown, QuizEngine
  drawing/            CanvasEditor + toolbar (used by Draw Together and Print Studio)
  photo/              camera capture with upload fallback, PhotoStrip
  experiences/        one file per experience + the registry
  hub/                Connection Tree

lib/
  realtime/           transport interface + local and Supabase implementations
  rooms/              RoomSession, the room API, guest identity, types
  games/content/      every question, card, riddle and prompt (data-driven)
  media/              camera, photo-strip composition, stroke rendering, generative art
  store/              local-first persistence for everything you keep
  supabase/           browser and server clients, auth helpers
  ai/                 judge types, offline judge, client
```

### The room system

Experiences never touch a transport or a socket. They call `useRoom()` and read
or write a slice of the shared document:

```ts
const { state, roster, players, isHost, update, broadcast } = useRoom();
const [data, setData] = useSharedState("draw", DEFAULTS);
```

The documented API in `lib/rooms/api.ts` is the layer underneath:

```ts
createRoom(experienceId)    joinRoom(code)          leaveRoom(session)
subscribeToRoom(session, fn) updateRoomState(session, patch)
setPlayerReady(session, on)  startExperience(session)
broadcastEvent(session, type, payload)
```

Three details worth knowing:

- **One document, one channel.** `RoomState` holds status, host, seed, players
  and a free-form `data` bag. Experiences own only `data`.
- **Writes are serialised.** `lib/realtime/queue.ts` chains every
  read-modify-write, so two updates in the same tick can't clobber each other.
- **Shared randomness comes from `state.seed`.** Both clients derive the same
  prompts and questions from it with `pickDeterministic`, so nothing has to be
  sent over the wire to agree on content.

### Realtime, twice

`lib/realtime/transport.ts` defines the contract. Two implementations satisfy it
and `createTransport()` picks one:

- `LocalRoomTransport` — `localStorage` for the document (so a refresh
  reconnects), `BroadcastChannel` for change fan-out.
- `SupabaseRoomTransport` — `rooms.state` jsonb for the document, channel
  broadcast for latency and `postgres_changes` as the reconnect path.

Swapping in a different backend means writing one class.

### Presence

Players heartbeat every 3s and are considered present for 45s. That window is
deliberately generous: browsers throttle timers in background tabs, and a
partner who switches away must not look like they've left. Pressing **Leave**
zeroes the heartbeat instead, which removes them immediately.

Results and scoreboards read `roster` (everyone the room knows about) rather
than `players` (online right now), so nobody vanishes from a final score.

---

## The experiences

| | Room-based | Notes |
| --- | --- | --- |
| Know Me Quiz | ✅ | Turns alternate; answers hidden until both submit |
| Truth or Dare | ✅ | Reflex duel decides who's on the hook |
| Honest Cards | — | Five categories, favourites saved |
| IQ Duel | ✅ | Shared deadline, speed bonus |
| Riddle Night | ✅ | Free-text answers, hints, one guess between you |
| The Lab | ✅ | Pick subjects; versus or co-op |
| Arcade | — | Five real minigames with a high-score shelf |
| Debate | ✅ | Sides assigned; judged on four criteria |
| Draw Together | ✅ | Live stroke sync, shared timer, side-by-side compare |
| Couples Court | ✅ | Plaintiff, defendant, evidence, playful sentence |
| Snap Hunt | ✅ | Timed photo hunts; camera or upload |
| Love Match | ✅ | Distance-weighted compatibility score |
| Our Future | ✅ | Shared vision board, live drag, exportable |
| Birthday Gift | — | Sealed page; the QR link carries the whole gift |
| Letters | — | Sealed until the date, in your timezone |
| Print Studio | — | Layered editor, generated art, shirt preview |
| Digital Scrapbook | — | Everything you keep, taped to paper |
| Couples Hub | — | Profile, memories, goals, Connection Tree |
| Photobooth | ✅ | Synchronised capture, frames, filters, stickers |
| Watch Together | ✅ | Shared playback of a YouTube or direct video link, plus reactions and chat |

### Watch Together notes

Nothing is hosted, proxied or re-served. You paste a link and we synchronise
*playback position only* — YouTube plays through its own official embeddable
player, and direct video files (`.mp4`, `.webm`, `.mov`) play in a plain
`<video>` element. Anything else is rejected with an explanation rather than
failing silently.

The sync model rides the existing `RoomTransport`; there is no second
multiplayer stack. Shared state is a snapshot, not a stream:

```ts
{ source, playing, currentTime, lastUpdated, controllerId }
```

Clients extrapolate forward from `currentTime` using `lastUpdated`, so nobody
has to broadcast a position every second. Correction is deliberately gentle:
under 0.4s of drift is ignored, 0.4–1.6s is absorbed by nudging playback rate to
1.05× or 0.95×, and only beyond 1.6s does a client actually seek. Volume is
never synchronised — it stays local to each device. Reactions and chat travel as
ephemeral broadcast events.

### Photobooth notes

- Both cameras appear side by side; peer video is a low-rate frame relay over
  the room's event channel, not WebRTC.
- The countdown is an absolute timestamp, so both devices fire together.
- Strips are composed entirely on-device with Canvas. The preview renders at
  900px; **Download** re-renders at 2400px wide (a four-shot strip exports at
  2400×7222).
- Photos never enter the room document — four full frames per person would
  bloat every state write. They travel over the event channel and are mirrored
  into `sessionStorage`, so a refresh mid-session recovers the strip. A late
  joiner asks for the frames it missed.
- If the camera is blocked or absent, **"No camera? Build a strip from photos"**
  produces the same strip from uploads.

### Gift pages

A gift page carries its own contents in the URL fragment (after the `#`, so it
is never sent to a server). That means the QR works on a phone that has never
opened the app. If the photos would make the URL unusable, they're dropped from
the link and the share dialog says so.

### Content

Content lives in `lib/games/content/` and is the largest part of the product by
volume: 104 Know Me questions across six categories, 120 Honest Cards with three
intensity levels, 100 truths and 100 dares, 100 riddles, 100 IQ Duel questions,
85 Love Match questions across ten weighted dimensions, 102 debate motions, 40
court cases and 55 photo hunts.

`lib/games/content/pick.ts` has the selection helpers. Anything shown inside a
room uses the deterministic path (`pickBalanced`, `pickSeeded`) so both clients
derive the same set from `state.seed` without sending it over the wire, and
`pickBalanced` spreads across categories so a round is never eight "deep"
questions in a row. Solo surfaces use `pickFresh`, which remembers recently-seen
ids for the tab's lifetime so nothing repeats straight away.

Love Match is weighted rather than a plain match count: each question belongs to
a dimension, and dimensions carry weights — how you argue counts for considerably
more than how you like your coffee. Identical answers score full, adjacent ones
score half. The result screen says out loud that it isn't scientific.

### Connection Tree

Growth is deterministic and weighted: `computeTreeProgress()` scores each
completion by how much the experience actually asked of you (a round of Arcade
is 1, Honest Cards is 3), then maps the total onto eight stages. Things you
*keep* hang off the tree instead of growing it — saved memories become fruit,
photobooth strips become blossoms, sealed letters become flowers, and a vision
board adds a branch. The tree is generated recursively, so the same progress
always draws the same tree.

---

## Design system

Everything visual routes through tokens in `app/globals.css` and a thin Tailwind
mapping in `tailwind.config.ts`. No component hardcodes a colour, radius or
shadow.

- **Surfaces** — a warm off-white page (`--background: #fbf9f6`), white cards,
  hairline rings instead of borders, and shadows that are barely there.
- **Ink** — warm near-black (`#16140f`), never pure black, with three quieter
  steps beneath it.
- **Pastels** — six accents (blush, sky, lilac, butter, mint, peach), each as a
  `tint` / `mid` / `deep` triple. An experience owns exactly one, and it appears
  as a soft wash on its card, its lobby and the top of its game screen. Colour
  identifies; it never decorates everything at once.
- **Type** — Plus Jakarta Sans for the whole interface, with Instrument Serif
  italic used once or twice a page as an editorial accent. One scale
  (`.t-display` → `.t-caption`) is used everywhere; headings are tightly tracked
  and set with `text-balance`.
- **Motion** — entrance rises, card lifts, a spring on small controls, a
  breathing ring while waiting, a capture flash. All of it collapses under
  `prefers-reduced-motion`.

### Illustration

`components/art/scenes.tsx` holds nineteen original SVG scenes — one per
experience — drawn on a single 200×150 grid with flat pastel shapes and a warm
ink outline. They are compositions, not icons: two speech bubbles for Know Me,
two canvases and a pencil for Draw Together, a strip leaving the booth for
Photobooth. Each takes the experience's pastel triple as props, which is what
keeps nineteen different pictures reading as one hand.

### The grid

Cards are not uniform. `size` on each experience (`sm` / `md` / `lg` / `band`)
drives both its span on a six-column desktop grid and its internal composition —
where the art sits, how large the title is, whether the illustration bleeds past
the corner. Rows resolve as 4+2, 2+2+2, 2+4, 3+3, then a full-width band, and
the Photobooth gets a flagship band of its own. On tablet it collapses to two
columns, on phones to one.

Reusable pieces: `Button` / `ButtonLink` / `IconButton`, `Card` / `SectionHead` /
`Rule`, `NewBadge` / `Pill` / `StatusDot`, `Modal`, `TextField` / `TextArea` /
`Label` / `Check`, `ExperienceCard` / `ExperienceGrid` / `FlagshipCard`,
`GameShell` / `QuestionCard` / `AnswerOption` / `ScoreBoard` / `CountdownRing`,
`RoomLobby` / `RoomCode` / `PlayerStatus` / `ShareDialog`, `SiteHeader` /
`SiteFooter` / `PageShell` / `PageHeading`.

## Data and privacy

In local mode everything you keep is in this browser: strips, scrapbook pages,
letters, gifts, goals, arcade scores and the guest profile. Nothing is uploaded.
**Profile → Your data** exports all of it as JSON or deletes it.

Photos and camera frames stay on-device: strips are composed locally, and the
only images that ever cross the wire are the ones sent to your partner in the
room you're both in.

---

## Verification performed

Two browser tabs acting as two players, with no backend configured:

- All 28 routes return 200; production build clean; `tsc --noEmit` clean
- Room creation, join by code, invite link, presence, refresh-reconnect, leave
- Draw Together: synchronised start, live stroke streaming, shared timer,
  both drawings on the compare screen, download, save to scrapbook
- Know Me: turn alternation, answers hidden until both submit, scoring
- IQ Duel / The Lab / Riddle Night / Truth or Dare / Love Match / Snap Hunt /
  Our Future / Debate / Couples Court played through
- Photobooth: camera-denied path, upload path, strip composition, frame, filter,
  caption, stickers, 2400px download, scrapbook save, refresh recovery
- Gift link opened on a store with no local record of the gift
- Watch Together: URL validation (unsupported links rejected with a reason),
  YouTube + `youtu.be` parsing, two-client play/pause/seek sync, reactions and
  chat, and a late joiner loading straight into the same video
- Zero console errors across every page; mobile viewport has no horizontal
  overflow and a single-column grid

Known limits: peer video in the photobooth is a frame relay rather than WebRTC;
letters are not emailed without a provider; and in local mode a room only exists
on the machine that created it.
