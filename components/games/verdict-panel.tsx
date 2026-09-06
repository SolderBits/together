"use client";

import { Pill } from "@/components/ui/badge";
import type { Verdict } from "@/lib/ai/types";
import { cn } from "@/lib/utils";

export function VerdictPanel({ verdict, meId }: { verdict: Verdict; meId: string }) {
  const iWon = verdict.winnerId === meId;

  return (
    <div className="space-y-5">
      <div
        className="a-pop relative overflow-hidden rounded-[36px] p-10 text-center shadow-sm ring-1 ring-inset ring-line sm:p-14"
        style={{
          backgroundImage: verdict.winnerId
            ? "linear-gradient(128deg, var(--blush-tint), var(--lilac-tint) 52%, var(--sky-tint))"
            : "linear-gradient(128deg, var(--surface-secondary), var(--surface))",
        }}
      >
        <span className="grain absolute inset-0" aria-hidden="true" />
        <div className="relative">
        <p className="t-eyebrow">
          The verdict
        </p>
        <h2 className="t-h1 mt-4 text-balance text-ink">
          {verdict.headline}
        </h2>
        <p className="t-body mx-auto mt-5 max-w-[46ch] text-[15.5px] text-ink-soft">
          {verdict.reasoning}
        </p>
        {verdict.sentence && (
          <p className="mx-auto mt-7 max-w-[44ch] rounded-[20px] bg-surface/75 px-6 py-4 text-[14.5px] font-semibold text-ink shadow-xs backdrop-blur-sm">
            Sentence: {verdict.sentence}
          </p>
        )}
        {verdict.winnerId && (
          <p className="t-serif mt-6 text-[19px] text-ink-soft">
            {iWon ? "that's you." : "that isn't you."}
          </p>
        )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {verdict.players.map((player) => (
          <div
            key={player.playerId}
            className={cn(
              "rounded-[28px] bg-surface p-7 shadow-sm ring-1 ring-inset transition-shadow",
              player.playerId === verdict.winnerId ? "shadow-card ring-line-strong" : "ring-line",
            )}
          >
            <div className="mb-4 flex items-baseline justify-between">
              <div>
                <p className="text-[16px] font-extrabold tracking-[-0.025em] text-ink">
                  {player.playerId === meId ? "You" : player.name}
                </p>
                <p className="t-caption mt-0.5">{player.side}</p>
              </div>
              <p className="t-num text-[22px] font-extrabold text-ink">
                {player.total}
                <span className="text-[13px] font-bold text-ink-faint">/40</span>
              </p>
            </div>

            <div className="space-y-3.5">
              {player.criteria.map((criterion) => (
                <div key={criterion.id}>
                  <div className="mb-1 flex items-baseline justify-between text-[12.5px]">
                    <span className="font-bold tracking-[-0.01em] text-ink-soft">{criterion.label}</span>
                    <span className="t-num font-extrabold text-ink">
                      {criterion.score}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-pill bg-surface-sunken">
                    <div
                      className="h-full rounded-pill bg-ink transition-[width] duration-[800ms] ease-out"
                      style={{ width: `${criterion.score * 10}%` }}
                    />
                  </div>
                  {criterion.note && (
                    <p className="t-caption mt-2 leading-relaxed">
                      {criterion.note}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-center">
        <Pill tone={verdict.source === "ai" ? "info" : "neutral"}>
          {verdict.source === "ai"
            ? "Scored by the AI judge"
            : "Scored by the offline judge — add an API key for the AI one"}
        </Pill>
      </div>
    </div>
  );
}
