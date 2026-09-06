"use client";

import { useEffect, useMemo, useState } from "react";
import { GameShell, WaitingForPartner } from "@/components/games/game-shell";
import { AnswerOption, QuestionCard } from "@/components/games/question-card";
import { Button } from "@/components/ui/button";
import { MemoryMoment } from "@/components/games/memory-moment";
import { Pill } from "@/components/ui/badge";
import { useRoom, useSharedState } from "@/components/room/room-provider";
import {
  MATCH_DIMENSIONS,
  MATCH_OBSERVATIONS,
  MATCH_QUESTIONS,
  MATCH_VERDICTS,
  type MatchDimension,
} from "@/lib/games/content/love-match";
import { pickBalanced } from "@/lib/games/content/pick";
import { saveMemory } from "@/lib/store";
import { useRecordCompletion } from "@/lib/store/use-completion";
import { cn } from "@/lib/utils";

const ROUNDS = 14;

interface MatchData {
  answers: Record<string, Record<string, number>>;
  revealed: boolean;
  /**
   * Bumped on every replay and folded into the selection seed, so a second
   * round in the same room is not the first one again.
   */
  round: number;
}

const DEFAULTS: MatchData = { answers: {}, revealed: false, round: 0 };

/** Identical answer scores full, adjacent scores half, further apart scores none. */
function creditFor(distance: number) {
  if (distance === 0) return 1;
  if (distance === 1) return 0.5;
  if (distance === 2) return 0.15;
  return 0;
}

