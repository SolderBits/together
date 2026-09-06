"use client";

import { useEffect, useMemo, useState } from "react";
import { GameShell, WaitingForPartner } from "@/components/games/game-shell";
import { QuestionCard } from "@/components/games/question-card";
import { ResultBanner } from "@/components/games/scoreboard";
import { Button } from "@/components/ui/button";
import { MemoryMoment } from "@/components/games/memory-moment";
import { Pill } from "@/components/ui/badge";
import { TextField } from "@/components/ui/field";
import { useRoom, useSharedState } from "@/components/room/room-provider";
import { RIDDLES, RIDDLE_KINDS } from "@/lib/games/content/riddles";
import { pickBalanced } from "@/lib/games/content/pick";
import { saveMemory } from "@/lib/store";
import { useRecordCompletion } from "@/lib/store/use-completion";

const ROUNDS = 8;
/** A solve is worth three; a hint costs one of them. */
const SOLVE_POINTS = 3;
const HINT_COST = 1;

interface RiddleData {
  index: number;
  /** One shared guess per riddle — you work these out together. */
  guesses: Record<string, { text: string; by: string; correct: boolean }>;
  hintsUsed: string[];
  finished: boolean;
  /**
   * Bumped on every replay and folded into the selection seed, so a second
   * round in the same room is not the first one again.
   */
  round: number;
}

const DEFAULTS: RiddleData = { index: 0, guesses: {}, hintsUsed: [], finished: false, round: 0 };

function matches(guess: string, accepts: string[]) {
  const clean = guess.toLowerCase().replace(/[^a-z\s]/g, "").trim();
  if (!clean) return false;
  return accepts.some((a) => clean.includes(a));
}

