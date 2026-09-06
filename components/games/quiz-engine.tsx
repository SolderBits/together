"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GameShell, WaitingForPartner } from "./game-shell";
import { AnswerOption, QuestionCard } from "./question-card";
import { CountdownRing } from "./countdown";
import { ResultBanner, ScoreBoard } from "./scoreboard";
import { Button } from "@/components/ui/button";
import { useAnnounce } from "@/components/a11y/announcer";
import { MemoryMoment } from "@/components/games/memory-moment";
import { Pill } from "@/components/ui/badge";
import { useRoom, useSharedState } from "@/components/room/room-provider";
import type { QuizQuestion } from "@/lib/games/content/quiz";
import { saveMemory } from "@/lib/store";
import { useRecordCompletion } from "@/lib/store/use-completion";
import { cn } from "@/lib/utils";

export type QuizMode = "versus" | "coop";

interface Entry {
  choice: number;
  /** Milliseconds left on the clock when they answered — drives the speed bonus. */
  msLeft: number;
}

export interface QuizData {
  index: number;
  entries: Record<string, Record<string, Entry>>;
  deadlines: Record<string, number>;
  mode: QuizMode;
  finished: boolean;
}

export const QUIZ_DEFAULTS: QuizData = {
  index: 0,
  entries: {},
  deadlines: {},
  mode: "versus",
  finished: false,
};

const BASE_POINTS = 10;
const MAX_SPEED_BONUS = 5;

function pointsFor(entry: Entry | undefined, question: QuizQuestion) {
  if (!entry || entry.choice !== question.answer) return 0;
  const fraction = Math.max(0, Math.min(1, entry.msLeft / (question.seconds * 1000)));
  return BASE_POINTS + Math.round(fraction * MAX_SPEED_BONUS);
}

/**
 * Shared engine behind IQ Duel and The Lab: identical questions, independent
 * (or pooled) answers, a synchronised deadline, then a reveal.
 */
