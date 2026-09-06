import { ExperienceList } from "@/components/experiences/experience-grid";
import { MoodFilter } from "@/components/experiences/mood-filter";
import { FlagshipCard } from "@/components/experiences/flagship-card";
import { HeroActions } from "@/components/layout/hero-actions";
import { HeroCollage } from "@/components/layout/hero-collage";
import { PageShell } from "@/components/layout/page-shell";
import { SectionHead } from "@/components/ui/card";
import { ResumeRooms } from "@/components/room/resume-rooms";
import { MORE_EXPERIENCES, getExperience } from "@/lib/experiences";

const photobooth = getExperience("photobooth")!;
const moreShelf = MORE_EXPERIENCES.filter((e) => e.id !== "photobooth");

export default function HomePage() {
  return (
    <>
      {/* ---------------- hero ---------------- */}
      <PageShell className="pb-4 pt-10 sm:pt-16">
        <section className="grid items-center gap-14 lg:grid-cols-[1.08fr_0.92fr] lg:gap-10">
          <div className="max-w-[600px]">
            <p className="t-eyebrow a-rise mb-6">Twenty things · built for two</p>
            {/* The break is desktop-only; on a phone the line wraps naturally and
                the full stop stays welded to "person". */}
            <h1 className="t-display a-rise d-1 text-balance text-ink">
              Things to do
              <br className="hidden sm:block" />
              with <span className="t-serif">your</span> person.
            </h1>
            <p className="t-body a-rise d-2 mt-7 max-w-[46ch] text-[17px]">
              Quizzes, drawings, debates and photo strips. Same sofa or opposite time zones — one
              of you starts, the other joins with a six-character code.
            </p>
            <div className="a-rise d-3">
              <HeroActions />
            </div>
          </div>

          <div className="a-rise d-2 order-first w-full lg:order-none">
            <HeroCollage />
          </div>
        </section>
      </PageShell>

      {/* ---------------- resume ---------------- */}
      <PageShell className="pt-16 sm:pt-24">
        <ResumeRooms />
      </PageShell>

      {/* ---------------- the grid ---------------- */}
      <PageShell className="pt-10 sm:pt-14">
        <MoodFilter />
      </PageShell>

      {/* ---------------- flagship ---------------- */}
      <PageShell className="pt-20 sm:pt-28">
        <FlagshipCard experience={photobooth} />
      </PageShell>

      {/* ---------------- more ---------------- */}
      <PageShell className="pt-20 sm:pt-28">
        <SectionHead
          eyebrow="More"
          title={
            <>
              Things that <span className="t-serif">keep</span>
            </>
          }
        />
        <ExperienceList experiences={moreShelf} />
      </PageShell>
    </>
  );
}
