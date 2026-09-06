"use client";

import type { RoomPlayer } from "@/lib/rooms/types";
import { cn } from "@/lib/utils";

export interface ScoreRow {
  id: string;
  name: string;
  emoji: string;
  score: number;
  detail?: string;
}

/** Two bars, honest proportions, no chrome. */
export function ScoreBoard({
  rows,
  max,
  title = "Score",
  className,
}: {
  rows: ScoreRow[];
  max?: number;
  title?: string;
  className?: string;
}) {
  const top = Math.max(1, max ?? Math.max(...rows.map((r) => r.score), 1));
  const leader = Math.max(...rows.map((r) => r.score), 0);
  const tie = rows.filter((r) => r.score === leader).length > 1;

  return (
    <div
      className={cn(
        "rounded-[28px] bg-surface p-7 shadow-sm ring-1 ring-inset ring-line",
        className,
      )}
    >
      <p className="t-eyebrow mb-6">{title}</p>
      <div className="space-y-5">
        {rows.map((row) => {
          // Nobody is "ahead" of themselves — a solo run has no leader.
          const winning = rows.length > 1 && !tie && row.score === leader && leader > 0;
          return (
            <div key={row.id}>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <span className="flex items-center gap-2.5 text-[14.5px] font-bold tracking-[-0.02em] text-ink">
                  <span className="text-[16px]">{row.emoji}</span>
                  {row.name}
                  {winning && (
                    <span className="t-eyebrow text-blush-deep" style={{ letterSpacing: "0.1em" }}>
                      ahead
                    </span>
                  )}
                </span>
                <span className="t-num text-[18px] font-extrabold text-ink">{row.score}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-pill bg-surface-sunken">
                <div
                  className="h-full rounded-pill transition-[width] duration-[800ms] ease-out"
                  style={{
                    width: `${Math.max(3, (row.score / top) * 100)}%`,
                    background: winning
                      ? "linear-gradient(90deg, var(--blush-mid), var(--lilac-mid))"
                      : "var(--text)",
                  }}
                />
              </div>
              {row.detail && <p className="t-caption mt-2">{row.detail}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function scoreRows(
  players: RoomPlayer[],
  scores: Record<string, number>,
  meId?: string,
): ScoreRow[] {
  return players.map((p) => ({
    id: p.id,
    name: p.id === meId ? "You" : p.name,
    emoji: p.emoji,
    score: scores[p.id] ?? 0,
  }));
}

/** The payoff screen's headline. */
export function ResultBanner({
  headline,
  sub,
  tone = "neutral",
}: {
  headline: string;
  sub?: string;
  tone?: "neutral" | "win" | "tie";
}) {
  return (
    <div
      className="a-pop relative overflow-hidden rounded-[36px] p-10 text-center shadow-sm ring-1 ring-inset ring-line sm:p-14"
      style={{
        background:
          tone === "win"
            ? "linear-gradient(128deg, var(--blush-tint), var(--surface) 48%, var(--sky-tint))"
            : tone === "tie"
              ? "linear-gradient(128deg, var(--surface-secondary), var(--surface))"
              : "var(--surface)",
      }}
    >
      <span className="grain absolute inset-0" aria-hidden="true" />
      <div className="relative">
        <h3 className="t-h1 text-balance text-ink">{headline}</h3>
        {sub && <p className="t-body mx-auto mt-4 max-w-[42ch] text-[15.5px]">{sub}</p>}
      </div>
    </div>
  );
}
