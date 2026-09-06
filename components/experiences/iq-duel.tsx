"use client";

import { useMemo } from "react";
import { QuizEngine } from "@/components/games/quiz-engine";
import { GameShell } from "@/components/games/game-shell";
import { Button } from "@/components/ui/button";
import { useRoom, useSharedState } from "@/components/room/room-provider";
import {
  DIFFICULTIES,
  IQ_CATEGORIES,
  iqQuestionsFor,
  type Difficulty,
  type IqCategory,
} from "@/lib/games/content/quiz";
import { pickBalanced } from "@/lib/games/content/pick";
import { cn } from "@/lib/utils";

const ROUNDS = 8;

interface DuelSetup {
  categories: IqCategory[];
  difficulties: Difficulty[];
  started: boolean;
  /**
   * Bumped on every rematch and folded into the selection seed, so a second
   * round in the same room asks different questions. Shared, not local — both
   * clients have to land on the same set.
   */
  round: number;
}

const DEFAULTS: DuelSetup = {
  categories: [],
  difficulties: ["easy", "medium"],
  started: false,
  round: 0,
};

export function IqDuel() {
  const { state, isHost } = useRoom();
  const [setup, setSetup] = useSharedState<DuelSetup>("duelSetup", DEFAULTS);

  const pool = useMemo(
    () => iqQuestionsFor(setup.categories, setup.difficulties),
    [setup.categories, setup.difficulties],
  );

  const questions = useMemo(
    () =>
      pickBalanced(
        pool.length ? pool : iqQuestionsFor([], []),
        ROUNDS,
        `${state?.seed ?? "seed"}:${setup.round ?? 0}`,
        (q) => q.category,
      ),
    [pool, state?.seed, setup.round],
  );

  if (!setup.started) {
    return (
      <GameShell title="IQ Duel" hint="Same questions, same clock. Pick the fight.">
        <div className="mx-auto max-w-xl">
          <div className="rounded-[32px] bg-surface p-8 shadow-sm ring-1 ring-inset ring-line sm:p-10">
            <h2 className="t-h2 text-ink">How hard should this be?</h2>
            <p className="t-body-sm mt-3">
              Faster correct answers score more, whatever you pick.
            </p>

            <div className="mt-7 flex rounded-pill bg-surface-sunken p-1.5">
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

            <p className="t-eyebrow mb-4 mt-9">Subjects — leave blank for a mix</p>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {IQ_CATEGORIES.map((category) => {
                const active = setup.categories.includes(category.id);
                const count = iqQuestionsFor([category.id], setup.difficulties).length;
                return (
                  <button
                    key={category.id}
                    type="button"
                    disabled={!isHost}
                    onClick={() =>
                      void setSetup((c) => ({
                        ...c,
                        categories: c.categories.includes(category.id)
                          ? c.categories.filter((x) => x !== category.id)
                          : [...c.categories, category.id],
                      }))
                    }
                    className={cn(
                      "flex items-center gap-3.5 rounded-[18px] px-4 py-3.5 text-left transition-all duration-250 ease-out",
                      active
                        ? "bg-surface shadow-sm ring-[1.5px] ring-inset ring-ink"
                        : "bg-surface-muted hover:bg-surface-sunken",
                      !isHost && "cursor-default",
                    )}
                  >
                    <span className="flex-1 text-[14.5px] font-bold tracking-[-0.02em] text-ink">
                      {category.label}
                    </span>
                    <span className="t-num text-[12.5px] font-bold text-ink-faint">{count}</span>
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
                Start {questions.length} questions
              </Button>
            ) : (
              <p className="t-body-sm mt-8 text-center">They&rsquo;re setting the difficulty…</p>
            )}
          </div>
        </div>
      </GameShell>
    );
  }

  return (
    <QuizEngine
      title="IQ Duel"
      experienceId="iq-duel"
      questions={questions}
      dataKey="iqDuel"
      hint="Same questions, same clock. Faster correct answers score more."
      onPlayAgain={() => void setSetup((c) => ({ ...DEFAULTS, round: (c.round ?? 0) + 1 }))}
    />
  );
}
