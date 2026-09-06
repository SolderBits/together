"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameShell, WaitingForPartner } from "@/components/games/game-shell";
import { CountdownOverlay, CountdownRing } from "@/components/games/countdown";
import { CanvasEditor, StrokePreview, type CanvasEditorHandle } from "@/components/drawing/canvas-editor";
import { CanvasToolbar } from "@/components/drawing/canvas-toolbar";
import { ArtDrawTogether } from "@/components/art/scenes";
import type { Stroke, StrokeMode } from "@/components/drawing/types";
import { Button } from "@/components/ui/button";
import { MemoryMoment } from "@/components/games/memory-moment";
import { Pill } from "@/components/ui/badge";
import { useRoom, useRoomEvent, useSharedState } from "@/components/room/room-provider";
import { DRAW_DURATIONS, DRAW_PROMPTS } from "@/lib/games/content/draw";
import { describeOutcome, exportImage } from "@/lib/media/export-image";
import { composeComparison, strokesToDataUrl } from "@/lib/media/render-strokes";
import { addScrapbookItem, saveMemory } from "@/lib/store";
import { useRecordCompletion } from "@/lib/store/use-completion";
import { hashString, pickDeterministic } from "@/lib/utils";
import { cn } from "@/lib/utils";

type Phase = "brief" | "drawing" | "compare";

interface Submission {
  strokes: Stroke[];
  at: number;
}

interface DrawData {
  phase: Phase;
  round: number;
  durationMs: number;
  startAt: number | null;
  endsAt: number | null;
  submissions: Record<string, Submission>;
}

const DEFAULTS: DrawData = {
  phase: "brief",
  round: 0,
  durationMs: 120_000,
  startAt: null,
  endsAt: null,
  submissions: {},
};

