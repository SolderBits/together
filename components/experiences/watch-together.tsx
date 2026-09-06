"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GameShell, WaitingForPartner } from "@/components/games/game-shell";
import { useAnnounce } from "@/components/a11y/announcer";
import { VideoSurface, type VideoHandle } from "@/components/watch/video-surface";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/badge";
import { TextField } from "@/components/ui/field";
import { useRoom, useRoomEvent, useSharedState } from "@/components/room/room-provider";
import {
  describeSource,
  formatTime,
  parseVideoUrl,
  type VideoSource,
} from "@/lib/media/video-source";
import { saveMemory } from "@/lib/store";
import { useRecordCompletion } from "@/lib/store/use-completion";
import { uid } from "@/lib/utils";
import { cn } from "@/lib/utils";

/**
 * Shared playback state.
 *
 * `currentTime` is only ever a *snapshot* taken at `lastUpdated`. Clients
 * extrapolate forward from it, which is what lets playback stay in step
 * without anyone streaming a position every second.
 */
interface WatchData {
  source: VideoSource | null;
  playing: boolean;
  currentTime: number;
  lastUpdated: number;
  /** Whoever last pressed something — shown in the UI, not a permission. */
  controllerId: string | null;
}

const DEFAULTS: WatchData = {
  source: null,
  playing: false,
  currentTime: 0,
  lastUpdated: 0,
  controllerId: null,
};

const REACTIONS = ["❤️", "😂", "😭", "😳", "🔥", "👀", "👏"] as const;

/** Beyond this, seek. Below it, nudge the rate instead. */
const HARD_SYNC_SECONDS = 1.6;
const SOFT_SYNC_SECONDS = 0.4;

interface FloatingReaction {
  id: string;
  emoji: string;
  by: string;
  left: number;
}

interface ChatLine {
  id: string;
  by: string;
  name: string;
  emoji: string;
  text: string;
  at: number;
}

/** Nudges for the blank screen — the hardest part of watching anything together. */
const WATCH_IDEAS = [
  "Pick something neither of you has seen.",
  "Rewatch the one you quote at each other.",
  "Find the weirdest video you can in sixty seconds.",
  "Show them the thing you keep saying they\u2019d love.",
];

