"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameShell } from "@/components/games/game-shell";
import { Button, IconButton } from "@/components/ui/button";
import { Pill } from "@/components/ui/badge";
import { Check, TextField } from "@/components/ui/field";
import { IconClose, IconRefresh } from "@/components/ui/icons";
import { PhotoStrip } from "@/components/photo/photo-strip";
import { useRoom, useRoomEvent, useSharedState } from "@/components/room/room-provider";
import { fileToDataUrl, useCamera } from "@/lib/media/use-camera";
import {
  STICKER_CHOICES,
  STRIP_FILTERS,
  STRIP_FRAMES,
  composeStrip,
  type StripSpec,
  type StripSticker,
} from "@/lib/media/photo-strip";
import { addScrapbookItem, saveStrip } from "@/lib/store";
import { useRecordCompletion } from "@/lib/store/use-completion";
import { capturePointer, clamp, formatDate, uid } from "@/lib/utils";
import { describeOutcome, exportImage } from "@/lib/media/export-image";
import { cn } from "@/lib/utils";

type Phase = "setup" | "shooting" | "editing";

interface BoothData {
  phase: Phase;
  totalRounds: number;
  round: number;
  captureAt: number | null;
  /** Who has captured which round — the pixels travel over broadcast, not state. */
  taken: Record<string, string[]>;
  frameId: string;
  filterId: string;
  caption: string;
  showDate: boolean;
  stickers: StripSticker[];
}

const DEFAULTS: BoothData = {
  phase: "setup",
  totalRounds: 4,
  round: 0,
  captureAt: null,
  taken: {},
  frameId: "classic",
  filterId: "none",
  caption: "",
  showDate: true,
  stickers: [],
};

const COUNTDOWN_MS = 3600;
const PREVIEW_INTERVAL_MS = 700;

/**
 * Photos deliberately never enter the replicated room document — four
 * full-size frames per person would bloat every state write. They travel over
 * the event channel instead, and are mirrored into sessionStorage so a refresh
 * mid-session doesn't lose the strip.
 */
function shotsKey(code: string) {
  return `together:booth:${code}`;
}

function readStoredShots(code: string): Record<number, Record<string, string>> {
  try {
    return JSON.parse(window.sessionStorage.getItem(shotsKey(code)) ?? "{}");
  } catch {
    return {};
  }
}

