import Link from "next/link";
import { SCENES } from "@/components/art/scenes";
import { NewBadge } from "@/components/ui/badge";
import { experienceHref, paletteVars, type Experience } from "@/lib/experiences";
import { cn } from "@/lib/utils";

/**
 * One card, five compositions.
 *
 * Size drives layout, not just width: a feature card leads with type and lets
 * the illustration bleed off the side, a compact card tucks it into the corner,
 * a band runs horizontally, and the secondary shelf stacks art above the copy.
 * Combined with each experience's own pastel, no two cards read the same —
 * while all of them clearly come from the same place.
 */
export function ExperienceCard({
  experience,
  index = 0,
  variant,
}: {
  experience: Experience;
  index?: number;
  /** Overrides the catalogue size — used by the secondary shelf. */
  variant?: Experience["size"] | "stack";
}) {
  const Art = SCENES[experience.scene];
  const p = paletteVars(experience.palette);
  const size = variant ?? experience.size;

  const wash =
    size === "lg"
      ? `radial-gradient(118% 88% at 100% 100%, ${p.tint} 0%, transparent 60%)`
      : size === "band"
        ? `radial-gradient(66% 150% at 100% 50%, ${p.tint} 0%, transparent 66%)`
        : size === "stack"
          ? `radial-gradient(96% 62% at 50% 0%, ${p.tint} 0%, transparent 64%)`
          : size === "md"
            ? `radial-gradient(96% 106% at 100% 0%, ${p.tint} 0%, transparent 58%)`
            : `radial-gradient(86% 116% at 100% 0%, ${p.tint} 0%, transparent 56%)`;

  const arrow = (
    <span
      className={cn(
        "grid h-9 w-9 place-items-center rounded-pill text-ink ring-1 ring-inset ring-line",
        "transition-[background-color,color,box-shadow,transform] duration-[320ms] ease-out",
        "group-hover/card:bg-ink group-hover/card:text-ink-inverse group-hover/card:ring-ink",
      )}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 12h13M12.5 6l6 6-6 6" />
      </svg>
    </span>
  );

  return (
    <Link
      href={experienceHref(experience)}
      className={cn(
        "group/card a-rise relative flex h-full overflow-hidden rounded-4xl bg-surface ring-1 ring-inset ring-line",
        "shadow-sm transition-[transform,box-shadow] duration-[380ms] ease-out",
        "hover:-translate-y-1.5 hover:shadow-card-hover",
        size === "band" ? "flex-row items-center" : "flex-col",
        size === "lg" && "min-h-[336px] p-9 sm:p-11",
        size === "md" && "min-h-[256px] p-8 sm:p-9",
        size === "sm" && "min-h-[224px] p-8",
        size === "band" && "min-h-[212px] p-9 sm:p-12",
        size === "stack" && "min-h-[300px] p-8 sm:p-9",
      )}
      style={{ animationDelay: `${Math.min(index, 10) * 45}ms` }}
    >
      {/* the pastel wash — the only place an experience's colour touches the page */}
      <span className="pointer-events-none absolute inset-0" style={{ background: wash }} aria-hidden="true" />

      {/* ---- illustration ----
           Feature cards and bands bleed sideways only, never off the bottom, so
           no illustration ever looks accidentally cut off at its own baseline. */}
      {size !== "stack" && (
        <span
          className={cn(
            "pointer-events-none absolute transition-transform duration-[560ms] ease-out",
            size === "lg" &&
              "-right-4 bottom-0 w-[206px] group-hover/card:-translate-y-1.5 group-hover/card:scale-[1.03] sm:w-[252px]",
            size === "md" &&
              "right-6 top-1/2 w-[150px] -translate-y-1/2 group-hover/card:-translate-y-[calc(50%+6px)] sm:w-[172px]",
            size === "sm" &&
              "bottom-5 right-5 w-[112px] group-hover/card:-translate-y-1.5 group-hover/card:rotate-[-3deg] sm:w-[124px]",
            size === "band" &&
              "-right-4 top-1/2 w-[196px] -translate-y-1/2 group-hover/card:-translate-y-[calc(50%+6px)] sm:right-4 sm:w-[252px]",
          )}
          aria-hidden="true"
        >
          <Art tint={p.tint} mid={p.mid} deep={p.deep} className="h-auto w-full" />
        </span>
      )}

      {/* ---- copy ---- */}
      <span
        className={cn(
          "relative flex min-w-0 flex-1 flex-col",
          size === "lg" && "max-w-[58%]",
          size === "band" && "max-w-[56%] justify-center sm:max-w-[52%]",
        )}
      >
        {size === "stack" && (
          <span className="mb-7 block w-[142px]" aria-hidden="true">
            <Art
              tint={p.tint}
              mid={p.mid}
              deep={p.deep}
              className="h-auto w-full transition-transform duration-[560ms] ease-out group-hover/card:-translate-y-1.5 group-hover/card:rotate-[-3deg]"
            />
          </span>
        )}

        {(size === "lg" || size === "band") && (
          <span className="t-eyebrow mb-4 block">
            {experience.players} · {experience.minutes}
          </span>
        )}

        <span
          className={cn(
            "flex flex-wrap items-center gap-x-2.5 gap-y-2",
            size === "md" && "max-w-[54%]",
          )}
        >
          <span
            className={cn(
              "text-ink",
              (size === "lg" || size === "band") && "t-h2",
              (size === "md" || size === "sm" || size === "stack") && "t-h3",
            )}
          >
            {experience.title}
          </span>
          {experience.isNew && <NewBadge />}
        </span>

        <span
          className={cn(
            "t-body-sm mt-3 block",
            (size === "lg" || size === "band") && "text-[15px]",
            size === "md" && "max-w-[52%]",
            size === "sm" && "max-w-[76%]",
          )}
        >
          {experience.description}
        </span>

        {/* ---- affordance ---- */}
        <span
          className={cn(
            "relative z-10 flex items-center gap-2.5 self-start",
            size === "band" ? "mt-7" : "mt-auto pt-8",
          )}
        >
          {arrow}
          {(size === "lg" || size === "band" || size === "stack") && (
            <span className="text-[13.5px] font-semibold text-ink-faint transition-colors duration-300 group-hover/card:text-ink">
              Open
            </span>
          )}
        </span>
      </span>
    </Link>
  );
}
