"use client";

import { useMemo, useState } from "react";
import { ExperienceGrid } from "./experience-grid";
import { SectionHead } from "@/components/ui/card";
import { MAIN_EXPERIENCES, MOODS, experiencesInMood, type Mood } from "@/lib/experiences";
import { cn } from "@/lib/utils";

/**
 * One row of quiet chips above the grid.
 *
 * Deliberately not a sidebar, not facets, not a dashboard — just a way to say
 * "I want to talk" or "I want to compete" and have the grid answer. The card
 * sizes are preserved, so the composition stays art-directed either way.
 */
export function MoodFilter() {
  const [moods, setMoods] = useState<Mood[]>([]);

  /**
   * The catalogue is read here rather than passed in: experiences carry an icon
   * component, which can't cross the server/client boundary as a prop.
   */
  const filtered = useMemo(() => experiencesInMood(MAIN_EXPERIENCES, moods), [moods]);

  function toggle(mood: Mood) {
    setMoods((current) =>
      current.includes(mood) ? current.filter((m) => m !== mood) : [...current, mood],
    );
  }

  return (
    <>
      <SectionHead
        eyebrow="The library"
        title="Pick something"
        aside={
          <div className="hidden flex-wrap items-center gap-1.5 sm:flex">
            {MOODS.map((mood) => {
              const on = moods.includes(mood.id);
              return (
                <button
                  key={mood.id}
                  type="button"
                  title={mood.blurb}
                  onClick={() => toggle(mood.id)}
                  className={cn(
                    "rounded-pill px-3.5 py-2 text-[12.5px] font-bold tracking-[-0.01em]",
                    "transition-all duration-250 ease-out",
                    on
                      ? "bg-ink text-ink-inverse shadow-sm"
                      : "bg-surface text-ink-muted shadow-xs ring-1 ring-inset ring-line hover:-translate-y-[1px] hover:text-ink",
                  )}
                >
                  {mood.label}
                </button>
              );
            })}
            {moods.length > 0 && (
              <button
                type="button"
                onClick={() => setMoods([])}
                className="rounded-pill px-3 py-2 text-[12.5px] font-bold text-ink-faint transition-colors hover:text-ink"
              >
                Clear
              </button>
            )}
          </div>
        }
      />

      {/* the same chips, scrollable, on phones */}
      <div className="no-scrollbar -mx-gutter mb-6 flex gap-1.5 overflow-x-auto px-gutter sm:hidden">
        {MOODS.map((mood) => {
          const on = moods.includes(mood.id);
          return (
            <button
              key={mood.id}
              type="button"
              onClick={() => toggle(mood.id)}
              className={cn(
                "shrink-0 rounded-pill px-4 py-2.5 text-[13px] font-bold tracking-[-0.01em] transition-all duration-250",
                on
                  ? "bg-ink text-ink-inverse shadow-sm"
                  : "bg-surface text-ink-muted shadow-xs ring-1 ring-inset ring-line",
              )}
            >
              {mood.label}
            </button>
          );
        })}
      </div>

      {filtered.length ? (
        <ExperienceGrid experiences={filtered} />
      ) : (
        <p className="t-body py-12 text-center">Nothing in that combination.</p>
      )}
    </>
  );
}
