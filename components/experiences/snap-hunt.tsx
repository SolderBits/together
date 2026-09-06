"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameShell, WaitingForPartner } from "@/components/games/game-shell";
import { CountdownRing } from "@/components/games/countdown";
import { ScoreBoard } from "@/components/games/scoreboard";
import { PhotoInput } from "@/components/photo/photo-input";
import { Button } from "@/components/ui/button";
import { MemoryMoment } from "@/components/games/memory-moment";
import { Pill } from "@/components/ui/badge";
import { useRoom, useRoomEvent, useSharedState } from "@/components/room/room-provider";
import {
  HUNT_DIFFICULTIES,
  HUNT_KINDS,
  HUNT_PROMPTS,
  huntsFor,
  type HuntDifficulty,
} from "@/lib/games/content/snap-hunt";
import { pickBalanced } from "@/lib/games/content/pick";
import { cn, uid } from "@/lib/utils";
import { addScrapbookItem } from "@/lib/store";
import { useRecordCompletion } from "@/lib/store/use-completion";

const ROUNDS = 5;

/**
 * What the replicated document records about a photo — never the photo.
 *
 * The pixels travel over the event channel and are mirrored into
 * sessionStorage, exactly as the Photobooth does. Five rounds of full-size
 * frames inside `state` meant several megabytes being re-serialised into
 * localStorage on every three-second heartbeat, which jams the main thread on a
 * phone and exhausts the origin quota outright — at which point the room stops
 * persisting and a refresh loses the game.
 */
interface Shot {
  /** Identifies the pixels that belong to this entry, across clients. */
  photoId: string;
  /** A few kilobytes, so a late joiner sees *something* before the full frame lands. */
  thumbnail: string;
  /** Milliseconds left when it landed — faster snaps score more. */
  msLeft: number;
  width: number;
  height: number;
}

/** Pixels live here, keyed by photoId, and never enter the room document. */
function photosKey(code: string) {
  return `together:hunt:${code}`;
}

function readStoredPhotos(code: string): Record<string, string> {
  try {
    return JSON.parse(window.sessionStorage.getItem(photosKey(code)) ?? "{}");
  } catch {
    return {};
  }
}

/** Downscales a data URL to a tiny placeholder that is cheap to replicate. */
function makeThumbnail(dataUrl: string, width = 48): Promise<{ thumbnail: string; width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, width / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve({ thumbnail: "", width: img.width, height: img.height });
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve({
        thumbnail: canvas.toDataURL("image/jpeg", 0.4),
        width: img.width,
        height: img.height,
      });
    };
    img.onerror = () => resolve({ thumbnail: "", width: 0, height: 0 });
    img.src = dataUrl;
  });
}

interface HuntData {
  difficulties: HuntDifficulty[];
  index: number;
  startedAt: Record<string, number>;
  shots: Record<string, Record<string, Shot>>;
  finished: boolean;
  /**
   * Bumped on every replay and folded into the selection seed, so a second
   * round in the same room is not the first one again.
   */
  round: number;
}

const DEFAULTS: HuntData = {
  difficulties: ["easy", "medium"],
  index: 0,
  startedAt: {},
  shots: {},
  finished: false,
  round: 0,
};