export function RiddleNight() {
  const { state, identity, update } = useRoom();
  const [data, setData] = useSharedState<RiddleData>("riddles", DEFAULTS);
  const [draft, setDraft] = useState("");

  /** Spread across kinds so a night isn't eight lateral-thinking puzzles. */
  const riddles = useMemo(
    () => pickBalanced(RIDDLES, ROUNDS, `${state?.seed ?? "seed"}:${data.round ?? 0}`, (r) => r.kind),
    [state?.seed, data.round],
  );

  const riddle = riddles[Math.min(data.index, riddles.length - 1)];
  const guess = riddle ? data.guesses[riddle.id] : undefined;
  const hintShown = riddle ? data.hintsUsed.includes(riddle.id) : false;
  const solved = Object.values(data.guesses).filter((g) => g.correct).length;
  /** Hints are allowed, they just cost you. */
  const hintPenalty = riddles.filter(
    (r) => data.hintsUsed.includes(r.id) && data.guesses[r.id]?.correct,
  ).length;
  const score = Math.max(0, solved * SOLVE_POINTS - hintPenalty * HINT_COST);
  const maxScore = riddles.length * SOLVE_POINTS;

  useEffect(() => setDraft(""), [data.index]);
  useRecordCompletion("riddle-night", data.finished, `${state?.seed ?? "session"}:${data.round ?? 0}`);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!riddle || guess || !draft.trim()) return;
    void setData((current) => ({
      ...current,
      guesses: {
        ...current.guesses,
        [riddle.id]: {
          text: draft.trim(),
          by: identity.id,
          correct: matches(draft, riddle.accepts),
        },
      },
    }));
  }

  function giveUp() {
    if (!riddle || guess) return;
    void setData((current) => ({
      ...current,
      guesses: {
        ...current.guesses,
        [riddle.id]: { text: "", by: identity.id, correct: false },
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
    if (target >= riddles.length) {
      void setData((current) => ({ ...current, finished: true }));
      void update({ status: "finished" });
      return;
    }
    void setData((current) => ({ ...current, index: Math.max(current.index, target) }));
  }

  if (data.finished) {
    return (
      <GameShell title="Riddle Night" step={riddles.length} totalSteps={riddles.length}>
        <div className="mx-auto max-w-xl space-y-6">
          <ResultBanner
            tone={score >= maxScore / 2 ? "win" : "neutral"}
            headline={`${score} / ${maxScore}`}
            sub={
              solved === riddles.length
                ? `All ${riddles.length} solved${hintPenalty ? ` — with ${hintPenalty} hint${hintPenalty === 1 ? "" : "s"} along the way.` : ", unaided. Suspicious."}`
                : solved === 0
                  ? "None solved. Genuinely impressive in its own way."
                  : `${solved} of ${riddles.length} solved together, which is the whole point.`
            }
          />
          <div className="rounded-3xl ring-1 ring-inset ring-line bg-surface p-6 shadow-sm">
            <p className="mb-4 t-eyebrow">
              The answers
            </p>
            <div className="space-y-3">
              {riddles.map((r) => {
                const g = data.guesses[r.id];
                return (
                  <div key={r.id} className="rounded-2xl bg-surface-muted p-4">
                    <p className="text-[13.5px] leading-snug text-ink">{r.riddle}</p>
                    <p className="mt-2 text-[13px] font-bold text-ink">{r.answer}</p>
                    {g?.text && (
                      <p className="mt-1 text-[12.5px] text-ink-muted">
                        You said &ldquo;{g.text}&rdquo; {g.correct ? "✓" : "✗"}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <MemoryMoment
            onSave={() =>
              saveMemory({
                experienceId: "riddle-night",
                title: "Riddle Night",
                detail: `${solved} of ${riddles.length} solved · ${score}/${maxScore} points.`,
              })
            }
            onAgain={() => {
              void setData((c) => ({ ...DEFAULTS, round: (c.round ?? 0) + 1 }));
              void update({ status: "active" });
            }}
            againLabel="More riddles"
          />
        </div>
      </GameShell>
    );
  }

  if (!riddle) return null;

  return (
    <GameShell
      title="Riddle Night"
      step={data.index + 1}
      totalSteps={riddles.length}
      hint="One riddle at a time. Say it out loud, argue, then submit one answer between you."
    >
      <div className="mx-auto max-w-xl">
        <QuestionCard
          eyebrow={`${RIDDLE_KINDS.find((k) => k.id === riddle.kind)?.label ?? "Riddle"} · ${data.index + 1} of ${riddles.length}`}
          question={riddle.riddle}
        >
          {!guess ? (
            <form onSubmit={submit} className="space-y-3">
              <TextField
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Your answer, together…"
                aria-label="Your answer"
                autoComplete="off"
              />
              {hintShown && (
                <p className="animate-fade-up rounded-2xl bg-butter-tint px-4 py-3 text-[13.5px] text-butter-deep">
                  Hint: {riddle.hint}
                </p>
              )}
              <div className="flex flex-wrap gap-2.5">
                <Button type="submit" size="lg" disabled={!draft.trim()}>
                  Lock it in
                </Button>
                {!hintShown && (
                  <Button
                    type="button"
                    size="lg"
                    variant="soft"
                    onClick={() =>
                      void setData((c) => ({ ...c, hintsUsed: [...c.hintsUsed, riddle.id] }))
                    }
                  >
                    Hint (−{HINT_COST})
                  </Button>
                )}
                <Button type="button" size="lg" variant="ghost" onClick={giveUp}>
                  Give up
                </Button>
              </div>
            </form>
          ) : (
            <div className="animate-fade-up space-y-4">
              <div
                className={`rounded-2xl px-5 py-4 ${
                  guess.correct ? "bg-mint-tint text-mint-deep" : "bg-blush-tint text-blush-deep"
                }`}
              >
                <p className="text-[15px] font-bold">
                  {guess.correct ? "Got it" : guess.text ? "Not quite" : "Skipped"}
                </p>
                <p className="mt-1 text-[13.5px]">
                  Answer: <span className="font-bold">{riddle.answer}</span>
                </p>
                {guess.text && !guess.correct && (
                  <p className="mt-1 text-[13px] opacity-80">You said &ldquo;{guess.text}&rdquo;.</p>
                )}
              </div>
              <Button block size="lg" onClick={next}>
                {data.index + 1 >= riddles.length ? "See the tally" : "Next riddle"}
              </Button>
            </div>
          )}
        </QuestionCard>

        <div className="mt-7 flex flex-wrap justify-center gap-2">
          <Pill tone="good">{score} points</Pill>
          <Pill tone="neutral">{solved} solved</Pill>
          {hintPenalty > 0 && <Pill tone="warn">−{hintPenalty} for hints</Pill>}
          <Pill tone="neutral">{riddles.length - Object.keys(data.guesses).length} left</Pill>
        </div>

        {!guess && (
          <div className="mt-2">
            <WaitingForPartner
              label="thinking out loud"
              detail="Either of you can type the answer — it counts for both."
            />
          </div>
        )}
      </div>
    </GameShell>
  );
}