export function Photobooth() {
  const { state, identity, players, roster, partner, isHost } = useRoom();
  const [data, setData] = useSharedState<BoothData>("booth", DEFAULTS);
  const camera = useCamera();

  /** shots[round][playerId] = data URL. Held locally; photos never hit storage. */
  const [shots, setShots] = useState<Record<number, Record<string, string>>>({});
  const [partnerFrame, setPartnerFrame] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [composed, setComposed] = useState<string | null>(null);
  const [savedTo, setSavedTo] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [exportNote, setExportNote] = useState<string | null>(null);
  const [draggingSticker, setDraggingSticker] = useState<string | null>(null);
  const capturedRounds = useRef<Set<number>>(new Set());
  const shotsRef = useRef(shots);
  shotsRef.current = shots;
  const stripBoxRef = useRef<HTMLDivElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  const { broadcast } = useRoom();

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, []);

  // --- peer video: low-rate frame relay -----------------------------------

  useEffect(() => {
    if (camera.status !== "ready" || !partner) return;
    const t = setInterval(() => {
      const frame = camera.capture({ width: 220, quality: 0.45 });
      if (frame) void broadcast("booth:frame", { playerId: identity.id, frame });
    }, PREVIEW_INTERVAL_MS);
    return () => clearInterval(t);
  }, [camera.status, camera, partner, broadcast, identity.id]);

  useRoomEvent<{ playerId: string; frame: string }>("booth:frame", (payload) => {
    if (payload.playerId === identity.id) return;
    setPartnerFrame(payload.frame);
  });

  // Recover our own strip after a refresh, and ask whoever is here for theirs.
  useEffect(() => {
    if (!state?.code) return;
    const stored = readStoredShots(state.code);
    if (Object.keys(stored).length) setShots(stored);
    void broadcast("booth:request-shots", { playerId: identity.id });
    // Only on first connect to a given room.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.code]);

  useEffect(() => {
    if (!state?.code) return;
    try {
      window.sessionStorage.setItem(shotsKey(state.code), JSON.stringify(shots));
    } catch {
      // Session storage is full or unavailable — the in-memory strip still works.
    }
  }, [shots, state?.code]);

  // Re-send our frames so a partner who joined late (or refreshed) catches up.
  useRoomEvent<{ playerId: string }>("booth:request-shots", (payload) => {
    if (payload.playerId === identity.id) return;
    Object.entries(shotsRef.current).forEach(([round, byPlayer]) => {
      const mine = byPlayer[identity.id];
      if (mine) {
        void broadcast("booth:shot", { round: Number(round), playerId: identity.id, dataUrl: mine });
      }
    });
  });

  useRoomEvent<{ round: number; playerId: string; dataUrl: string }>("booth:shot", (payload) => {
    setShots((prev) => ({
      ...prev,
      [payload.round]: { ...(prev[payload.round] ?? {}), [payload.playerId]: payload.dataUrl },
    }));
  });

  // --- capture -------------------------------------------------------------

  const captureNow = useCallback(
    (round: number) => {
      if (capturedRounds.current.has(round)) return;
      capturedRounds.current.add(round);
      const shot = camera.capture({ width: 1000, quality: 0.86 });
      setFlash(true);
      setTimeout(() => setFlash(false), 520);
      if (!shot) return;
      setShots((prev) => ({
        ...prev,
        [round]: { ...(prev[round] ?? {}), [identity.id]: shot },
      }));
      void broadcast("booth:shot", { round, playerId: identity.id, dataUrl: shot });
      void setData((c) => ({
        ...c,
        taken: {
          ...c.taken,
          [String(round)]: Array.from(new Set([...(c.taken[String(round)] ?? []), identity.id])),
        },
      }));
    },
    [camera, identity.id, broadcast, setData],
  );

  useEffect(() => {
    if (data.phase !== "shooting" || data.captureAt === null) return;
    const delay = data.captureAt - Date.now();
    if (delay <= 0) {
      captureNow(data.round);
      return;
    }
    const t = setTimeout(() => captureNow(data.round), delay);
    return () => clearTimeout(t);
  }, [data.phase, data.captureAt, data.round, captureNow]);

  // Host advances the sequence once everyone present has taken this round.
  useEffect(() => {
    if (data.phase !== "shooting" || !isHost || data.captureAt === null) return;
    if (Date.now() < data.captureAt) return;
    const takenThisRound = data.taken[String(data.round)] ?? [];
    const everyone = players.every((p) => takenThisRound.includes(p.id));
    if (!everyone) return;

    const t = setTimeout(() => {
      if (data.round + 1 >= data.totalRounds) {
        void setData((c) => ({ ...c, phase: "editing", captureAt: null }));
      } else {
        void setData((c) => ({
          ...c,
          round: c.round + 1,
          captureAt: Date.now() + COUNTDOWN_MS,
        }));
      }
    }, 1400);
    return () => clearTimeout(t);
  }, [data, isHost, players, setData]);

  useRecordCompletion("photobooth", data.phase === "editing", `${state?.seed ?? "s"}:${data.totalRounds}`);

  function startShooting() {
    capturedRounds.current = new Set();
    setShots({});
    void setData((c) => ({
      ...c,
      phase: "shooting",
      round: 0,
      taken: {},
      captureAt: Date.now() + COUNTDOWN_MS,
    }));
  }

  /**
   * Camera-free path. Without this, anyone who has blocked camera access — or is
   * on a device with no camera — hits a wall at the first screen.
   */
  async function useUploadedPhotos(files: File[]) {
    const chosen = files.slice(0, data.totalRounds);
    if (!chosen.length) return;
    const urls = await Promise.all(chosen.map((file) => fileToDataUrl(file, 1000)));
    const next: Record<number, Record<string, string>> = {};
    urls.forEach((url, i) => {
      next[i] = { [identity.id]: url };
    });
    capturedRounds.current = new Set(urls.map((_, i) => i));
    setShots(next);
    urls.forEach((url, round) =>
      void broadcast("booth:shot", { round, playerId: identity.id, dataUrl: url }),
    );
    void setData((c) => ({ ...c, phase: "editing", captureAt: null }));
  }

  function retakeAll() {
    capturedRounds.current = new Set();
    setShots({});
    if (state?.code) {
      try {
        window.sessionStorage.removeItem(shotsKey(state.code));
      } catch {
        /* ignore */
      }
    }
    setComposed(null);
    setSavedTo(null);
    void setData((c) => ({ ...c, phase: "setup", round: 0, taken: {}, captureAt: null }));
  }

  // --- strip spec ----------------------------------------------------------

  const rounds = useMemo(() => {
    const out: string[][] = [];
    for (let i = 0; i < data.totalRounds; i++) {
      const row = shots[i] ?? {};
      const ordered = [identity.id, ...roster.map((p) => p.id).filter((id) => id !== identity.id)]
        .map((id) => row[id])
        .filter(Boolean) as string[];
      if (ordered.length) out.push(ordered);
    }
    return out;
  }, [shots, data.totalRounds, identity.id, roster]);

  const previewSpec: StripSpec = {
    rounds,
    frameId: data.frameId,
    filterId: data.filterId,
    caption: data.caption,
    showDate: data.showDate,
    date: formatDate(new Date()),
    stickers: [],
  };

  const finalSpec: StripSpec = { ...previewSpec, stickers: data.stickers };

  /**
   * Full 2400-wide strip, saved by whichever route this browser really supports.
   * The message afterwards says what actually happened — on iOS that is usually
   * the share sheet or a press-and-hold, not a download.
   */
  async function download() {
    setDownloading(true);
    setExportNote(null);
    try {
      const url = await composeStrip(finalSpec, 2400);
      const outcome = await exportImage(url, `together-photostrip-${Date.now()}.png`, {
        title: "Our photo strip",
      });
      setExportNote(describeOutcome(outcome, "strip"));
    } catch {
      setExportNote("That didn't save. Try again in a moment.");
    } finally {
      setDownloading(false);
    }
  }

  async function keepIt(destination: "scrapbook" | "strips") {
    const url = await composeStrip(finalSpec, 1400);
    saveStrip({
      dataUrl: url,
      frame: data.frameId,
      filter: data.filterId,
      caption: data.caption,
      roomCode: state?.code,
    });
    if (destination === "scrapbook") {
      addScrapbookItem({
        kind: "strip",
        dataUrl: url,
        title: data.caption || "Photobooth",
        caption: partner ? `With ${partner.name}` : "Solo strip",
        date: new Date().toISOString().slice(0, 10),
      });
    }
    setSavedTo(destination);
  }

  // --- sticker dragging ----------------------------------------------------

  function moveSticker(id: string, clientX: number, clientY: number) {
    const box = stripBoxRef.current;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    const x = clamp((clientX - rect.left) / rect.width, 0.03, 0.97);
    const y = clamp((clientY - rect.top) / rect.height, 0.03, 0.97);
    void setData((c) => ({
      ...c,
      stickers: c.stickers.map((s) => (s.id === id ? { ...s, x, y } : s)),
    }));
  }

  // --- setup ---------------------------------------------------------------

  if (data.phase === "setup") {
    return (
      <GameShell title="Photobooth" hint="Four shots, one strip. Nothing leaves your device.">
        <div className="mx-auto max-w-3xl">
          <div className="grid gap-5 sm:grid-cols-2">
            <BoothPane
              label="You"
              emoji={identity.emoji}
              videoRef={camera.videoRef}
              mirrored={camera.facingMode === "user"}
              live={camera.status === "ready"}
              fallback={
                camera.status === "requesting"
                  ? "Asking for the camera…"
                  : camera.error ?? "Camera is off"
              }
            />
            <BoothPane
              label={partner ? partner.name : "Them"}
              emoji={partner?.emoji ?? "·"}
              image={partnerFrame}
              live={Boolean(partnerFrame)}
              fallback={partner ? "Waiting for their camera…" : "Nobody has joined yet"}
            />
          </div>

          <div className="mt-6 rounded-[32px] bg-surface p-7 shadow-sm ring-1 ring-inset ring-line sm:p-8">
            <div className="flex flex-wrap items-center gap-2.5">
              {camera.status === "ready" ? (
                <>
                  {camera.hasMultipleCameras && (
                    <Button variant="secondary" onClick={camera.switchCamera}>
                      Flip camera
                    </Button>
                  )}
                  <Button variant="ghost" onClick={camera.stop}>
                    Turn camera off
                  </Button>
                </>
              ) : (
                <Button size="lg" onClick={camera.start}>
                  Turn on my camera
                </Button>
              )}

              <div className="ml-auto flex items-center gap-3">
                <span className="t-eyebrow">Shots</span>
                <div className="flex rounded-pill bg-surface-sunken p-1">
                  {[3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      disabled={!isHost}
                      onClick={() => void setData((c) => ({ ...c, totalRounds: n }))}
                      className={cn(
                        "h-8 w-9 rounded-pill text-[13px] font-bold transition-all duration-300 ease-out",
                        data.totalRounds === n
                          ? "bg-surface text-ink shadow-sm"
                          : "text-ink-muted hover:text-ink",
                        !isHost && "cursor-default",
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {camera.error && camera.status !== "ready" && (
              <p className="mt-5 rounded-sm bg-butter-tint px-4 py-3.5 text-[13.5px] leading-relaxed text-butter-deep">
                {camera.error}
              </p>
            )}

            <Button
              block
              size="xl"
              className="mt-6"
              disabled={camera.status !== "ready" || !isHost}
              onClick={startShooting}
            >
              {camera.status !== "ready"
                ? "Turn your camera on first"
                : !isHost
                  ? "They'll start the countdown"
                  : `Start — ${data.totalRounds} shots`}
            </Button>

            <Button
              block
              size="lg"
              variant="ghost"
              className="mt-2.5"
              onClick={() => uploadRef.current?.click()}
            >
              No camera? Build a strip from photos
            </Button>
            <input
              ref={uploadRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={async (e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = "";
                await useUploadedPhotos(files);
              }}
            />
            {!partner && (
              <p className="t-caption mt-4 text-center">
                Going solo is fine — the strip just won&rsquo;t be split.
              </p>
            )}
          </div>
        </div>
      </GameShell>
    );
  }

  // --- shooting ------------------------------------------------------------

  if (data.phase === "shooting") {
    const remaining = data.captureAt ? Math.max(0, data.captureAt - now) : 0;
    const counting = remaining > 0;
    const seconds = Math.ceil(remaining / 1000);

    return (
      <GameShell title="Photobooth" step={data.round + 1} totalSteps={data.totalRounds}>
        {flash && (
          <div
            className="pointer-events-none fixed inset-0 z-50 animate-flash bg-white"
            aria-hidden="true"
          />
        )}
        <div className="mx-auto max-w-3xl">
          <div className="relative grid gap-5 sm:grid-cols-2">
            <BoothPane
              label="You"
              emoji={identity.emoji}
              videoRef={camera.videoRef}
              mirrored={camera.facingMode === "user"}
              live={camera.status === "ready"}
              fallback="Camera is off"
            />
            <BoothPane
              label={partner ? partner.name : "Them"}
              emoji={partner?.emoji ?? "·"}
              image={partnerFrame}
              live={Boolean(partnerFrame)}
              fallback={partner ? "Waiting for their camera…" : "Solo strip"}
            />

            {counting && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center">
                <span className="absolute inset-0 rounded-[28px] bg-black/25 backdrop-blur-[2px]" />
                <span
                  key={seconds}
                  className="a-pop t-num relative text-[120px] font-extrabold leading-[0.85] tracking-[-0.06em] text-white drop-shadow-[0_6px_30px_rgba(0,0,0,0.45)] sm:text-[164px]"
                >
                  {seconds}
                </span>
              </div>
            )}
          </div>

          <p className="mt-8 text-center">
            <span className="t-serif text-[22px] text-ink sm:text-[26px]">
              {counting
                ? `Shot ${data.round + 1} of ${data.totalRounds} — get ready`
                : "Nice. Next one coming up…"}
            </span>
          </p>

          {/* the strip filling up, one frame at a time */}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {Array.from({ length: data.totalRounds }).map((_, i) => {
              const row = shots[i] ?? {};
              const mine = row[identity.id];
              return (
                <div
                  key={i}
                  className={cn(
                    "h-[76px] w-[96px] overflow-hidden rounded-[14px] transition-all duration-500 ease-out",
                    mine
                      ? "a-scale bg-surface p-1 shadow-sm ring-1 ring-inset ring-line"
                      : "border-[1.5px] border-dashed border-line-strong",
                    i === data.round && !mine && "border-ink/40",
                  )}
                >
                  {mine ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={mine}
                      alt={`Shot ${i + 1}`}
                      className="h-full w-full rounded-[10px] object-cover"
                    />
                  ) : (
                    <div className="t-num grid h-full place-items-center text-[13px] font-bold text-ink-faint">
                      {i + 1}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {isHost && (
            <div className="mt-9 flex justify-center">
              <Button variant="ghost" size="sm" onClick={retakeAll}>
                Start over
              </Button>
            </div>
          )}
        </div>
      </GameShell>
    );
  }

  // --- editing -------------------------------------------------------------

  if (rounds.length === 0) {
    return (
      <GameShell title="Photobooth">
        <div className="mx-auto max-w-md rounded-4xl ring-1 ring-inset ring-line bg-surface p-8 text-center shadow-sm">
          <h2 className="t-h3 text-ink">The photos aren&rsquo;t here</h2>
          <p className="mx-auto mt-3 max-w-xs text-[14px] leading-relaxed text-ink-muted">
            Photos stay on the device that took them and never touch the room document. This browser
            doesn&rsquo;t have them — most likely the tab was closed after the shoot.
          </p>
          <Button size="lg" className="mt-7" onClick={retakeAll}>
            Shoot again
          </Button>
        </div>
      </GameShell>
    );
  }

  return (
    <GameShell title="Photobooth" width="wide" hint="Style it, then take it with you.">
      <div className="grid gap-7 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <div className="lg:order-2 lg:sticky lg:top-36 lg:self-start">
          {/* Container queries keep the stickers proportional to the strip at
              any width — on a phone the strip is deliberately smaller so the
              controls beneath it stay reachable. */}
          <div
            ref={stripBoxRef}
            className="relative mx-auto max-w-[220px] sm:max-w-[300px] lg:max-w-[330px]"
            style={{ containerType: "inline-size" }}
          >
            <span
              className="absolute -inset-8 -z-10 rounded-[50%] blur-3xl"
              style={{
                background:
                  "radial-gradient(circle, var(--blush-tint), var(--sky-tint) 55%, transparent 74%)",
              }}
              aria-hidden="true"
            />
            <PhotoStrip spec={previewSpec} width={900} onComposed={setComposed} />
            {data.stickers.map((sticker) => (
              <button
                key={sticker.id}
                type="button"
                onPointerDown={(e) => {
                  capturePointer(e.currentTarget, e.pointerId);
                  setDraggingSticker(sticker.id);
                }}
                onPointerMove={(e) => {
                  if (draggingSticker === sticker.id) moveSticker(sticker.id, e.clientX, e.clientY);
                }}
                onPointerUp={() => setDraggingSticker(null)}
                onDoubleClick={() =>
                  void setData((c) => ({
                    ...c,
                    stickers: c.stickers.filter((s) => s.id !== sticker.id),
                  }))
                }
                title="Drag to move · double-click to remove"
                className="absolute touch-none select-none leading-none"
                style={{
                  left: `${sticker.x * 100}%`,
                  top: `${sticker.y * 100}%`,
                  transform: `translate(-50%,-50%) rotate(${sticker.rotation}deg)`,
                  fontSize: `${sticker.size * 100}cqw`,
                  cursor: draggingSticker === sticker.id ? "grabbing" : "grab",
                }}
              >
                {sticker.emoji}
              </button>
            ))}
          </div>

          <div className="mx-auto mt-8 flex max-w-[330px] flex-col gap-2.5">
            <Button size="xl" onClick={download} disabled={!composed || downloading}>
              {downloading ? "Rendering…" : "Save the strip"}
            </Button>
            {exportNote && (
              <p role="status" className="t-body-sm text-center">
                {exportNote}
              </p>
            )}
            <div className="flex gap-2.5">
              <Button block variant="secondary" onClick={() => keepIt("scrapbook")}>
                {savedTo === "scrapbook" ? "In your scrapbook" : "Add to scrapbook"}
              </Button>
              <IconButton label="Retake everything" onClick={retakeAll} className="h-11 w-11">
                <IconRefresh width={17} height={17} />
              </IconButton>
            </div>
          </div>
        </div>

        <div className="space-y-4 lg:order-1">
          <Section title="Frame">
            <div className="flex flex-wrap gap-2">
              {STRIP_FRAMES.map((frame) => (
                <button
                  key={frame.id}
                  type="button"
                  onClick={() => void setData((c) => ({ ...c, frameId: frame.id }))}
                  className={cn(
                    "group/frame flex flex-col items-center gap-2 rounded-[18px] p-2.5 transition-all duration-300 ease-out",
                    data.frameId === frame.id
                      ? "bg-surface-sunken"
                      : "hover:bg-surface-muted",
                  )}
                >
                  <span
                    className={cn(
                      "block h-11 w-8 rounded-[7px] ring-1 ring-inset transition-all duration-300",
                      data.frameId === frame.id
                        ? "ring-2 ring-ink"
                        : "ring-line-strong group-hover/frame:-translate-y-[2px]",
                    )}
                    style={{
                      background:
                        typeof frame.background === "string"
                          ? frame.background
                          : `linear-gradient(150deg, ${frame.background.from}, ${frame.background.to})`,
                    }}
                  />
                  <span
                    className={cn(
                      "text-[11.5px] font-bold tracking-[-0.01em]",
                      data.frameId === frame.id ? "text-ink" : "text-ink-muted",
                    )}
                  >
                    {frame.label}
                  </span>
                </button>
              ))}
            </div>
          </Section>

          <Section title="Filter">
            <div className="flex flex-wrap gap-2">
              {STRIP_FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => void setData((c) => ({ ...c, filterId: filter.id }))}
                  className={cn(
                    "rounded-pill px-4 py-2.5 text-[13px] font-bold tracking-[-0.01em] transition-all duration-250 ease-out",
                    data.filterId === filter.id
                      ? "bg-ink text-ink-inverse shadow-sm"
                      : "bg-surface-sunken text-ink-muted hover:bg-surface-muted hover:text-ink",
                  )}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </Section>

          <Section title="Caption & date">
            <TextField
              value={data.caption}
              maxLength={28}
              onChange={(e) => void setData((c) => ({ ...c, caption: e.target.value }))}
              placeholder="Say something (optional)"
              aria-label="Strip caption"
            />
            <Check
              className="mt-4"
              checked={data.showDate}
              onChange={(e) => void setData((c) => ({ ...c, showDate: e.target.checked }))}
              label={<>Print today&rsquo;s date ({formatDate(new Date())})</>}
            />
          </Section>

          <Section title="Stickers">
            <div className="flex flex-wrap gap-1.5">
              {STICKER_CHOICES.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() =>
                    void setData((c) => ({
                      ...c,
                      stickers: [
                        ...c.stickers,
                        {
                          id: uid("sticker_"),
                          emoji,
                          x: 0.24 + Math.random() * 0.52,
                          y: 0.16 + Math.random() * 0.62,
                          size: 0.11,
                          rotation: Math.round(Math.random() * 30 - 15),
                        },
                      ],
                    }))
                  }
                  className="grid h-12 w-12 place-items-center rounded-[16px] bg-surface-sunken text-[21px] transition-all duration-250 ease-spring hover:-translate-y-[2px] hover:scale-110 hover:bg-surface-muted"
                >
                  {emoji}
                </button>
              ))}
            </div>
            {data.stickers.length > 0 && (
              <div className="mt-3 flex items-center gap-3">
                <p className="t-caption">Drag on the strip to move · double-click to remove</p>
                <button
                  type="button"
                  onClick={() => void setData((c) => ({ ...c, stickers: [] }))}
                  className="ml-auto flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-muted transition-colors hover:text-ink"
                >
                  <IconClose width={12} height={12} /> Clear
                </button>
              </div>
            )}
          </Section>

          <div className="flex flex-wrap gap-2">
            <Pill tone="good">{rounds.length} shots in the strip</Pill>
            {partner && <Pill>Split with {partner.name}</Pill>}
            <Pill tone="info">Composed in your browser</Pill>
          </div>
        </div>
      </div>
    </GameShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[28px] bg-surface p-6 shadow-sm ring-1 ring-inset ring-line sm:p-7">
      <p className="t-eyebrow mb-4">{title}</p>
      {children}
    </div>
  );
}

function BoothPane({
  label,
  emoji,
  videoRef,
  image,
  live,
  fallback,
  mirrored,
}: {
  label: string;
  emoji: string;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  image?: string | null;
  live: boolean;
  fallback: string;
  mirrored?: boolean;
}) {
  return (
    <div className="group/pane relative overflow-hidden rounded-[28px] bg-[#17151a] shadow-card ring-1 ring-inset ring-line">
      {videoRef ? (
        <video
          ref={videoRef}
          playsInline
          muted
          className={cn(
            "aspect-[4/3] w-full object-cover transition-opacity duration-500",
            live ? "opacity-100" : "opacity-0",
            mirrored && "-scale-x-100",
          )}
        />
      ) : image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt={`${label}'s camera`} className="aspect-[4/3] w-full object-cover" />
      ) : (
        <div className="aspect-[4/3] w-full" />
      )}

      {/* soft vignette so the label always reads */}
      <span
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.34) 0%, transparent 26%, transparent 74%, rgba(0,0,0,0.28) 100%)",
        }}
        aria-hidden="true"
      />

      {!live && (
        <div className="absolute inset-0 grid place-items-center p-6 text-center">
          <div>
            <span
              className="mx-auto mb-3 block h-9 w-9 rounded-pill ring-[1.5px] ring-inset ring-white/25"
              aria-hidden="true"
            />
            <p className="mx-auto max-w-[24ch] text-[13px] leading-relaxed text-white/65">
              {fallback}
            </p>
          </div>
        </div>
      )}

      <span className="absolute left-3.5 top-3.5 flex items-center gap-2 rounded-pill bg-black/35 px-3 py-1.5 text-[12px] font-bold tracking-[-0.01em] text-white backdrop-blur-md">
        <span className="text-[13px]">{emoji}</span>
        {label}
        {live && <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-[#6ee7a8]" />}
      </span>
    </div>
  );
}