export function QuizEngine({
  title,
  experienceId,
  questions,
  dataKey,
  hint,
  allowCoop = false,
  header,
  onPlayAgain,
}: {
  title: string;
  experienceId: string;
  /** `flashMs` makes the prompt disappear before you answer; `ask` replaces it. */
  questions: (QuizQuestion & { flashMs?: number; ask?: string })[];
  dataKey: string;
  hint?: string;
  allowCoop?: boolean;
  header?: React.ReactNode;
  onPlayAgain?: () => void;
}) {
  const { state, identity, players, roster, partner, isHost, update } = useRoom();
  const [data, setData] = useSharedState<QuizData>(dataKey, QUIZ_DEFAULTS);

  const question = questions[Math.min(data.index, questions.length - 1)];
  const order = useMemo(() => Object.keys(state?.players ?? {}).sort(), [state?.players]);
  const coop = allowCoop && data.mode === "coop";

  /**
   * The observation mechanic: the prompt is shown for `flashMs` and then taken
   * away, so you're answering from memory rather than re-reading it.
   */
  const [flashDone, setFlashDone] = useState(false);
  useEffect(() => {
    if (!question?.flashMs) {
      setFlashDone(true);
      return;
    }
    setFlashDone(false);
    const t = setTimeout(() => setFlashDone(true), question.flashMs);
    return () => clearTimeout(t);
  }, [question?.id, question?.flashMs]);

  const entries = data.entries[question?.id ?? ""] ?? {};
  const myEntry = entries[identity.id];
  const teamEntry = Object.values(entries)[0];
  const deadline = data.deadlines[question?.id ?? ""] ?? null;

  const everyoneIn = coop
    ? Boolean(teamEntry)
    : players.length > 1
      ? players.every((p) => entries[p.id])
      : Boolean(myEntry);
  const expired = deadline !== null && Date.now() > deadline;
  const revealed = everyoneIn || expired;

  // The host opens each question's clock so both sides share one deadline.
  useEffect(() => {
    if (!question || data.finished) return;
    if (data.deadlines[question.id] || !isHost) return;
    void setData((current) => ({
      ...current,
      deadlines: {
        ...current.deadlines,
        [question.id]: Date.now() + question.seconds * 1000,
      },
    }));
  }, [question, data.deadlines, data.finished, isHost, setData]);

  useRecordCompletion(experienceId, data.finished, `${state?.seed ?? "s"}:${questions[0]?.id ?? ""}`);

  /**
   * Narrates the round for anyone not watching it happen. Each sentence fires
   * once, when the thing it describes actually changes.
   */
  useAnnounce(
    data.finished
      ? "That's the last question. Here are the results."
      : question
        ? `Question ${data.index + 1} of ${questions.length}. ${
            question.flashMs && !flashDone ? "Read it now, it disappears in a moment." : question.question
          }`
        : null,
  );
  useAnnounce(
    revealed && question && !data.finished
      ? `Answer: ${question.options[question.answer]}.${
          question.explanation ? ` ${question.explanation}` : ""
        }`
      : null,
  );

  const scores = useMemo(() => {
    const totals: Record<string, number> = {};
    order.forEach((id) => (totals[id] = 0));
    let team = 0;
    questions.forEach((q) => {
      const row = data.entries[q.id];
      if (!row) return;
      if (coop) {
        const entry = Object.values(row)[0];
        team += pointsFor(entry, q);
      } else {
        order.forEach((id) => {
          totals[id] = (totals[id] ?? 0) + pointsFor(row[id], q);
        });
      }
    });
    return { totals, team };
  }, [data.entries, order, questions, coop]);

  const choose = useCallback(
    (choice: number) => {
      if (!question) return;
      if (coop ? Boolean(teamEntry) : myEntry !== undefined) return;
      const msLeft = deadline ? Math.max(0, deadline - Date.now()) : 0;
      void setData((current) => ({
        ...current,
        entries: {
          ...current.entries,
          [question.id]: {
            ...(current.entries[question.id] ?? {}),
            [identity.id]: { choice, msLeft },
          },
        },
      }));
    },
    [question, coop, teamEntry, myEntry, deadline, identity.id, setData],
  );

  /**
   * Both players see this button, so both press it. Advancing with an increment
   * meant the two read-modify-write cycles could land two ahead and silently
   * skip a round; writing the target index absolutely makes a second press a
   * no-op while a genuinely later press still advances.
   */
  function next() {
    const target = data.index + 1;
    if (target >= questions.length) {
      void setData((current) => ({ ...current, finished: true }));
      void update({ status: "finished" });
      return;
    }
    void setData((current) => ({ ...current, index: Math.max(current.index, target) }));
  }

  function playAgain() {
    void setData({ ...QUIZ_DEFAULTS, mode: data.mode });
    void update({ status: "active" });
    onPlayAgain?.();
  }

  // --- results -------------------------------------------------------------

  if (data.finished) {
    const maxScore = questions.length * (BASE_POINTS + MAX_SPEED_BONUS);
    if (coop) {
      const correct = questions.filter((q) => {
        const entry = Object.values(data.entries[q.id] ?? {})[0];
        return entry?.choice === q.answer;
      }).length;
      return (
        <GameShell title={title} step={questions.length} totalSteps={questions.length}>
          <div className="mx-auto max-w-xl space-y-6">
            <ResultBanner
              tone="win"
              headline={`${correct} of ${questions.length}`}
              sub={`Team score: ${scores.team} points.`}
            />
            <QuizReview questions={questions} entries={data.entries} state={state} />
            <MemoryMoment onAgain={playAgain} againLabel="Go again" />
          </div>
        </GameShell>
      );
    }

    const rows = roster.map((p) => ({
      id: p.id,
      name: p.id === identity.id ? "You" : p.name,
      emoji: p.emoji,
      score: scores.totals[p.id] ?? 0,
      detail: `${questions.filter((q) => data.entries[q.id]?.[p.id]?.choice === q.answer).length}/${questions.length} correct`,
    }));
    const best = Math.max(...rows.map((r) => r.score), 0);
    const winners = rows.filter((r) => r.score === best);
    const tie = winners.length > 1;

    return (
      <GameShell title={title} step={questions.length} totalSteps={questions.length}>
        <div className="mx-auto max-w-xl space-y-6">
          <ResultBanner
            tone={tie ? "tie" : "win"}
            headline={tie ? "A tie" : `${winners[0]?.name ?? "Someone"} takes it`}
            sub={
              tie
                ? "Same score, right down to the speed bonus."
                : `${best} points, including time bonuses.`
            }
          />
          <ScoreBoard rows={rows} max={maxScore} title="Final score" />
          <QuizReview questions={questions} entries={data.entries} state={state} />
          <MemoryMoment
            onSave={() =>
              saveMemory({
                experienceId,
                title,
                detail: rows.map((r) => `${r.name}: ${r.score}`).join(" · "),
              })
            }
            onAgain={playAgain}
            againLabel="Rematch"
          />
        </div>
      </GameShell>
    );
  }

  if (!question) return null;

  // --- playing -------------------------------------------------------------

  const locked = coop ? Boolean(teamEntry) : myEntry !== undefined;

  return (
    <GameShell
      title={title}
      step={data.index + 1}
      totalSteps={questions.length}
      hint={hint}
      actions={
        deadline ? (
          <CountdownRing endsAt={deadline} totalMs={question.seconds * 1000} size={44} />
        ) : null
      }
    >
      <div className="mx-auto max-w-xl">
        {header}

        {allowCoop && (
          <div className="mb-7 flex justify-center">
            <div className="flex rounded-pill bg-surface-sunken p-1.5">
              {(["versus", "coop"] as QuizMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  disabled={!isHost || data.index > 0}
                  onClick={() => void setData((c) => ({ ...c, mode: m }))}
                  className={cn(
                    "rounded-pill px-5 py-2 text-[13px] font-bold tracking-[-0.01em] transition-all duration-300 ease-out",
                    data.mode === m ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink",
                    (!isHost || data.index > 0) && "cursor-default",
                  )}
                >
                  {m === "versus" ? "Versus" : "Co-op"}
                </button>
              ))}
            </div>
          </div>
        )}

        <QuestionCard
          eyebrow={`Question ${data.index + 1} of ${questions.length}`}
          question={
            question.flashMs && flashDone && !revealed
              ? (question.ask ?? "…what was it again?")
              : question.question
          }
        >
          {question.flashMs && !flashDone && (
            <p className="t-caption mb-6">Read it now — it disappears in a moment.</p>
          )}

          {question.flashMs && revealed && question.ask && (
            <p className="t-body-sm mb-6">{question.ask}</p>
          )}

          <div className={cn("space-y-2.5", Boolean(question.flashMs) && !flashDone && "opacity-30")}>
            {question.options.map((option, i) => {
              let optionState: "idle" | "correct" | "wrong" | "dimmed" = "idle";
              if (revealed) {
                if (i === question.answer) optionState = "correct";
                else if (Object.values(entries).some((e) => e.choice === i)) optionState = "wrong";
                else optionState = "dimmed";
              }
              return (
                <AnswerOption
                  key={option}
                  index={i}
                  label={option}
                  selected={coop ? teamEntry?.choice === i : myEntry?.choice === i}
                  state={optionState}
                  disabled={locked || expired || Boolean(question.flashMs && !flashDone)}
                  onClick={() => choose(i)}
                  note={
                    revealed ? (
                      <span className="flex gap-1 text-[15px]">
                        {Object.entries(entries)
                          .filter(([, e]) => e.choice === i)
                          .map(([id]) => (
                            <span key={id} title={state?.players[id]?.name}>
                              {state?.players[id]?.emoji}
                            </span>
                          ))}
                      </span>
                    ) : null
                  }
                />
              );
            })}
          </div>
        </QuestionCard>

        <div className="mt-6">
          {!locked && !expired ? (
            <p className="t-body-sm text-center">
              {coop
                ? "Talk it through — either of you can lock the answer in."
                : "Answer before the clock runs out. Faster answers score more."}
            </p>
          ) : !revealed ? (
            <WaitingForPartner
              label="locked in"
              detail={`Waiting for ${partner?.name ?? "them"}.`}
            />
          ) : (
            <div className="animate-fade-up space-y-4">
              <div className="rounded-3xl ring-1 ring-inset ring-line bg-surface p-5 shadow-sm">
                <p className="text-[15px] font-bold text-ink">
                  Answer: {question.options[question.answer]}
                </p>
                {question.explanation && (
                  <p className="t-body-sm mt-2.5">{question.explanation}</p>
                )}
                {expired && !locked && (
                  <p className="mt-3 text-[13.5px] font-semibold text-blush-deep">
                    Clock ran out — no points that round.
                  </p>
                )}
              </div>
              <Button block size="lg" onClick={next}>
                {data.index + 1 >= questions.length ? "See the result" : "Next question"}
              </Button>
            </div>
          )}
        </div>

        {!coop && (
          <div className="mt-8">
            <ScoreBoard
              title="Running score"
              rows={roster.map((p) => ({
                id: p.id,
                name: p.id === identity.id ? "You" : p.name,
                emoji: p.emoji,
                score: scores.totals[p.id] ?? 0,
              }))}
            />
          </div>
        )}
        {coop && (
          <div className="mt-8 flex justify-center">
            <Pill tone="good">Team score: {scores.team}</Pill>
          </div>
        )}
      </div>
    </GameShell>
  );
}