export function SnapHunt() {
  const { state, identity, players, roster, partner, isHost, update } = useRoom();
  const [data, setData] = useSharedState<HuntData>("snapHunt", DEFAULTS);
  const { broadcast } = useRoom();

  /** photoId -> data URL. Local to this device; recovered from sessionStorage. */
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const photosRef = useRef(photos);
  photosRef.current = photos;

  // Recover our own frames after a refresh, then ask whoever is here for theirs.
  useEffect(() => {
    if (!state?.code) return;
    const stored = readStoredPhotos(state.code);
    if (Object.keys(stored).length) setPhotos(stored);
    void broadcast("hunt:request-photos", { playerId: identity.id });
    // Only on first connect to a given room.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.code]);

  useEffect(() => {
    if (!state?.code) return;
    try {
      window.sessionStorage.setItem(photosKey(state.code), JSON.stringify(photos));
    } catch {
      // Full or unavailable — the in-memory copies still render this session.
    }
  }, [photos, state?.code]);

  // Re-send ours so a partner who joined late, or refreshed, catches up.
  useRoomEvent<{ playerId: string }>("hunt:request-photos", (payload) => {
    if (payload.playerId === identity.id) return;
    Object.entries(photosRef.current).forEach(([photoId, dataUrl]) => {
      void broadcast("hunt:photo", { photoId, dataUrl });
    });
  });

  // Idempotent by construction: a photoId always maps to the same pixels, so a
  // replay after a reconnect overwrites with an identical value.
  useRoomEvent<{ photoId: string; dataUrl: string }>("hunt:photo", (payload) => {
    if (!payload?.photoId || !payload.dataUrl) return;
    setPhotos((prev) =>
      prev[payload.photoId] === payload.dataUrl
        ? prev
        : { ...prev, [payload.photoId]: payload.dataUrl },
    );
  });

  /** A spread of hunt types, filtered to the chosen difficulty. */
  const prompts = useMemo(() => {
    const pool = huntsFor([], data.difficulties);
    return pickBalanced(
      pool.length ? pool : HUNT_PROMPTS,
      ROUNDS,
      `${state?.seed ?? "seed"}:${data.round ?? 0}`,
      (p) => p.kind,
    );
  }, [data.difficulties, state?.seed, data.round]);
  const prompt = prompts[Math.min(data.index, prompts.length - 1)];
  const startedAt = prompt ? data.startedAt[prompt.id] : undefined;
  const deadline = startedAt ? startedAt + prompt.seconds * 1000 : null;

  const shots = data.shots[prompt?.id ?? ""] ?? {};
  const myShot = shots[identity.id];
  const everyoneIn = players.length > 1 ? players.every((p) => shots[p.id]) : Boolean(myShot);
  const expired = deadline !== null && Date.now() > deadline;
  const roundOver = everyoneIn || expired;

  useEffect(() => {
    if (!prompt || data.finished || startedAt || !isHost) return;
    void setData((c) => ({ ...c, startedAt: { ...c.startedAt, [prompt.id]: Date.now() } }));
  }, [prompt, startedAt, data.finished, isHost, setData]);

  useRecordCompletion("snap-hunt", data.finished, `${state?.seed ?? "session"}:${data.round ?? 0}`);

  const scores = useMemo(() => {
    const totals: Record<string, number> = {};
    players.forEach((p) => (totals[p.id] = 0));
    prompts.forEach((p) => {
      const row = data.shots[p.id] ?? {};
      Object.entries(row).forEach(([playerId, shot]) => {
        const speed = Math.round((shot.msLeft / (p.seconds * 1000)) * 5);
        totals[playerId] = (totals[playerId] ?? 0) + 10 + Math.max(0, speed);
      });
    });
    return totals;
  }, [data.shots, players, prompts]);

  const submit = useCallback(
    async (dataUrl: string) => {
      if (!prompt || myShot) return;
      const msLeft = deadline ? Math.max(0, deadline - Date.now()) : 0;
      const photoId = uid("ph_");
      const { thumbnail, width, height } = await makeThumbnail(dataUrl);

      setPhotos((prev) => ({ ...prev, [photoId]: dataUrl }));
      void broadcast("hunt:photo", { photoId, dataUrl });

      void setData((c) => ({
        ...c,
        shots: {
          ...c.shots,
          [prompt.id]: {
            ...(c.shots[prompt.id] ?? {}),
            [identity.id]: { photoId, thumbnail, msLeft, width, height },
          },
        },
      }));
    },
    [prompt, myShot, deadline, identity.id, setData, broadcast],
  );

  /** The best pixels we have for a shot: the real frame, else its placeholder. */
  const sourceFor = useCallback(
    (shot: Shot | undefined) => (shot ? photos[shot.photoId] ?? shot.thumbnail : ""),
    [photos],
  );

  /**
   * Both players see this button, so both press it. Advancing with an increment
   * meant the two read-modify-write cycles could land two ahead and silently
   * skip a round; writing the target index absolutely makes a second press a
   * no-op while a genuinely later press still advances.
   */
  function next() {
    const target = data.index + 1;
    if (target >= prompts.length) {
      void setData((c) => ({ ...c, finished: true }));
      void update({ status: "finished" });
      return;
    }
    void setData((c) => ({ ...c, index: Math.max(c.index, target) }));
  }

  if (data.finished) {
    const rows = roster.map((p) => ({
      id: p.id,
      name: p.id === identity.id ? "You" : p.name,
      emoji: p.emoji,
      score: scores[p.id] ?? 0,
      detail: `${prompts.filter((pr) => data.shots[pr.id]?.[p.id]).length}/${prompts.length} found`,
    }));
    // Only offer to keep a photo we actually hold the pixels for — a thumbnail
    // is not worth saving to a scrapbook.
    const hasShot = prompts.some(
      (pr) => photos[data.shots[pr.id]?.[identity.id]?.photoId ?? ""],
    );

    return (
      <GameShell title="Snap Hunt" step={prompts.length} totalSteps={prompts.length}>
        <div className="mx-auto max-w-3xl space-y-6">
          <ScoreBoard rows={rows} title="Final score" />

          <div className="space-y-5">
            {prompts.map((p) => {
              const row = data.shots[p.id] ?? {};
              if (!Object.keys(row).length) return null;
              return (
                <div key={p.id} className="rounded-3xl ring-1 ring-inset ring-line bg-surface p-5 shadow-sm">
                  <p className="mb-3 text-[13.5px] font-bold text-ink">{p.prompt}</p>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(row).map(([playerId, shot]) => (
                      <figure key={playerId}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={sourceFor(shot)}
                          alt={`${state?.players[playerId]?.name ?? "Player"}: ${p.prompt}`}
                          className="aspect-[4/3] w-full rounded-[20px] ring-1 ring-inset ring-line object-cover"
                        />
                        <figcaption className="mt-2 text-[12.5px] text-ink-muted">
                          {playerId === identity.id ? "You" : state?.players[playerId]?.name}
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <MemoryMoment
            onSave={
              hasShot
                ? () => {
                    const first = prompts.find(
                      (p) => photos[data.shots[p.id]?.[identity.id]?.photoId ?? ""],
                    )!;
                    addScrapbookItem({
                      kind: "photo",
                      dataUrl: photos[data.shots[first.id][identity.id].photoId],
                      title: first.prompt,
                      caption: "Snap Hunt",
                      date: new Date().toISOString().slice(0, 10),
                    });
                  }
                : undefined
            }
            saveLabel="Keep a photo"
            savedLabel="Saved to your scrapbook"
            onAgain={() => {
              void setData((c) => ({ ...DEFAULTS, round: (c.round ?? 0) + 1 }));
              void update({ status: "active" });
            }}
            againLabel="New hunt"
          />
        </div>
      </GameShell>
    );
  }

  if (!prompt) return null;

  return (
    <GameShell
      title="Snap Hunt"
      step={data.index + 1}
      totalSteps={prompts.length}
      actions={
        deadline && !roundOver ? (
          <CountdownRing endsAt={deadline} totalMs={prompt.seconds * 1000} size={44} />
        ) : null
      }
    >
      <div className="mx-auto max-w-xl">
        <div className="mb-6 rounded-4xl ring-1 ring-inset ring-line bg-surface p-7 text-center shadow-sm">
          <p className="t-eyebrow">
            {HUNT_KINDS.find((k) => k.id === prompt.kind)?.label ?? "Hunt"} · round {data.index + 1}{" "}
            of {prompts.length}
          </p>
          <h2 className="t-h2 mt-3 text-ink">{prompt.prompt}</h2>
          <p className="mt-3 text-[13.5px] text-ink-muted">
            {prompt.seconds} seconds. Go and actually find it.
          </p>
        </div>

        {!myShot && !expired && <PhotoInput onCapture={submit} label="Snap it" />}

        {myShot && !roundOver && (
          <div className="space-y-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={sourceFor(myShot)}
              alt="Your submission"
              className="aspect-[4/3] w-full rounded-3xl ring-1 ring-inset ring-line object-cover"
            />
            <WaitingForPartner
              label="submitted"
              detail={`Waiting for ${partner?.name ?? "them"} to find theirs.`}
            />
          </div>
        )}

        {expired && !myShot && (
          <div className="rounded-3xl ring-1 ring-inset ring-line bg-surface p-7 text-center shadow-sm">
            <p className="text-[15px] font-bold text-ink">Time&rsquo;s up</p>
            <p className="mt-2 text-[13.5px] text-ink-muted">No photo this round.</p>
          </div>
        )}

        {roundOver && (
          <div className="mt-6 animate-fade-up space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {roster.map((p) => {
                const shot = shots[p.id];
                return (
                  <figure key={p.id}>
                    {shot ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={sourceFor(shot)}
                        alt={`${p.name}'s photo`}
                        className="aspect-[4/3] w-full rounded-[20px] ring-1 ring-inset ring-line object-cover"
                      />
                    ) : (
                      <div className="grid aspect-[4/3] w-full place-items-center rounded-[20px] border-[1.5px] border-dashed border-line-strong text-[12.5px] text-ink-faint">
                        No photo
                      </div>
                    )}
                    <figcaption className="mt-2 flex items-center gap-1.5 text-[12.5px] text-ink-muted">
                      <span>{p.emoji}</span>
                      {p.id === identity.id ? "You" : p.name}
                    </figcaption>
                  </figure>
                );
              })}
            </div>
            <Button block size="lg" onClick={next}>
              {data.index + 1 >= prompts.length ? "See the score" : "Next hunt"}
            </Button>
          </div>
        )}

        <div className="mt-9 flex flex-col items-center gap-3">
          <p className="t-eyebrow">Hunt difficulty</p>
          <div className="flex rounded-pill bg-surface-sunken p-1.5">
            {HUNT_DIFFICULTIES.map((level) => {
              const on = data.difficulties.includes(level.id);
              return (
                <button
                  key={level.id}
                  type="button"
                  disabled={!isHost || data.index > 0}
                  title={level.blurb}
                  onClick={() =>
                    void setData((c) => {
                      const next = c.difficulties.includes(level.id)
                        ? c.difficulties.filter((d) => d !== level.id)
                        : [...c.difficulties, level.id];
                      return { ...c, difficulties: next.length ? next : [level.id] };
                    })
                  }
                  className={cn(
                    "rounded-pill px-4 py-2 text-[12.5px] font-bold transition-all duration-300 ease-out",
                    on ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink",
                    (!isHost || data.index > 0) && "cursor-default",
                  )}
                >
                  {level.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-7 flex justify-center gap-2">
          {players.map((p) => (
            <Pill key={p.id} tone={shots[p.id] ? "good" : "neutral"}>
              {p.emoji} {scores[p.id] ?? 0}
            </Pill>
          ))}
        </div>
      </div>
    </GameShell>
  );
}