export function LoveMatch() {
  const { state, identity, roster, partner, isHost, update } = useRoom();
  const [data, setData] = useSharedState<MatchData>("loveMatch", DEFAULTS);
  const [index, setIndex] = useState(0);

  /** A balanced spread across dimensions, identical for both players. */
  const questions = useMemo(
    () =>
      pickBalanced(
        MATCH_QUESTIONS,
        ROUNDS,
        `${state?.seed ?? "seed"}:${data.round ?? 0}`,
        (q) => q.dimension,
        ["conflict", "communication", "values", "future", "money"],
      ),
    [state?.seed, data.round],
  );

  const other = useMemo(
    () => roster.find((p) => p.id !== identity.id) ?? null,
    [roster, identity.id],
  );

  const question = questions[Math.min(index, questions.length - 1)];

  const myAnswers = useMemo(() => {
    const out: Record<string, number> = {};
    questions.forEach((q) => {
      const value = data.answers[q.id]?.[identity.id];
      if (value !== undefined) out[q.id] = value;
    });
    return out;
  }, [data.answers, identity.id, questions]);

  const iFinished = Object.keys(myAnswers).length >= questions.length;
  const partnerFinished =
    other !== null && questions.every((q) => data.answers[q.id]?.[other.id] !== undefined);
  const bothFinished = iFinished && partnerFinished;

  useEffect(() => {
    if (bothFinished && isHost && !data.revealed) {
      void setData((c) => ({ ...c, revealed: true }));
    }
  }, [bothFinished, isHost, data.revealed, setData]);

  useRecordCompletion("love-match", data.revealed, `${state?.seed ?? "session"}:${data.round ?? 0}`);

  /**
   * Weighted compatibility.
   *
   * Every question carries its dimension's weight, so agreeing about how you
   * argue moves the number considerably more than agreeing about shoes.
   */
  const result = useMemo(() => {
    if (!other) return null;

    let earned = 0;
    let available = 0;
    let perfect = 0;
    let near = 0;
    let far = 0;

    const byDimension = new Map<
      MatchDimension,
      { earned: number; available: number; count: number }
    >();

    const rows = questions.map((q) => {
      const mine = data.answers[q.id]?.[identity.id];
      const theirs = data.answers[q.id]?.[other.id];
      const weight = MATCH_DIMENSIONS.find((d) => d.id === q.dimension)?.weight ?? 1;

      if (mine === undefined || theirs === undefined) {
        return { q, mine, theirs, kind: "missing" as const };
      }

      const distance = Math.abs(mine - theirs);
      const credit = creditFor(distance);
      earned += credit * weight;
      available += weight;

      const bucket = byDimension.get(q.dimension) ?? { earned: 0, available: 0, count: 0 };
      bucket.earned += credit;
      bucket.available += 1;
      bucket.count += 1;
      byDimension.set(q.dimension, bucket);

      if (distance === 0) perfect += 1;
      else if (distance === 1) near += 1;
      else far += 1;

      return {
        q,
        mine,
        theirs,
        kind: distance === 0 ? ("same" as const) : distance === 1 ? ("near" as const) : ("far" as const),
      };
    });

    const score = available > 0 ? Math.round((earned / available) * 100) : 0;
    const verdict = MATCH_VERDICTS.find((v) => score >= v.min) ?? MATCH_VERDICTS[MATCH_VERDICTS.length - 1];

    const dimensionScores = Array.from(byDimension.entries())
      .map(([id, b]) => ({
        meta: MATCH_DIMENSIONS.find((d) => d.id === id)!,
        pct: Math.round((b.earned / b.available) * 100),
        count: b.count,
      }))
      .sort((a, b) => b.pct - a.pct);

    const strongest = dimensionScores[0] ?? null;
    const weakest = dimensionScores[dimensionScores.length - 1] ?? null;
    /**
     * With too flat a spread, "aligned on X / differ on Y" reads as nonsense
     * because both numbers are the same. Only claim a standout when there is
     * genuinely one.
     */
    const spread = strongest && weakest ? strongest.pct - weakest.pct : 0;
    const hasStandout = spread >= 15;

    const observation =
      MATCH_OBSERVATIONS.find((o) =>
        o.test({ perfect, near, far, total: questions.length }),
      )?.text ?? "";

    const identical = rows.filter((r) => r.kind === "same");

    /**
     * The findings, not the number. A handful of specific observations reads as
     * discovery; a percentage on its own reads as a quiz result.
     */
    const answered = rows.filter((r) => r.kind !== "missing");
    const highlights: { tone: "same" | "near" | "far"; line: string; row: (typeof rows)[number] }[] =
      [];

    const heaviest = (list: typeof rows) =>
      list
        .slice()
        .sort(
          (a, b) =>
            (MATCH_DIMENSIONS.find((d) => d.id === b.q.dimension)?.weight ?? 1) -
            (MATCH_DIMENSIONS.find((d) => d.id === a.q.dimension)?.weight ?? 1),
        );

    const bigSame = heaviest(answered.filter((r) => r.kind === "same"))[0];
    if (bigSame) {
      highlights.push({
        tone: "same",
        line: "You both chose exactly the same thing here — on one of the questions that actually matters.",
        row: bigSame,
      });
    }

    const bigFar = heaviest(answered.filter((r) => r.kind === "far"))[0];
    if (bigFar) {
      highlights.push({
        tone: "far",
        line: "You think about this completely differently. Worth ten minutes and a drink.",
        row: bigFar,
      });
    }

    const nearMiss = answered.filter((r) => r.kind === "near")[0];
    if (nearMiss) {
      highlights.push({
        tone: "near",
        line: "Same instinct, different wording. You'd probably argue about this and end up agreeing.",
        row: nearMiss,
      });
    }

    const secondFar = heaviest(answered.filter((r) => r.kind === "far"))[1];
    if (secondFar && highlights.length < 4) {
      highlights.push({
        tone: "far",
        line: "An interesting mismatch — neither of you is wrong, which is the annoying part.",
        row: secondFar,
      });
    }

    return {
      rows,
      perfect,
      near,
      far,
      score,
      verdict,
      observation,
      dimensionScores,
      strongest,
      weakest,
      spread,
      hasStandout,
      identical,
      highlights,
    };
  }, [data.answers, identity.id, other, questions]);

  function choose(optionIndex: number) {
    if (myAnswers[question.id] !== undefined) return;
    void setData((c) => ({
      ...c,
      answers: {
        ...c.answers,
        [question.id]: { ...(c.answers[question.id] ?? {}), [identity.id]: optionIndex },
      },
    }));
    if (index + 1 < questions.length) setIndex((i) => i + 1);
  }

  // --- result --------------------------------------------------------------

  if (data.revealed && result) {
    return (
      <GameShell title="Love Match">
        <div className="mx-auto max-w-[720px] space-y-6">
          <div
            className="a-pop relative overflow-hidden rounded-[36px] p-10 text-center shadow-sm ring-1 ring-inset ring-line sm:p-14"
            style={{
              background:
                "linear-gradient(128deg, var(--blush-tint), var(--lilac-tint) 52%, var(--sky-tint))",
            }}
          >
            <span className="grain absolute inset-0" aria-hidden="true" />
            <div className="relative">
              <p className="t-eyebrow">What we found</p>
              <h3 className="t-h1 mx-auto mt-5 max-w-[16ch] text-balance text-ink">
                {result.verdict.headline}
              </h3>
              <p className="t-body mx-auto mt-5 max-w-[44ch] text-[16px] text-ink-soft">
                {result.verdict.line}
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
                <Pill tone="neutral">
                  <span className="t-num font-extrabold">{result.score}</span> on a completely
                  unscientific scale
                </Pill>
                <Pill tone="neutral">{result.perfect} identical answers</Pill>
              </div>
            </div>
          </div>

          {/* the interesting bits, before any numbers */}
          {result.highlights.length > 0 && (
            <div className="space-y-3">
              {result.highlights.map((h) => (
                <div
                  key={h.row.q.id}
                  className="rounded-[28px] bg-surface p-7 shadow-sm ring-1 ring-inset ring-line"
                >
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Pill tone={h.tone === "same" ? "good" : h.tone === "near" ? "info" : "warn"}>
                      {h.tone === "same"
                        ? "You both chose"
                        : h.tone === "near"
                          ? "Nearly the same"
                          : "You differ here"}
                    </Pill>
                    <span className="t-eyebrow">
                      {MATCH_DIMENSIONS.find((d) => d.id === h.row.q.dimension)?.label}
                    </span>
                  </div>
                  <p className="t-h3 text-balance text-ink">{h.row.q.question}</p>
                  <div className="mt-4 grid gap-1.5 text-[14px] sm:grid-cols-2">
                    <p className="text-ink-muted">
                      You:{" "}
                      <span className="font-bold text-ink">
                        {h.row.mine !== undefined ? h.row.q.options[h.row.mine] : "—"}
                      </span>
                    </p>
                    <p className="text-ink-muted">
                      {other?.name}:{" "}
                      <span className="font-bold text-ink">
                        {h.row.theirs !== undefined ? h.row.q.options[h.row.theirs] : "—"}
                      </span>
                    </p>
                  </div>
                  <p className="t-body-sm mt-4">{h.line}</p>
                </div>
              ))}
            </div>
          )}

          {/* headline observations */}
          {!result.hasStandout ? (
            <div className="rounded-[28px] bg-surface p-7 shadow-sm ring-1 ring-inset ring-line">
              <p className="t-eyebrow mb-3">Across the board</p>
              <p className="t-h3 text-ink">Evenly matched everywhere</p>
              <p className="t-body-sm mt-2.5 max-w-[52ch]">
                No single area stands out — you&rsquo;re about as aligned on money as you are on
                mess, which is rarer than it sounds.
              </p>
            </div>
          ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {result.strongest && (
              <div className="rounded-[28px] bg-surface p-7 shadow-sm ring-1 ring-inset ring-line">
                <p className="t-eyebrow mb-3">Unusually aligned on</p>
                <p className="t-h3 text-ink">{result.strongest.meta.label}</p>
                <p className="t-body-sm mt-2.5">
                  You&rsquo;re {result.strongest.pct}% together on {result.strongest.meta.aligned}.
                </p>
              </div>
            )}
            {result.weakest && result.weakest !== result.strongest && (
              <div className="rounded-[28px] bg-surface p-7 shadow-sm ring-1 ring-inset ring-line">
                <p className="t-eyebrow mb-3">You differ most on</p>
                <p className="t-h3 text-ink">{result.weakest.meta.label}</p>
                <p className="t-body-sm mt-2.5">
                  Only {result.weakest.pct}% overlap on {result.weakest.meta.divided}.
                </p>
              </div>
            )}
          </div>
          )}

          <div className="rounded-[28px] bg-surface p-7 shadow-sm ring-1 ring-inset ring-line">
            <p className="t-eyebrow mb-6">By the numbers</p>
            <div className="space-y-4">
              {result.dimensionScores.map((d) => (
                <div key={d.meta.id}>
                  <div className="mb-2 flex items-baseline justify-between gap-3">
                    <span className="text-[14px] font-bold tracking-[-0.018em] text-ink">
                      {d.meta.label}
                    </span>
                    <span className="t-num text-[13px] font-bold text-ink-muted">{d.pct}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-pill bg-surface-sunken">
                    <div
                      className="h-full rounded-pill transition-[width] duration-[900ms] ease-out"
                      style={{
                        width: `${Math.max(3, d.pct)}%`,
                        background:
                          d.pct >= 70
                            ? "linear-gradient(90deg, var(--mint-mid), var(--sky-mid))"
                            : d.pct >= 45
                              ? "var(--text)"
                              : "var(--blush-mid)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="t-body-sm mt-7">{result.observation}</p>
            <p className="t-caption mt-4 leading-relaxed">
              None of this is science. It&rsquo;s weighted so that how you argue counts for more
              than how you take your coffee, and that&rsquo;s about as rigorous as it gets.
            </p>
          </div>

          <div className="rounded-[28px] bg-surface p-7 shadow-sm ring-1 ring-inset ring-line">
            <p className="t-eyebrow mb-5">Answer by answer</p>
            <div className="space-y-3">
              {result.rows.map((row) => (
                <div key={row.q.id} className="rounded-[18px] bg-surface-muted p-5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[14px] font-bold leading-snug tracking-[-0.015em] text-ink">
                      {row.q.question}
                    </p>
                    <Pill
                      tone={row.kind === "same" ? "good" : row.kind === "near" ? "info" : "warn"}
                    >
                      {row.kind === "same" ? "same" : row.kind === "near" ? "close" : "apart"}
                    </Pill>
                  </div>
                  <div className="mt-3 grid gap-1.5 text-[13.5px] sm:grid-cols-2">
                    <p className="text-ink-muted">
                      You:{" "}
                      <span className="font-semibold text-ink">
                        {row.mine !== undefined ? row.q.options[row.mine] : "—"}
                      </span>
                    </p>
                    <p className="text-ink-muted">
                      {other?.name}:{" "}
                      <span className="font-semibold text-ink">
                        {row.theirs !== undefined ? row.q.options[row.theirs] : "—"}
                      </span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <MemoryMoment
            onSave={() =>
              saveMemory({
                experienceId: "love-match",
                title: `Love Match — ${result.verdict.headline}`,
                detail: result.hasStandout
                  ? `Closest on ${result.strongest?.meta.label ?? "—"}, furthest on ${result.weakest?.meta.label ?? "—"}.`
                  : "Evenly matched across every dimension.",
              })
            }
            onAgain={() => {
              setIndex(0);
              void setData((c) => ({ ...DEFAULTS, round: (c.round ?? 0) + 1 }));
              void update({ status: "active" });
            }}
            againLabel="Take it again"
          />
        </div>
      </GameShell>
    );
  }

  // --- answering -----------------------------------------------------------

  if (iFinished) {
    return (
      <GameShell title="Love Match" step={questions.length} totalSteps={questions.length}>
        <div className="mx-auto max-w-md">
          <WaitingForPartner
            label={`all ${questions.length} answered`}
            detail={
              other
                ? `Nothing is shown until ${other.name} has finished too.`
                : "Invite them — the score needs two sets of answers."
            }
          />
        </div>
      </GameShell>
    );
  }

  const answeredCount = Object.keys(myAnswers).length;
  const dimension = MATCH_DIMENSIONS.find((d) => d.id === question.dimension);

  return (
    <GameShell
      title="Love Match"
      step={answeredCount + 1}
      totalSteps={questions.length}
      hint="Answer honestly, not strategically. They can't see any of it yet."
    >
      <div className="mx-auto max-w-xl">
        <QuestionCard eyebrow={dimension?.label ?? "Question"} question={question.question}>
          <div className="space-y-2.5">
            {question.options.map((option, i) => (
              <AnswerOption
                key={option}
                index={i}
                label={option}
                selected={myAnswers[question.id] === i}
                disabled={myAnswers[question.id] !== undefined}
                onClick={() => choose(i)}
              />
            ))}
          </div>
        </QuestionCard>

        <div className="mt-6 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
          >
            Back
          </Button>
          <span className={cn("t-caption")}>
            {answeredCount} of {questions.length} answered
          </span>
          <Button
            variant="ghost"
            onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
            disabled={index >= questions.length - 1}
          >
            Skip
          </Button>
        </div>
      </div>
    </GameShell>
  );
}