export function WatchTogether() {
  const { state, identity, players, partner, isHost, broadcast } = useRoom();
  const [data, setData] = useSharedState<WatchData>("watch", DEFAULTS);

  const playerRef = useRef<VideoHandle>(null);
  const [ready, setReady] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [localTime, setLocalTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [drift, setDrift] = useState(0);
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(false);

  /** Suppresses the echo when we move the player ourselves. */
  const applying = useRef(false);

  useRecordCompletion("watch-together", Boolean(data.source) && data.playing, data.source?.ref ?? "none");

  // ---------------------------------------------------------------- events

  const reactionTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => reactionTimers.current.forEach(clearTimeout), []);

  // The id comes from the sender, so the same reaction re-delivered after a
  // reconnect animates once rather than twice.
  useRoomEvent<{ id?: string; emoji: string; by: string }>("watch:reaction", (payload) => {
    const id = payload.id ?? uid("rx_");
    setReactions((current) => {
      if (current.some((r) => r.id === id)) return current;
      reactionTimers.current.push(
        setTimeout(() => setReactions((c) => c.filter((r) => r.id !== id)), 2600),
      );
      return [...current, { id, emoji: payload.emoji, by: payload.by, left: 8 + Math.random() * 78 }];
    });
  });

  // Every line carries its own id, so a re-delivery after a reconnect — or the
  // local transport echoing our own broadcast back — lands on a line already in
  // the list and is dropped rather than shown twice.
  useRoomEvent<ChatLine>("watch:message", (line) => {
    if (!line?.id) return;
    setChat((current) =>
      current.some((existing) => existing.id === line.id)
        ? current
        : [...current.slice(-40), line],
    );
  });

  // ------------------------------------------------------------ local clock

  useEffect(() => {
    const t = setInterval(() => {
      const p = playerRef.current;
      if (!p) return;
      setLocalTime(p.getTime());
      setDuration(p.getDuration());
    }, 400);
    return () => clearInterval(t);
  }, []);

  /** Where the room believes we should be, extrapolated from the snapshot. */
  const expectedTime = useCallback(() => {
    if (!data.lastUpdated) return data.currentTime;
    const elapsed = data.playing ? (Date.now() - data.lastUpdated) / 1000 : 0;
    return data.currentTime + elapsed;
  }, [data.currentTime, data.lastUpdated, data.playing]);

  // ----------------------------------------------------------- drift repair

  useEffect(() => {
    if (!ready || !data.source) return;

    const tick = setInterval(() => {
      const player = playerRef.current;
      if (!player) return;

      const target = expectedTime();
      const actual = player.getTime();
      const delta = target - actual;
      setDrift(delta);

      // Match the room's play/pause state first.
      if (data.playing && !player.isPlaying()) {
        applying.current = true;
        player.play();
        setTimeout(() => (applying.current = false), 400);
      }
      if (!data.playing && player.isPlaying()) {
        applying.current = true;
        player.pause();
        setTimeout(() => (applying.current = false), 400);
      }

      if (!data.playing) {
        player.setRate(1);
        if (Math.abs(delta) > HARD_SYNC_SECONDS) player.seekTo(target);
        return;
      }

      // A jump is jarring, so only seek when we're properly adrift.
      if (Math.abs(delta) > HARD_SYNC_SECONDS) {
        applying.current = true;
        player.seekTo(target);
        player.setRate(1);
        setTimeout(() => (applying.current = false), 500);
        return;
      }

      // Otherwise ease back into position by running slightly fast or slow.
      if (Math.abs(delta) > SOFT_SYNC_SECONDS) {
        player.setRate(delta > 0 ? 1.05 : 0.95);
      } else {
        player.setRate(1);
      }
    }, 1200);

    return () => clearInterval(tick);
  }, [ready, data.source, data.playing, expectedTime]);

  // ------------------------------------------------------------- commands

  const publish = useCallback(
    (patch: Partial<WatchData>) => {
      void setData((c) => ({
        ...c,
        ...patch,
        lastUpdated: Date.now(),
        controllerId: identity.id,
      }));
    },
    [identity.id, setData],
  );

  function chooseVideo(e: React.FormEvent) {
    e.preventDefault();
    const result = parseVideoUrl(urlDraft);
    if (!result.ok) {
      setUrlError(result.reason);
      return;
    }
    setUrlError(null);
    setReady(false);
    publish({ source: result.source, playing: false, currentTime: 0 });
  }

  const onLocalPlay = useCallback(
    (time: number) => {
      if (applying.current) return;
      publish({ playing: true, currentTime: time });
    },
    [publish],
  );

  const onLocalPause = useCallback(
    (time: number) => {
      if (applying.current) return;
      publish({ playing: false, currentTime: time });
    },
    [publish],
  );

  function togglePlay() {
    const player = playerRef.current;
    const time = player?.getTime() ?? expectedTime();
    publish({ playing: !data.playing, currentTime: time });
  }

  function nudge(seconds: number) {
    const player = playerRef.current;
    const target = Math.max(0, (player?.getTime() ?? expectedTime()) + seconds);
    applying.current = true;
    player?.seekTo(target);
    setTimeout(() => (applying.current = false), 400);
    publish({ currentTime: target });
  }

  function scrub(value: number) {
    applying.current = true;
    playerRef.current?.seekTo(value);
    setTimeout(() => (applying.current = false), 400);
    publish({ currentTime: value });
  }

  /**
   * The transport echoes broadcasts back to the sender, so there's no local
   * append here — doing both would render everything twice for whoever sent it.
   */
  function react(emoji: string) {
    void broadcast("watch:reaction", { id: uid("rx_"), emoji, by: identity.id });
  }

  function send(e: React.FormEvent) {
    e.preventDefault();
    const text = message.trim();
    if (!text) return;
    const line: ChatLine = {
      id: uid("msg_"),
      by: identity.id,
      name: identity.name,
      emoji: identity.emoji,
      text,
      at: Date.now(),
    };
    void broadcast("watch:message", line);
    setMessage("");
  }

  // ------------------------------------------------------------ no video yet

  if (!data.source) {
    return (
      <GameShell title="Watch Together" hint="Paste a link. Playback stays in step on both sides.">
        <div className="mx-auto max-w-xl">
          <form
            onSubmit={chooseVideo}
            className="rounded-[32px] bg-surface p-8 shadow-sm ring-1 ring-inset ring-line sm:p-10"
          >
            <h2 className="t-h2 text-ink">What are we watching?</h2>
            <p className="t-body-sm mt-3 max-w-[46ch]">
              A YouTube link, or a direct link to a video file. Nothing is uploaded or re-hosted —
              we only keep the two players at the same timestamp.
            </p>

            <TextField
              className="mt-7"
              value={urlDraft}
              onChange={(e) => {
                setUrlDraft(e.target.value);
                setUrlError(null);
              }}
              placeholder="https://www.youtube.com/watch?v=…"
              aria-label="Video link"
              autoComplete="off"
              spellCheck={false}
            />
            {urlError && (
              <p className="mt-3 text-[13.5px] font-semibold text-[#a5322a]">{urlError}</p>
            )}

            <Button block size="xl" type="submit" className="mt-5" disabled={!urlDraft.trim()}>
              Load it
            </Button>

            <div className="mt-7 flex flex-wrap gap-2">
              <Pill tone="neutral">YouTube links</Pill>
              <Pill tone="neutral">.mp4 · .webm · .mov</Pill>
              <Pill tone="neutral">Volume stays local</Pill>
            </div>
          </form>

          <div className="mt-6 rounded-[26px] bg-surface-muted p-6 ring-1 ring-inset ring-line sm:p-7">
            <p className="t-eyebrow">If you can&rsquo;t decide</p>
            <ul className="mt-4 space-y-3">
              {WATCH_IDEAS.map((idea) => (
                <li key={idea} className="flex items-start gap-3 text-[14px] font-semibold tracking-[-0.015em] text-ink-soft">
                  <span
                    className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-ink-faint"
                    aria-hidden="true"
                  />
                  {idea}
                </li>
              ))}
            </ul>
          </div>

          {!partner && (
            <div className="mt-6">
              <WaitingForPartner
                label="nobody else is here yet"
                detail="You can load something now — it'll be waiting when they arrive."
              />
            </div>
          )}
        </div>
      </GameShell>
    );
  }

  // ---------------------------------------------------------------- watching

  const inSync = Math.abs(drift) <= SOFT_SYNC_SECONDS;

  // Playback is controlled by both people, so most changes here are somebody
  // else's doing. Say who, and say what.
  const controller =
    data.controllerId === identity.id
      ? "You"
      : state?.players[data.controllerId ?? ""]?.name ?? "They";
  useAnnounce(
    data.source
      ? data.playing
        ? `${controller} started playing at ${formatTime(data.currentTime)}.`
        : `${controller} paused at ${formatTime(data.currentTime)}.`
      : null,
  );
  useAnnounce(partner && !inSync ? "Catching up with them." : null);

  return (
    <GameShell title="Watch Together" width="wide">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* ---------------- player ---------------- */}
        <div className="relative">
          <VideoSurface
            ref={playerRef}
            source={data.source}
            onReady={() => setReady(true)}
            onLocalPlay={onLocalPlay}
            onLocalPause={onLocalPause}
          />

          {/* floating reactions */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {reactions.map((r) => (
              <span
                key={r.id}
                className="absolute bottom-6 text-[34px]"
                style={{
                  left: `${r.left}%`,
                  animation: "rx-float 2.6s cubic-bezier(.22,1,.36,1) forwards",
                }}
              >
                {r.emoji}
              </span>
            ))}
          </div>

          {/* ---------------- transport ---------------- */}
          <div className="mt-5 rounded-[26px] bg-surface p-5 shadow-sm ring-1 ring-inset ring-line sm:p-6">
            <div className="flex items-center gap-4">
              <Button size="md" onClick={togglePlay}>
                {data.playing ? "Pause" : "Play"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => nudge(-10)}>
                −10s
              </Button>
              <Button size="sm" variant="ghost" onClick={() => nudge(10)}>
                +10s
              </Button>
              <span className="t-num ml-auto text-[13.5px] font-bold text-ink-muted">
                {formatTime(localTime)}
                <span className="text-ink-faint"> / {formatTime(duration)}</span>
              </span>
            </div>

            <input
              type="range"
              min={0}
              max={Math.max(1, Math.floor(duration))}
              value={Math.min(Math.floor(localTime), Math.max(1, Math.floor(duration)))}
              onChange={(e) => scrub(Number(e.target.value))}
              aria-label="Scrub"
              className="mt-4 w-full accent-[color:var(--text)]"
            />

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {partner ? (
                <Pill tone={inSync ? "good" : "warn"}>
                  {inSync ? "Watching together" : `Catching up · ${Math.abs(drift).toFixed(1)}s`}
                </Pill>
              ) : (
                <Pill tone="neutral">Watching on your own</Pill>
              )}
              <Pill tone="neutral">{describeSource(data.source)}</Pill>
              {data.controllerId && (
                <Pill tone="neutral">
                  last touched by{" "}
                  {data.controllerId === identity.id
                    ? "you"
                    : state?.players[data.controllerId]?.name ?? "them"}
                </Pill>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto"
                onClick={() => publish({ source: null, playing: false, currentTime: 0 })}
              >
                Change video
              </Button>
            </div>
          </div>
        </div>

        {/* ---------------- side panel ---------------- */}
        <aside className="flex flex-col gap-4">
          <div className="rounded-[26px] bg-surface p-5 shadow-sm ring-1 ring-inset ring-line">
            <p className="t-eyebrow mb-4">Watching</p>
            <div className="space-y-2.5">
              {players.map((p) => (
                <div key={p.id} className="flex items-center gap-3 rounded-[16px] bg-surface-muted px-4 py-3">
                  <span className="grid h-8 w-8 place-items-center rounded-pill bg-surface text-[15px]">
                    {p.emoji}
                  </span>
                  <span className="flex-1 text-[13.5px] font-bold tracking-[-0.018em] text-ink">
                    {p.id === identity.id ? "You" : p.name}
                  </span>
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      data.playing ? "bg-mint-deep" : "bg-butter-mid",
                    )}
                    aria-hidden="true"
                  />
                </div>
              ))}
              {!partner && (
                <div className="rounded-[16px] border-[1.5px] border-dashed border-line-strong px-4 py-3">
                  <p className="t-caption">Waiting for them to join…</p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[26px] bg-surface p-5 shadow-sm ring-1 ring-inset ring-line">
            <p className="t-eyebrow mb-4">React</p>
            <div className="flex flex-wrap gap-1.5">
              {REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => react(emoji)}
                  className="grid h-11 w-11 place-items-center rounded-[15px] bg-surface-sunken text-[19px] transition-all duration-250 ease-spring hover:-translate-y-[2px] hover:scale-110 hover:bg-surface-muted"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div className="flex min-h-[220px] flex-1 flex-col rounded-[26px] bg-surface p-5 shadow-sm ring-1 ring-inset ring-line">
            <p className="t-eyebrow mb-4">Chat</p>
            <div className="scroll-slim mb-4 flex-1 space-y-2.5 overflow-y-auto">
              {chat.length === 0 ? (
                <p className="t-caption">Nothing said yet.</p>
              ) : (
                chat.map((line) => (
                  <div key={line.id} className="rounded-[14px] bg-surface-muted px-3.5 py-2.5">
                    <p className="t-caption mb-0.5">
                      {line.emoji} {line.by === identity.id ? "You" : line.name}
                    </p>
                    <p className="text-[13.5px] leading-snug text-ink">{line.text}</p>
                  </div>
                ))
              )}
            </div>
            <form onSubmit={send} className="flex gap-2">
              <TextField
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Send a message"
                aria-label="Message"
                className="py-2.5 text-[13.5px]"
              />
              <Button size="sm" type="submit" disabled={!message.trim()}>
                Send
              </Button>
            </form>
          </div>

          <Button
            variant="secondary"
            disabled={saved}
            onClick={() => {
              saveMemory({
                experienceId: "watch-together",
                title: "Watched together",
                detail: `${describeSource(data.source!)} · ${formatTime(localTime)} in`,
              });
              setSaved(true);
            }}
          >
            {saved ? "Saved to your story" : "Keep this one"}
          </Button>
        </aside>
      </div>

      <style>{`
        @keyframes rx-float {
          0%   { opacity: 0; transform: translateY(0) scale(.6); }
          15%  { opacity: 1; transform: translateY(-14px) scale(1.15); }
          100% { opacity: 0; transform: translateY(-190px) scale(1); }
        }
      `}</style>
    </GameShell>
  );
}
