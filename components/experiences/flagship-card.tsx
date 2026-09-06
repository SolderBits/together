import Link from "next/link";
import { ArtPhotobooth } from "@/components/art/scenes";
import { Pill } from "@/components/ui/badge";
import { experienceHref, paletteVars, type Experience } from "@/lib/experiences";

/**
 * The Photobooth gets a band of its own rather than another tile — it is the
 * flagship, and the grid says so by giving it width, air and a warm wash.
 */
export function FlagshipCard({ experience }: { experience: Experience }) {
  const p = paletteVars(experience.palette);

  return (
    <Link
      href={experienceHref(experience)}
      className="group/flag a-rise relative block overflow-hidden rounded-[36px] ring-1 ring-inset ring-line shadow-sm transition-[transform,box-shadow] duration-[420ms] ease-out hover:-translate-y-1.5 hover:shadow-card-hover sm:rounded-[44px]"
    >
      <span
        className="absolute inset-0"
        style={{
          background: `linear-gradient(112deg, ${p.tint} 0%, var(--surface) 46%, var(--sky-tint) 100%)`,
        }}
        aria-hidden="true"
      />
      <span className="grain absolute inset-0" aria-hidden="true" />

      <div className="relative grid items-center gap-8 p-8 sm:p-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-6 lg:p-16">
        <div className="max-w-[460px]">
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <Pill tone="accent" accent={experience.palette}>
              Flagship
            </Pill>
            <Pill tone="neutral">{experience.players}</Pill>
          </div>

          <h2 className="t-display text-ink" style={{ fontSize: "clamp(2.5rem,1.6rem+3.4vw,4rem)" }}>
            Photo<span className="t-serif">booth</span>
          </h2>

          <p className="t-body mt-5 max-w-[38ch]">
            Two cameras, one countdown, four shots taken at exactly the same moment. Pick a frame,
            add a caption, and take away a strip worth printing.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-2.5">
            {["Synced capture", "Six frames", "Print resolution"].map((f) => (
              <span
                key={f}
                className="rounded-pill bg-surface/80 px-3.5 py-2 text-[12.5px] font-semibold text-ink-soft ring-1 ring-inset ring-line backdrop-blur-sm"
              >
                {f}
              </span>
            ))}
          </div>

          <span className="mt-9 inline-flex h-[52px] items-center gap-2.5 rounded-pill bg-ink px-7 text-[15px] font-semibold text-ink-inverse shadow-sm transition-transform duration-300 ease-out group-hover/flag:-translate-y-[2px]">
            Open the booth
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h13M12.5 6l6 6-6 6" />
            </svg>
          </span>
        </div>

        <div className="relative mx-auto w-full max-w-[420px] lg:max-w-none">
          <ArtPhotobooth
            tint={p.tint}
            mid={p.mid}
            deep={p.deep}
            className="h-auto w-full transition-transform duration-[620ms] ease-out group-hover/flag:scale-[1.03]"
          />
        </div>
      </div>
    </Link>
  );
}
