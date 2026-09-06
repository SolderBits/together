import type { Metadata } from "next";
import { PageHeading, PageShell } from "@/components/layout/page-shell";
import { ButtonLink } from "@/components/ui/button";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "How it works",
  description: `How rooms, realtime sync and storage work in ${SITE.name}.`,
};

const SECTIONS = [
  {
    title: "Rooms",
    body: "One of you starts a room and gets a six-character code plus an invite link. The other opens the link or types the code. Nobody needs an account, and a refresh reconnects you to the same room.",
  },
  {
    title: "Realtime",
    body: "Every experience shares one room document and one event channel. With Supabase keys configured, that runs over Supabase Realtime and you can be on opposite sides of the world. Without them, it runs over BroadcastChannel — two tabs on one machine behave exactly like two devices, which is enough to try everything.",
  },
  {
    title: "Where things are saved",
    body: "Strips, scrapbook pages, letters, gifts, goals and arcade scores live in this browser's storage. Nothing is uploaded. You can export or delete all of it from your profile at any time.",
  },
  {
    title: "Photos and camera",
    body: "The photobooth and Snap Hunt ask for camera access only when you press the button, and every strip is composed on your own device with the Canvas API. If a camera isn't available or permission is refused, uploading a picture works everywhere the camera would have.",
  },
  {
    title: "The AI judge",
    body: "Debate and Couples Court score four things: argument, evidence, creativity and persuasiveness. If an API key is configured on the server, a model does the scoring — the key is only ever read server-side. If not, a deterministic offline judge runs instead and the verdict says which one you got.",
  },
  {
    title: "Letters",
    body: "Nothing is emailed. A letter is sealed on this device and unseals itself here on the date you chose. Wire up an email provider and the same letters can be delivered for real.",
  },
];

export default function AboutPage() {
  return (
    <PageShell width="narrow" className="pb-24 pt-10 sm:pt-14">
      <PageHeading
        eyebrow="How it works"
        title={
          <>
            No accounts, no uploads, no <span className="t-serif">fuss</span>
          </>
        }
        subtitle={`${SITE.name} is built so two people can start playing in about ten seconds — and so everything still works when nothing is configured.`}
      />

      {/* One sheet with divided rows reads as a reference document rather than
          a stack of unrelated cards. */}
      <div className="mt-14 divide-y divide-line rounded-[32px] bg-surface px-7 shadow-sm ring-1 ring-inset ring-line sm:mt-16 sm:px-10">
        {SECTIONS.map((section, i) => (
          <section
            key={section.title}
            className="a-rise grid gap-2 py-8 sm:grid-cols-[190px_1fr] sm:gap-10 sm:py-10"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <h2 className="t-h4 text-ink">{section.title}</h2>
            <p className="t-body">{section.body}</p>
          </section>
        ))}
      </div>

      <div className="mt-12 flex flex-wrap gap-3">
        <ButtonLink href="/" size="lg">Browse experiences</ButtonLink>
        <ButtonLink href="/profile" size="lg" variant="secondary">
          Your data
        </ButtonLink>
      </div>
    </PageShell>
  );
}
