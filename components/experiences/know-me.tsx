"use client";

import { useEffect, useMemo } from "react";
import { GameShell, WaitingForPartner } from "@/components/games/game-shell";
import { useAnnounce } from "@/components/a11y/announcer";
import { AnswerOption, QuestionCard } from "@/components/games/question-card";
import { ResultBanner, ScoreBoard } from "@/components/games/scoreboard";
import { Button } from "@/components/ui/button";
import { MemoryMoment } from "@/components/games/memory-moment";
import { Pill } from "@/components/ui/badge";
import { useRoom, useSharedState } from "@/components/room/room-provider";
import {
  KNOW_ME_ARC,
  KNOW_ME_CATEGORIES,
  KNOW_ME_QUESTIONS,
} from "@/lib/games/content/know-me";
import { pickArc } from "@/lib/games/content/pick";
import { saveMemory } from "@/lib/store";
import { useRecordCompletion } from "@/lib/store/use-completion";


interface KnowMeData {
  index: number;
  /** answers[questionId][playerId] = option index */
  answers: Record<string, Record<string, number>>;
  finished: boolean;
  /**
   * Bumped on every replay and folded into the selection seed, so a second
   * round in the same room is not the first one again.
   */
  round: number;
}

const DEFAULTS: KnowMeData = { index: 0, answers: {}, finished: false, round: 0 };

