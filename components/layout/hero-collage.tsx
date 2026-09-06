import { ArtDrawTogether, ArtLoveMatch, ArtPhotobooth } from "@/components/art/scenes";

/**
 * The hero's counterweight: three cards from the product, stacked the way
 * they'd land on a table. Drawn, not photographed, and gently drifting so the
 * page has exactly one moving thing in it.
 *
 * The two back cards label above the art and the front one below, so nothing
 * covers a caption at any width.
 */
export function HeroCollage() {
  return (
    <div
      className="relative mx-auto aspect-[5/4] w-full max-w-[320px] sm:max-w-[430px] lg:ml-auto lg:mr-0 lg:max-w-[500px]"
      aria-hidden="true"
    >
      <span
        className="absolute inset-[4%] rounded-[50%] blur-3xl"
        style={{
          background:
            "radial-gradient(circle at 30% 32%, var(--blush-tint), transparent 62%), radial-gradient(circle at 74% 68%, var(--sky-tint), transparent 60%)",
        }}
      />

      <figure
        className="a-drift absolute left-0 top-[6%] z-0 w-[44%] rotate-[-7deg] rounded-[22px] bg-surface p-3 shadow-card ring-1 ring-inset ring-line sm:rounded-[26px] sm:p-3.5"
        style={{ animationDelay: "0.6s" }}
      >
        <figcaption className="t-eyebrow mb-2 px-0.5 text-[9px]">Draw together</figcaption>
        <ArtDrawTogether className="h-auto w-full" />
      </figure>

      <figure className="a-drift absolute right-0 top-0 z-10 w-[43%] rotate-[6deg] rounded-[22px] bg-surface p-3 shadow-card ring-1 ring-inset ring-line sm:rounded-[26px] sm:p-3.5">
        <figcaption className="t-eyebrow mb-2 px-0.5 text-[9px]">Love match</figcaption>
        <ArtLoveMatch className="h-auto w-full" />
      </figure>

      <figure
        className="a-drift absolute bottom-0 left-[27%] z-20 w-[50%] rotate-[2deg] rounded-[22px] bg-surface p-3 shadow-card ring-1 ring-inset ring-line sm:rounded-[26px] sm:p-3.5"
        style={{ animationDelay: "1.4s" }}
      >
        <ArtPhotobooth className="h-auto w-full" />
        <figcaption className="t-eyebrow mt-2 px-0.5 text-[9px]">Photobooth</figcaption>
      </figure>
    </div>
  );
}
