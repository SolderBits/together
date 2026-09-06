"use client";

import { useMemo } from "react";
import { QuizEngine } from "@/components/games/quiz-engine";
import { GameShell } from "@/components/games/game-shell";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/badge";
import { useRoom, useSharedState } from "@/components/room/room-provider";
import {
  DIFFICULTIES,
  LAB_TRACKS,
  labQuestionsFor,
  type Difficulty,
  type LabTrack,
} from "@/lib/games/content/quiz";
import { pickBalanced } from "@/lib/games/content/pick";
import { cn } from "@/lib/utils";

interface LabSetup {
  tracks: LabTrack[];
  difficulties: Difficulty[];
  started: boolean;
  /** Shared so a rematch draws a new set on both screens, not just this one. */
  round: number;
}

const DEFAULTS: LabSetup = {
  tracks: [],
  difficulties: ["easy", "medium"],
  started: false,
  round: 0,
};

export function TheLab() {
  const { state, isHost, isSolo } = useRoom();
  const [setup, setSetup] = useSharedState<LabSetup>("labSetup", DEFAULTS);

  const pool = useMemo(
    () => labQuestionsFor(setup.tracks, setup.difficulties),
    [setup.tracks, setup.difficulties],
  );

  const questions = useMemo(() => {
    const source = pool.length ? pool : labQuestionsFor([], []);
    return pickBalanced(
      source,
      Math.min(8, source.length),
      `${state?.seed ?? "seed"}:${setup.round ?? 0}`,
      (q) => q.track,
    );
  }, [pool, state?.seed, setup.round]);

  function toggleTrack(track: LabTrack) {
    void setSetup((current) => ({
      ...current,
      tracks: current.tracks.includes(track)
        ? current.tracks.filter((t) => t !== track)
        : [...current.tracks, track],
    }));
  }

  if (!setup.started) {
    return (
      <GameShell title="The Lab" hint="Seven tracks, and they don't all play the same way. Pick your poison.">
        <div className="mx-auto max-w-xl">
          <div className="rounded-[32px] bg-surface p-8 shadow-sm ring-1 ring-inset ring-line sm:p-10">
            <h2 className="t-h2 text-ink">What are we testing?</h2>
            <p className="t-body-sm mt-3">Leave everything unticked for a mixed set.</p>

            <div className="mt-7 grid gap-2.5 sm:grid-cols-2">
              {LAB_TRACKS.map((track) => {
                const active = setup.tracks.includes(track.id);
                const count = labQuestionsFor([track.id], setup.difficulties).length;
                return (
                  <button
                    key={track.id}
                    type="button"
                    disabled={!isHost}
                    onClick={() => toggleTrack(track.id)}
                    className={cn(
                      "flex items-center gap-3.5 rounded-[18px] px-4 py-4 text-left",
                      "transition-[background-color,box-shadow,transform] duration-250 ease-out",
                      active
                        ? "bg-surface shadow-sm ring-[1.5px] ring-inset ring-ink"
                        : "bg-surface-muted hover:bg-surface-sunken",
                      !isHost && "cursor-default",
                    )}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: `var(--${track.accent}-mid)` }}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14.5px] font-bold tracking-[-0.02em] text-ink">
                        {track.label}
                      </span>
                      <span className="t-caption block">{track.how}</span>
                    </span>
                    <span className="t-num shrink-0 text-[12.5px] font-bold text-ink-faint">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="t-eyebrow mb-4 mt-9">Difficulty</p>
            <div className="flex rounded-pill bg-surface-sunken p-1.5">
              {DIFFICULTIES.map((level) => {
                const on = setup.difficulties.includes(level.id);
                return (
                  <button
                    key={level.id}
                    type="button"
                    disabled={!isHost}
                    title={level.blurb}
                    onClick={() =>
                      void setSetup((c) => {
                        const next = c.difficulties.includes(level.id)
                          ? c.difficulties.filter((d) => d !== level.id)
                          : [...c.difficulties, level.id];
                        return { ...c, difficulties: next.length ? next : [level.id] };
                      })
                    }
                    className={cn(
                      "flex-1 rounded-pill py-2.5 text-[13.5px] font-bold tracking-[-0.01em] transition-all duration-300 ease-out",
                      on ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink",
                      !isHost && "cursor-default",
                    )}
                  >
                    {level.label}
                  </button>
                );
              })}
            </div>

            {isHost ? (
              <Button
                block
                size="xl"
                className="mt-8"
                onClick={() => void setSetup((c) => ({ ...c, started: true }))}
              >
                Start {questions.length} challenges
              </Button>
            ) : (
              <p className="t-body-sm mt-8 text-center">They&rsquo;re choosing the subjects…</p>
            )}
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Pill tone="neutral">{pool.length || labQuestionsFor([], []).length} in the pool</Pill>
            {!isSolo && <Pill tone="info">Versus or co-op once you start</Pill>}
          </div>
        </div>
      </GameShell>
    );
  }

  return (
    <QuizEngine
      title="The Lab"
      experienceId="the-lab"
      questions={questions}
      dataKey="lab"
      allowCoop={!isSolo}
      hint={isSolo ? "Solo run — see how far you get." : undefined}
      onPlayAgain={() => void setSetup((c) => ({ ...DEFAULTS, round: (c.round ?? 0) + 1 }))}
    />
  );
}
