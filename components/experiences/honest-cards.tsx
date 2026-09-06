"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeading, PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/badge";
import {
  CARD_CATEGORIES,
  CARD_INTENSITIES,
  HONEST_CARDS,
  cardsFor,
  type CardCategory,
  type CardIntensity,
  type HonestCard,
} from "@/lib/games/content/honest-cards";
import { pickFresh, recentIds } from "@/lib/games/content/pick";
import { listFavouriteCards, toggleFavouriteCard } from "@/lib/store";
import { useRecordCompletion } from "@/lib/store/use-completion";
import { cn } from "@/lib/utils";

const BUCKET = "honest-cards";

export function HonestCards() {
  const [categories, setCategories] = useState<CardCategory[]>([]);
  const [intensities, setIntensities] = useState<CardIntensity[]>(["low"]);
  const [card, setCard] = useState<HonestCard | null>(null);
  const [favourites, setFavourites] = useState<string[]>([]);
  const [flipping, setFlipping] = useState(false);
  const [drawn, setDrawn] = useState(0);
  const [skipped, setSkipped] = useState(0);

  const pool = useMemo(() => cardsFor(categories, intensities), [categories, intensities]);

  /** Draws a card that hasn't come up recently in this session. */
  const draw = useCallback(
    (asSkip = false) => {
      setFlipping(true);
      if (asSkip) setSkipped((n) => n + 1);
      else setDrawn((n) => n + 1);
      setTimeout(() => {
        setCard(pickFresh(pool, BUCKET));
        setFlipping(false);
      }, 170);
    },
    [pool],
  );

  useEffect(() => setFavourites(listFavouriteCards()), []);

  // Re-draw whenever the filters change the available pool.
  useEffect(() => {
    setCard(pickFresh(pool, BUCKET));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool]);

  useRecordCompletion("honest-cards", drawn >= 5, String(Math.floor(drawn / 5)));

  const meta = card ? CARD_CATEGORIES.find((c) => c.id === card.category)! : null;
  const isFavourite = card ? favourites.includes(card.id) : false;
  const favouriteCards = HONEST_CARDS.filter((c) => favourites.includes(c.id));
  const seenThisSession = recentIds(BUCKET).length;

  function toggleCategory(id: CardCategory) {
    setCategories((current) =>
      current.includes(id) ? current.filter((c) => c !== id) : [...current, id],
    );
  }

  function toggleIntensity(id: CardIntensity) {
    setIntensities((current) => {
      const next = current.includes(id) ? current.filter((c) => c !== id) : [...current, id];
      return next.length ? next : [id];
    });
  }

  return (
    <PageShell width="reading" className="pb-24 pt-10 sm:pt-14">
      <PageHeading
        align="center"
        eyebrow="Honest Cards"
        title={
          <>
            The questions you keep <span className="t-serif">avoiding</span>
          </>
        }
        subtitle="One card at a time. No score, no timer — answer it properly, or draw another."
      />

      {/* ---- how deep do you want to go ---- */}
      <div className="mt-12 flex flex-col items-center gap-5">
        <div className="flex rounded-pill bg-surface-sunken p-1.5">
          {CARD_INTENSITIES.map((level) => {
            const on = intensities.includes(level.id);
            return (
              <button
                key={level.id}
                type="button"
                onClick={() => toggleIntensity(level.id)}
                title={level.blurb}
                className={cn(
                  "rounded-pill px-5 py-2.5 text-[13px] font-bold tracking-[-0.01em] transition-all duration-300 ease-out",
                  on ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink",
                )}
              >
                {level.label}
              </button>
            );
          })}
        </div>
        <p className="t-caption mx-auto max-w-[46ch] text-center leading-relaxed">
          {CARD_INTENSITIES.filter((l) => intensities.includes(l.id))
            .map((l) => l.promise)
            .join(" ")}
        </p>
      </div>

      <div className="mt-7 flex flex-wrap justify-center gap-2">
        {CARD_CATEGORIES.map((category) => {
          const on = categories.includes(category.id);
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => toggleCategory(category.id)}
              className={cn(
                "rounded-pill px-4 py-2.5 text-[13px] font-bold tracking-[-0.01em] transition-all duration-250 ease-out",
                on
                  ? "bg-ink text-ink-inverse shadow-sm"
                  : "bg-surface text-ink-muted shadow-xs ring-1 ring-inset ring-line hover:-translate-y-[1px] hover:text-ink",
              )}
            >
              {category.label}
              <span className={cn("ml-1.5 text-[11px] font-medium", on ? "text-white/55" : "text-ink-faint")}>
                {category.blurb}
              </span>
            </button>
          );
        })}
        {categories.length > 0 && (
          <button
            type="button"
            onClick={() => setCategories([])}
            className="rounded-pill px-3.5 py-2.5 text-[13px] font-bold text-ink-faint transition-colors hover:text-ink"
          >
            Everything
          </button>
        )}
      </div>

      {card && meta ? (
        <>
          {/* a deck, not a div: two offset layers sit behind the live card */}
          <div className="relative mx-auto mt-10 max-w-[560px] sm:mt-12">
            <span
              className="absolute inset-x-7 top-4 h-full rounded-[34px] bg-surface opacity-70 shadow-xs ring-1 ring-inset ring-line"
              aria-hidden="true"
            />
            <span
              className="absolute inset-x-3.5 top-2 h-full rounded-[34px] bg-surface opacity-90 shadow-xs ring-1 ring-inset ring-line"
              aria-hidden="true"
            />

            <div
              className={cn(
                "relative flex min-h-[320px] flex-col rounded-[34px] p-9 shadow-card ring-1 ring-inset ring-line transition-all duration-200 ease-out sm:min-h-[360px] sm:p-12",
                flipping ? "scale-[0.985] opacity-0" : "a-scale opacity-100",
              )}
              style={{ background: `linear-gradient(168deg, ${meta.tint} -6%, var(--surface) 62%)` }}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="t-eyebrow" style={{ color: meta.accent }}>
                  {meta.label}
                </span>
                <span className="t-eyebrow" title={meta.blurb}>
                  {CARD_INTENSITIES.find((l) => l.id === card.intensity)?.label}
                </span>
              </div>

              <p className="t-h1 mt-auto text-balance text-ink">{card.question}</p>

              <span
                className="mt-8 block h-1 w-12 rounded-pill"
                style={{ background: meta.accent }}
                aria-hidden="true"
              />
            </div>
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button size="xl" onClick={() => draw(false)}>
              Next card
            </Button>
            <Button
              size="xl"
              variant={isFavourite ? "primary" : "secondary"}
              onClick={() => setFavourites(toggleFavouriteCard(card.id))}
            >
              {isFavourite ? "Saved" : "Save this one"}
            </Button>
            <Button size="xl" variant="ghost" onClick={() => draw(true)}>
              Skip
            </Button>
          </div>

          <div className="mt-7 flex flex-wrap justify-center gap-2">
            <Pill tone="neutral">{pool.length} cards in this mix</Pill>
            {seenThisSession > 0 && <Pill tone="neutral">{seenThisSession} seen today</Pill>}
            {skipped > 0 && <Pill tone="neutral">{skipped} skipped</Pill>}
          </div>
        </>
      ) : (
        <p className="t-body mt-10 text-center">No cards match that combination.</p>
      )}

      {favouriteCards.length > 0 && (
        <div className="mt-16">
          <div className="mb-5 flex items-baseline justify-between">
            <p className="t-eyebrow">Saved cards</p>
            <Pill>{favouriteCards.length}</Pill>
          </div>
          <div className="space-y-2.5">
            {favouriteCards.map((favourite) => {
              const favMeta = CARD_CATEGORIES.find((c) => c.id === favourite.category)!;
              return (
                <div
                  key={favourite.id}
                  className="flex items-start gap-3.5 rounded-[20px] bg-surface p-5 shadow-sm ring-1 ring-inset ring-line"
                >
                  <span
                    className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: favMeta.accent }}
                    aria-hidden="true"
                  />
                  <p className="flex-1 text-[14.5px] font-semibold leading-snug tracking-[-0.015em] text-ink">
                    {favourite.question}
                  </p>
                  <button
                    type="button"
                    onClick={() => setFavourites(toggleFavouriteCard(favourite.id))}
                    className="text-[12.5px] font-semibold text-ink-faint transition-colors hover:text-ink"
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </PageShell>
  );
}
