"use client";

import { useEffect, useState } from "react";
import { PageHeading, PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/badge";
import {
  ColorMatchGame,
  DontBlinkGame,
  HigherLowerGame,
  MemoryGame,
  NumberGame,
  QuickTapGame,
  ReactionGame,
  SequenceGame,
} from "./games";
import { bestScore, listScores } from "./scores";
import { useRecordCompletion } from "@/lib/store/use-completion";
import { cn } from "@/lib/utils";

const GAMES = [
  {
    id: "reaction",
    title: "Reaction",
    blurb: "wait for green, tap fast",
    unit: "ms",
    lowerIsBetter: true,
    tint: "var(--blush-tint)",
    Component: ReactionGame,
  },
  {
    id: "memory",
    title: "Memory match",
    blurb: "six pairs, fewest moves",
    unit: "pts",
    lowerIsBetter: false,
    tint: "var(--sky-tint)",
    Component: MemoryGame,
  },
  {
    id: "quick-tap",
    title: "Quick tap",
    blurb: "ten seconds, all thumbs",
    unit: "taps",
    lowerIsBetter: false,
    tint: "var(--butter-tint)",
    Component: QuickTapGame,
  },
  {
    id: "color-match",
    title: "Colour match",
    blurb: "word vs ink, don't be fooled",
    unit: "pts",
    lowerIsBetter: false,
    tint: "var(--lilac-tint)",
    Component: ColorMatchGame,
  },
  {
    id: "number",
    title: "Number challenge",
    blurb: "mental maths sprint",
    unit: "pts",
    lowerIsBetter: false,
    tint: "var(--mint-tint)",
    Component: NumberGame,
  },
  {
    id: "dont-blink",
    title: "Don't blink",
    blurb: "count what you barely saw",
    unit: "levels",
    lowerIsBetter: false,
    tint: "var(--peach-tint)",
    Component: DontBlinkGame,
  },
  {
    id: "higher-lower",
    title: "Higher or lower",
    blurb: "one number at a time",
    unit: "streak",
    lowerIsBetter: false,
    tint: "var(--sky-tint)",
    Component: HigherLowerGame,
  },
  {
    id: "sequence",
    title: "Memory sequence",
    blurb: "watch it, then repeat it",
    unit: "steps",
    lowerIsBetter: false,
    tint: "var(--lilac-tint)",
    Component: SequenceGame,
  },
] as const;

export function Arcade() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [played, setPlayed] = useState(0);
  /**
   * Scores live in localStorage, which the server can't see. Reading them
   * during render would make the server and client markup disagree, so they are
   * loaded after mount and refreshed whenever a run finishes.
   */
  const [bests, setBests] = useState<Record<string, string> | null>(null);
  const [totalPlays, setTotalPlays] = useState(0);

  const active = GAMES.find((g) => g.id === activeId) ?? null;

  useRecordCompletion("arcade", played >= 3, String(Math.floor(played / 3)));

  useEffect(() => {
    const read = () => {
      setBests(
        Object.fromEntries(
          GAMES.map((g) => [g.id, formatBest(g.id, g.lowerIsBetter, g.unit)]),
        ),
      );
      setTotalPlays(listScores().length);
    };
    read();
    window.addEventListener("together:store-change", read);
    return () => window.removeEventListener("together:store-change", read);
  }, []);

  const bestFor = (id: string) => bests?.[id] ?? "—";

  if (active) {
    const Component = active.Component;
    return (
      <PageShell width="narrow" className="pb-24 pt-8 sm:pt-12">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="t-eyebrow">
              Arcade
            </p>
            <h1 className="t-h2 mt-1 text-ink">{active.title}</h1>
          </div>
          <Button variant="soft" onClick={() => setActiveId(null)}>
            All games
          </Button>
        </div>

        <Component onScore={() => setPlayed((p) => p + 1)} />

        <div className="mt-7 flex justify-center">
          <Pill tone="neutral">
            {bests?.[active.id] && bests[active.id] !== "—"
              ? `Your best: ${bests[active.id]}`
              : "No record yet — this run sets it"}
          </Pill>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell className="pb-24 pt-10 sm:pt-14">
      <PageHeading
        align="center"
        eyebrow="Arcade"
        title={
          <>
            Eight small games, <span className="t-serif">fast</span>
          </>
        }
        subtitle="Short enough to hand the phone over mid-round. Best scores stay on this device."
      />

      <div className="mt-9 grid gap-3 sm:gap-4 lg:grid-cols-2">
        {GAMES.map((game, i) => (
          <button
            key={game.id}
            type="button"
            onClick={() => setActiveId(game.id)}
            className={cn(
              "group flex animate-fade-up items-center gap-4 rounded-3xl ring-1 ring-inset ring-line bg-surface p-5 text-left shadow-sm transition-all",
              "hover:-translate-y-1 hover:ring-line-strong hover:shadow-card-hover sm:p-6",
            )}
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <span
              className="grid h-14 w-14 shrink-0 place-items-center rounded-[20px] transition-transform duration-[380ms] ease-spring group-hover:rotate-[-4deg] group-hover:scale-105"
              style={{ backgroundColor: game.tint }}
              aria-hidden="true"
            >
              <GameGlyph id={game.id} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="t-h4 block text-ink">{game.title}</span>
              <span className="t-body-sm mt-1 block">{game.blurb}</span>
            </span>
            <span className="shrink-0 text-right">
              <span className="t-eyebrow block">Best</span>
              <span className="t-num mt-0.5 block text-[15px] font-extrabold text-ink">
                {bestFor(game.id)}
              </span>
            </span>
          </button>
        ))}
      </div>

      {totalPlays > 0 && (
        <p className="t-caption mt-10 text-center">{totalPlays} rounds played on this device.</p>
      )}
    </PageShell>
  );
}

/** Tiny original glyphs, one per minigame — no emoji, no icon library. */
function GameGlyph({ id }: { id: string }) {
  const stroke = { stroke: "var(--text)", strokeWidth: 2, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (id === "reaction")
    return (
      <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
        <path d="M13.5 2.5 5 13.5h5.5L9.5 21.5 19 10h-5.5l0-7.5Z" {...stroke} />
      </svg>
    );
  if (id === "memory")
    return (
      <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
        <rect x="3" y="4" width="8" height="8" rx="2.4" {...stroke} />
        <rect x="13" y="4" width="8" height="8" rx="2.4" {...stroke} />
        <rect x="3" y="14" width="8" height="6" rx="2.4" {...stroke} />
        <rect x="13" y="14" width="8" height="6" rx="2.4" {...stroke} />
      </svg>
    );
  if (id === "quick-tap")
    return (
      <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
        <path d="M10 11V5.5a2 2 0 0 1 4 0V13l3-1.6a2 2 0 0 1 2.8 2.2l-1.2 5A3.4 3.4 0 0 1 15.3 21H12a5 5 0 0 1-5-5v-3.4a2 2 0 0 1 3-1.6Z" {...stroke} />
      </svg>
    );
  if (id === "color-match")
    return (
      <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
        <circle cx="9" cy="9" r="5.5" {...stroke} />
        <circle cx="15" cy="15" r="5.5" {...stroke} />
      </svg>
    );
  if (id === "dont-blink")
    return (
      <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
        <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z" {...stroke} />
        <circle cx="12" cy="12" r="3" {...stroke} />
      </svg>
    );
  if (id === "higher-lower")
    return (
      <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
        <path d="M8 20V5m0 0L4.5 8.5M8 5l3.5 3.5" {...stroke} />
        <path d="M16 4v15m0 0 3.5-3.5M16 19l-3.5-3.5" {...stroke} />
      </svg>
    );
  if (id === "number")
    return (
      <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
        <path d="M4 8.5h16M4 15.5h16M9.5 3.5 8 20.5M16 3.5l-1.5 17" {...stroke} />
      </svg>
    );
  if (id === "sequence")
    return (
      <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
        <rect x="3" y="3" width="7.5" height="7.5" rx="2.2" {...stroke} />
        <rect x="13.5" y="3" width="7.5" height="7.5" rx="2.2" {...stroke} />
        <rect x="3" y="13.5" width="7.5" height="7.5" rx="2.2" {...stroke} />
        <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2.2" {...stroke} />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
      <path d="M5 4h6v6H5zM13 4h6v6h-6zM5 14h6v6H5zM13 14h6v6h-6z" {...stroke} />
    </svg>
  );
}

function formatBest(gameId: string, lowerIsBetter: boolean, unit: string) {
  const best = bestScore(gameId, lowerIsBetter);
  return best === null ? "—" : `${best} ${unit}`;
}