export function DrawTogether() {
  const { state, identity, players, roster, partner, isHost, broadcast } = useRoom();
  const [data, setData] = useSharedState<DrawData>("draw", DEFAULTS);

  const canvasRef = useRef<CanvasEditorHandle>(null);
  const [color, setColor] = useState("#111114");
  const [exportNote, setExportNote] = useState<string | null>(null);
  const [size, setSize] = useState(0.014);
  const [mode, setMode] = useState<StrokeMode>("pen");
  const [strokeCount, setStrokeCount] = useState(0);
  const [partnerStrokes, setPartnerStrokes] = useState<Stroke[]>([]);
  const [submitted, setSubmitted] = useState(false);

  // The prompt is derived from the room seed, so both clients always agree.
  const prompt = useMemo(() => {
    const seed = `${state?.seed ?? "seed"}:${data.round}`;
    return pickDeterministic(DRAW_PROMPTS, 1, seed)[0];
  }, [state?.seed, data.round]);

  // --- live stroke streaming ----------------------------------------------

  useRoomEvent<{ playerId: string; stroke: Stroke }>("draw:stroke", (payload) => {
    if (payload.playerId === identity.id) return;
    setPartnerStrokes((prev) => [...prev, payload.stroke]);
  });

  useRoomEvent<{ playerId: string }>("draw:clear", (payload) => {
    if (payload.playerId === identity.id) return;
    setPartnerStrokes([]);
  });

  useRoomEvent<{ playerId: string }>("draw:undo", (payload) => {
    if (payload.playerId === identity.id) return;
    setPartnerStrokes((prev) => prev.slice(0, -1));
  });

  const handleStrokeEnd = useCallback(
    (stroke: Stroke) => {
      void broadcast("draw:stroke", { playerId: identity.id, stroke });
    },
    [broadcast, identity.id],
  );

  // --- phase transitions ---------------------------------------------------

  function beginRound(durationMs: number) {
    const startAt = Date.now() + 3200;
    void setData({
      ...data,
      phase: "drawing",
      durationMs,
      startAt,
      endsAt: startAt + durationMs,
      submissions: {},
    });
  }

  const submit = useCallback(() => {
    if (submitted) return;
    const strokes = canvasRef.current?.getStrokes() ?? [];
    setSubmitted(true);
    void setData((current) => ({
      ...current,
      submissions: { ...current.submissions, [identity.id]: { strokes, at: Date.now() } },
    }));
  }, [identity.id, setData, submitted]);

  // Auto-submit when the shared timer runs out.
  useEffect(() => {
    if (data.phase !== "drawing" || !data.endsAt) return;
    const remaining = data.endsAt - Date.now();
    if (remaining <= 0) {
      submit();
      return;
    }
    const t = setTimeout(submit, remaining);
    return () => clearTimeout(t);
  }, [data.phase, data.endsAt, submit]);

  // Move to compare once everyone present has handed something in.
  useEffect(() => {
    if (data.phase !== "drawing") return;
    const ids = players.map((p) => p.id);
    const allIn = ids.length > 0 && ids.every((id) => data.submissions[id]);
    if (allIn && isHost) void setData((current) => ({ ...current, phase: "compare" }));
  }, [data.phase, data.submissions, players, isHost, setData]);

  useRecordCompletion("draw-together", data.phase === "compare", String(data.round));

  function nextRound() {
    canvasRef.current?.clear();
    setPartnerStrokes([]);
    setSubmitted(false);
    void setData({
      ...DEFAULTS,
      round: data.round + 1,
      durationMs: data.durationMs,
    });
  }

  // --- rendering -----------------------------------------------------------

  const mySubmission = data.submissions[identity.id];
  const partnerSubmission = partner ? data.submissions[partner.id] : undefined;

  if (data.phase === "brief") {
    return (
      <GameShell title="Draw Together" hint="Same prompt, two canvases, one shared clock.">
        <div className="mx-auto max-w-[640px]">
          {/* the prompt, treated as the headline it is */}
          <div className="a-rise relative overflow-hidden rounded-[36px] p-9 text-center shadow-sm ring-1 ring-inset ring-line sm:p-14"
               style={{ background: "linear-gradient(168deg, var(--sky-tint) -8%, var(--surface) 54%)" }}>
            <span className="grain absolute inset-0" aria-hidden="true" />
            <div className="relative">
              <p className="t-eyebrow">Round {data.round + 1} · your prompt</p>
              <h2 className="t-h1 mt-5 text-balance text-ink">{prompt}</h2>
              <p className="t-body-sm mx-auto mt-5 max-w-[34ch]">
                You both get this one. Neither of you sees the other&rsquo;s canvas until the
                clock stops.
              </p>
              <div className="mx-auto mt-8 w-[168px]">
                <ArtDrawTogether className="a-drift h-auto w-full" />
              </div>
            </div>
          </div>

          {/* how long */}
          <div className="a-rise d-2 mt-6 rounded-[28px] bg-surface p-7 shadow-sm ring-1 ring-inset ring-line sm:p-8">
            <p className="t-eyebrow mb-4 text-center">How long do you get?</p>

            <div className="mx-auto flex max-w-[380px] rounded-pill bg-surface-sunken p-1.5">
              {DRAW_DURATIONS.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  disabled={!isHost}
                  onClick={() => void setData({ ...data, durationMs: option.ms })}
                  className={cn(
                    "flex-1 rounded-pill py-2.5 text-[13.5px] font-bold tracking-[-0.01em] transition-all duration-300 ease-out",
                    data.durationMs === option.ms
                      ? "bg-surface text-ink shadow-sm"
                      : "text-ink-muted hover:text-ink",
                    !isHost && "cursor-default",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {isHost ? (
              <Button block size="xl" className="mt-7" onClick={() => beginRound(data.durationMs)}>
                {partner ? "Start drawing" : "Start drawing solo"}
              </Button>
            ) : (
              <WaitingForPartner
                label="they're setting the clock"
                detail="You'll both get the same countdown."
              />
            )}
          </div>
        </div>
      </GameShell>
    );
  }

  if (data.phase === "drawing") {
    const drawingLocked = submitted || Boolean(mySubmission);
    return (
      <>
        <CountdownOverlay startAt={data.startAt} caption={prompt} />
        <GameShell
          title="Draw Together"
          actions={
            data.endsAt ? (
              <CountdownRing endsAt={data.endsAt} totalMs={data.durationMs} size={44} />
            ) : null
          }
        >
          <div className="mb-7 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-center">
            <span className="t-eyebrow">Your prompt</span>
            <h2 className="t-h3 text-balance text-ink">{prompt}</h2>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
            <div>
              {/* the canvas sits on a mount, like a sheet of paper */}
              <div className="rounded-[32px] bg-surface p-3 shadow-card ring-1 ring-inset ring-line sm:p-4">
                <CanvasEditor
                  ref={canvasRef}
                  color={color}
                  size={size}
                  mode={mode}
                  disabled={drawingLocked}
                  onStrokeEnd={handleStrokeEnd}
                  onChange={setStrokeCount}
                  className="overflow-hidden rounded-[22px] bg-surface ring-1 ring-inset ring-line"
                />
              </div>
              <div className="mt-5 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                <CanvasToolbar
                  color={color}
                  onColor={setColor}
                  size={size}
                  onSize={setSize}
                  mode={mode}
                  onMode={setMode}
                  disabled={drawingLocked}
                  onUndo={() => {
                    canvasRef.current?.undo();
                    void broadcast("draw:undo", { playerId: identity.id });
                  }}
                  onClear={() => {
                    canvasRef.current?.clear();
                    void broadcast("draw:clear", { playerId: identity.id });
                  }}
                />
                <Button
                  size="lg"
                  onClick={submit}
                  disabled={drawingLocked || strokeCount === 0}
                  className="w-full sm:w-auto"
                >
                  {drawingLocked ? "Handed in" : "Finish drawing"}
                </Button>
              </div>
              {drawingLocked && (
                <p className="a-fade mt-4 text-center text-[14px] font-medium text-ink-muted">
                  Handed in. Waiting for them to finish…
                </p>
              )}
            </div>

            <aside className="lg:sticky lg:top-36 lg:self-start">
              <div className="rounded-[28px] bg-surface p-4 shadow-sm ring-1 ring-inset ring-line">
                <p className="mb-3.5 flex items-center justify-between px-1">
                  <span className="t-eyebrow">Their canvas</span>
                  {partner && (
                    <span className="grid h-7 w-7 place-items-center rounded-pill bg-surface-sunken text-[14px]">
                      {partner.emoji}
                    </span>
                  )}
                </p>
                {partner ? (
                  <>
                    <StrokePreview
                      strokes={partnerStrokes}
                      className="overflow-hidden rounded-[18px] ring-1 ring-inset ring-line"
                    />
                    <p className="t-caption mt-3 px-1">
                      {data.submissions[partner.id]
                        ? "They've handed in."
                        : `${partnerStrokes.length} strokes so far`}
                    </p>
                  </>
                ) : (
                  <div className="grid aspect-square place-items-center rounded-[18px] border-[1.5px] border-dashed border-line-strong px-5 text-center">
                    <p className="t-caption">
                      Nobody else here —<br />
                      you&rsquo;re drawing solo.
                    </p>
                  </div>
                )}
              </div>
            </aside>
          </div>
        </GameShell>
      </>
    );
  }

  // --- compare -------------------------------------------------------------

  // Driven by who actually handed something in, so a partner whose heartbeat
  // lapsed while the tab was in the background still appears here.
  const panels = roster
    .map((player) => ({ player, submission: data.submissions[player.id] }))
    .filter((p): p is { player: typeof p.player; submission: Submission } => Boolean(p.submission));

  function downloadOne(label: string, strokes: Stroke[]) {
    void exportImage(strokesToDataUrl(strokes, 1600), `together-${label}.png`, {
      title: "Our drawing",
    }).then((outcome) => setExportNote(describeOutcome(outcome, "drawing")));
  }

  function downloadBoth() {
    const url = composeComparison({
      prompt,
      panels: panels.map((p) => ({
        label: p.player.id === identity.id ? "You" : p.player.name,
        strokes: p.submission.strokes,
      })),
    });
    void exportImage(url, "together-draw.png", { title: "Our drawings" }).then((outcome) =>
      setExportNote(describeOutcome(outcome, "drawing")),
    );
  }

  function keepIt() {
    const dataUrl =
      panels.length > 1
        ? composeComparison({
            prompt,
            panels: panels.map((p) => ({
              label: p.player.id === identity.id ? "You" : p.player.name,
              strokes: p.submission.strokes,
            })),
          })
        : strokesToDataUrl(mySubmission?.strokes ?? [], 1200);

    addScrapbookItem({
      kind: "drawing",
      dataUrl,
      title: prompt,
      caption: `Draw Together · round ${data.round + 1}`,
      date: new Date().toISOString().slice(0, 10),
    });
    saveMemory({
      experienceId: "draw-together",
      title: prompt,
      detail: "Both drawings, side by side.",
      dataUrl,
    });
  }

  return (
    <GameShell title="Draw Together" hint="Time's up. Here's what you both made.">
      <div className="mx-auto max-w-4xl">
        <div className="mb-10 text-center sm:mb-12">
          <p className="t-eyebrow">The prompt was</p>
          <h2 className="t-h1 mt-3 text-balance text-ink">{prompt}</h2>
        </div>

        <div className={cn("grid gap-5", panels.length > 1 ? "sm:grid-cols-2" : "max-w-md mx-auto")}>
          {panels.map(({ player, submission }, i) => (
            <div
              key={player.id}
              className="a-rise rounded-[32px] bg-surface p-4 shadow-card ring-1 ring-inset ring-line sm:p-5"
              style={{ animationDelay: `${i * 140}ms` }}
            >
              <StrokePreview
                strokes={submission.strokes}
                className="overflow-hidden rounded-[22px] ring-1 ring-inset ring-line"
              />
              <div className="mt-4 flex items-center justify-between gap-3 px-1">
                <p className="flex items-center gap-2.5 text-[15px] font-bold tracking-[-0.02em] text-ink">
                  <span className="grid h-8 w-8 place-items-center rounded-pill bg-surface-sunken text-[15px]">
                    {player.emoji}
                  </span>
                  {player.id === identity.id ? "You" : player.name}
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    downloadOne(player.id === identity.id ? "you" : player.name, submission.strokes)
                  }
                >
                  Download
                </Button>
              </div>
            </div>
          ))}
        </div>

        {panels.length === 0 && (
          <WaitingForPartner label="collecting drawings…" />
        )}

        <MemoryMoment
          className="mt-12"
          extra={
            panels.length > 1 ? (
              <Button size="xl" variant="ghost" onClick={downloadBoth}>
                Download both
              </Button>
            ) : null
          }
          onSave={keepIt}
          savedLabel="Saved to your scrapbook"
          onAgain={nextRound}
          againLabel="Another round"
        />

        {exportNote && (
          <p role="status" className="t-body-sm mt-5 text-center">
            {exportNote}
          </p>
        )}

        <div className="mt-8 flex justify-center">
          <Pill tone="neutral">Round {data.round + 1} finished</Pill>
        </div>
      </div>
    </GameShell>
  );
}
