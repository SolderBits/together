import { ExperienceCard } from "./experience-card";
import type { Experience } from "@/lib/experiences";
import { cn } from "@/lib/utils";

/**
 * Six columns on desktop, two on tablet, one on phone. Card `size` maps onto
 * spans so the rows resolve into a deliberate rhythm — 4+2, 2+2+2, 2+4, 3+3 —
 * rather than a uniform tile wall.
 */
const SPAN: Record<Experience["size"], string> = {
  sm: "lg:col-span-2",
  md: "lg:col-span-3",
  lg: "lg:col-span-4",
  band: "sm:col-span-2 lg:col-span-6",
};

export function ExperienceGrid({
  experiences,
  className,
}: {
  experiences: Experience[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-6 lg:gap-6",
        className,
      )}
    >
      {experiences.map((experience, i) => (
        <div key={experience.id} className={SPAN[experience.size]}>
          <ExperienceCard experience={experience} index={i} />
        </div>
      ))}
    </div>
  );
}

/**
 * The secondary shelf. These sit at a third of the width, where the main grid's
 * side-by-side composition would squeeze the copy — so they stack the art above
 * the text instead, which also visually separates the shelf from the library.
 */
export function ExperienceList({ experiences }: { experiences: Experience[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6">
      {experiences.map((experience, i) => (
        <ExperienceCard key={experience.id} experience={experience} index={i} variant="stack" />
      ))}
    </div>
  );
}