function QuizReview({
  questions,
  entries,
  state,
}: {
  questions: QuizQuestion[];
  entries: QuizData["entries"];
  state: ReturnType<typeof useRoom>["state"];
}) {
  return (
    <div className="rounded-3xl ring-1 ring-inset ring-line bg-surface p-6 shadow-sm">
      <p className="mb-4 t-eyebrow">
        Question by question
      </p>
      <div className="space-y-3">
        {questions.map((q, i) => {
          const row = entries[q.id] ?? {};
          return (
            <div key={q.id} className="rounded-2xl bg-surface-muted p-4">
              <p className="text-[14px] font-bold leading-snug tracking-[-0.015em] text-ink">
                {i + 1}. {q.question}
              </p>
              <p className="mt-2 text-[13.5px]">
                <span className="font-semibold text-mint-deep">{q.options[q.answer]}</span>
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {Object.entries(row).map(([id, entry]) => (
                  <span
                    key={id}
                    className={cn(
                      "rounded-pill px-3 py-1.5 text-[12px] font-semibold",
                      entry.choice === q.answer
                        ? "bg-mint-tint text-mint-deep"
                        : "bg-blush-tint text-blush-deep",
                    )}
                  >
                    {state?.players[id]?.emoji} {q.options[entry.choice]}
                  </span>
                ))}
                {Object.keys(row).length === 0 && (
                  <span className="t-caption">No answer</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