export function KnowMeQuiz() {
  const { state, identity, players, roster, partner, update } = useRoom();
  const [data, setData] = useSharedState<KnowMeData>("knowMe", DEFAULTS);

  /**
   * Questions follow a deliberate arc — warm up, get funny, get personal, then
   * land somewhere that matters — rather than arriving in random order. Both
   * clients derive the identical set from the room seed.
   */
  const questions = useMemo(
    () =>
      pickArc(
        KNOW_ME_QUESTIONS,
        KNOW_ME_ARC,
        `${state?.seed ?? "seed"}:${data.round ?? 0}`,
        (q) => q.category,
      ),
    [state?.seed, data.round],
  );

  /** Stable turn order derived from the room document, not from presence. */
  const order = useMemo(
    () => Object.keys(state?.players ?? {}).sort(),
    [state?.players],
  );

  const question = questions[Math.min(data.index, questions.length - 1)];
  const subjectId = order.length ? order[data.index % order.length] : identity.id;
  const guesserId = order.find((id) => id !== subjectId) ?? identity.id;
  const iAmSubject = subjectId === identity.id;

  const answersForQuestion = data.answers[question?.id ?? ""] ?? {};
  const myAnswer = answersForQuestion[identity.id];
  const bothIn =
    order.length >= 2
      ? order.every((id) => answersForQuestion[id] !== undefined)
      : myAnswer !== undefined;
  const revealed = bothIn;

  const scores = useMemo(() => {
    const totals: Record<string, number> = {};
    order.forEach((id) => (totals[id] = 0));
    questions.forEach((q, i) => {
      const subject = order[i % Math.max(1, order.length)];
      const guesser = order.find((id) => id !== subject);
      if (!guesser) return;
      const row = data.answers[q.id];
      if (!row) return;
      if (row[subject] !== undefined && row[subject] === row[guesser]) {
        totals[guesser] = (totals[guesser] ?? 0) + 1;
      }
    });
    return totals;
  }, [data.answers, order, questions]);

  const answeredCount = questions.filter((q) => {
    const row = data.answers[q.id];
    return row && order.every((id) => row[id] !== undefined);
  }).length;

  useRecordCompletion("know-me", data.finished, `${state?.seed ?? "session"}:${data.round ?? 0}`);

  // Whose turn it is matters as much as the question, and neither is visible
  // to someone using a screen reader unless it is said.
  const asking = question
    ? iAmSubject
      ? `Question ${data.index + 1} of ${questions.length}. About you: ${question.subject}`
      : `Question ${data.index + 1} of ${questions.length}. Guess their answer: ${question.prompt}`
    : null;
  useAnnounce(data.finished ? "That's the last one. Here are the results." : asking);

  function choose(optionIndex: number) {
    if (myAnswer !== undefined || !question) return;
    void setData((current) => ({
      ...current,
      answers: {
        ...current.answers,
        [question.id]: { ...(current.answers[question.id] ?? {}), [identity.id]: optionIndex },
      },
    }));
  }

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
    void setData((c) => ({ ...DEFAULTS, round: (c.round ?? 0) + 1 }));
    void update({ status: "active" });
  }

  // --- results -------------------------------------------------------------

  if (data.finished) {
    const rows = roster.map((p) => ({
      id: p.id,
      name: p.id === identity.id ? "You" : p.name,
      emoji: p.emoji,
      score: scores[p.id] ?? 0,
    }));
    const best = Math.max(...rows.map((r) => r.score), 0);
    const winners = rows.filter((r) => r.score === best);
    const tie = winners.length > 1;

    return (
      <GameShell title="Know Me Quiz" step={questions.length} totalSteps={questions.length}>
        <div className="mx-auto max-w-xl space-y-6">
          <ResultBanner
            tone={tie ? "tie" : "win"}
            headline={
              tie ? "Dead even" : `${winners[0]?.name ?? "Someone"} knows the other better`
            }
            sub={`${best} out of ${questions.length} guessed right.`}
          />
          <ScoreBoard rows={rows} max={questions.length} title="Final score" />

          <div className="rounded-3xl ring-1 ring-inset ring-line bg-surface p-6 shadow-sm">
            <p className="mb-4 t-eyebrow">
              Where you differed
            </p>
            <div className="space-y-3">
              {questions.map((q, i) => {
                const subject = order[i % Math.max(1, order.length)];
                const guesser = order.find((id) => id !== subject);
                const row = data.answers[q.id];
                if (!row || !guesser) return null;
                const hit = row[subject] === row[guesser];
                if (hit) return null;
                return (
                  <div key={q.id} className="rounded-2xl bg-surface-muted p-4">
                    <p className="text-[13.5px] font-bold text-ink">{q.prompt}</p>
                    <p className="mt-1.5 text-[13px] text-ink-muted">
                      Truth: <span className="font-semibold text-ink">{q.options[row[subject]]}</span>
                    </p>
                    <p className="text-[13px] text-ink-muted">
                      Guess: <span className="font-semibold">{q.options[row[guesser]]}</span>
                    </p>
                  </div>
                );
              })}
              {questions.every((q, i) => {
                const subject = order[i % Math.max(1, order.length)];
                const guesser = order.find((id) => id !== subject);
                const row = data.answers[q.id];
                return !row || !guesser || row[subject] === row[guesser];
              }) && (
                <p className="text-[14px] text-ink-muted">
                  Nothing — you matched on every single one.
                </p>
              )}
            </div>
          </div>

          <MemoryMoment
            onSave={() =>
              saveMemory({
                experienceId: "know-me",
                title: "Know Me Quiz",
                detail: rows.map((r) => `${r.name}: ${r.score}/${questions.length}`).join(" · "),
              })
            }
            onAgain={playAgain}
            againLabel="Another round"
          />
        </div>
      </GameShell>
    );
  }

  // --- playing -------------------------------------------------------------

  if (!question) return null;

  return (
    <GameShell
      title="Know Me Quiz"
      step={data.index + 1}
      totalSteps={questions.length}
      hint={
        order.length < 2
          ? "Nobody else is here yet — invite them so guesses can be scored."
          : undefined
      }
    >
      <div className="mx-auto max-w-xl">
        <div className="mb-8 flex justify-center">
          <Pill tone={iAmSubject ? "info" : "warn"}>
            {iAmSubject
              ? "Answer about yourself"
              : `Guess ${partner ? `${partner.name}'s` : "their"} answer`}
          </Pill>
        </div>

        <QuestionCard
          eyebrow={`${
            KNOW_ME_CATEGORIES.find((c) => c.id === question.category)?.label ?? "Question"
          } · ${data.index + 1} of ${questions.length}`}
          question={
            iAmSubject
              ? question.prompt.replace(/^What's my/, "What's your").replace(/\bme\b/g, "you")
              : question.prompt
          }
        >
          <div className="space-y-2.5">
            {question.options.map((option, i) => {
              let optionState: "idle" | "correct" | "wrong" | "dimmed" = "idle";
              if (revealed) {
                const truth = answersForQuestion[subjectId];
                const guess = answersForQuestion[guesserId];
                if (i === truth) optionState = "correct";
                else if (i === guess) optionState = "wrong";
                else optionState = "dimmed";
              }
              return (
                <AnswerOption
                  key={option}
                  index={i}
                  label={option}
                  selected={myAnswer === i}
                  state={optionState}
                  disabled={myAnswer !== undefined}
                  onClick={() => choose(i)}
                  note={
                    revealed ? (
                      <span className="flex gap-1 text-[15px]">
                        {order
                          .filter((id) => answersForQuestion[id] === i)
                          .map((id) => (
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
          {myAnswer === undefined ? (
            <p className="text-center text-[13.5px] text-ink-muted">
              Pick one — nothing shows until you&rsquo;ve both locked in.
            </p>
          ) : !revealed ? (
            <WaitingForPartner
              label="locked in"
              detail={`Waiting for ${partner?.name ?? "them"} to answer.`}
            />
          ) : (
            <div className="animate-fade-up space-y-4">
              <div className="rounded-3xl ring-1 ring-inset ring-line bg-surface p-5 text-center shadow-sm">
                <p className="text-[15px] font-bold text-ink">
                  {answersForQuestion[subjectId] === answersForQuestion[guesserId]
                    ? "Correct — a point to the guesser"
                    : "Missed it — no point"}
                </p>
                <p className="t-body-sm mt-2.5">
                  {state?.players[subjectId]?.name ?? "They"} really answered &ldquo;
                  {question.options[answersForQuestion[subjectId]]}&rdquo;.
                </p>
              </div>
              <Button block size="lg" onClick={next}>
                {data.index + 1 >= questions.length ? "See the score" : "Next question"}
              </Button>
            </div>
          )}
        </div>

        <div className="mt-8">
          <ScoreBoard
            title={`Running score · ${answeredCount} answered`}
            max={questions.length}
            rows={roster.map((p) => ({
              id: p.id,
              name: p.id === identity.id ? "You" : p.name,
              emoji: p.emoji,
              score: scores[p.id] ?? 0,
            }))}
          />
        </div>
      </div>
    </GameShell>
  );
}
