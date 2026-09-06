"use client";

import { PageShell } from "@/components/layout/page-shell";
import { Button, ButtonLink } from "@/components/ui/button";
import { RoomLobby } from "./room-lobby";
import { useRoom } from "./room-provider";
import { EXPERIENCE_COMPONENTS } from "@/components/experiences/registry";
import { getExperience } from "@/lib/experiences";

/**
 * Decides what a room renders: connecting, the lobby, or the experience.
 * Individual experiences never handle connection concerns.
 */
export function RoomStage() {
  const { status, error, state } = useRoom();

  if (status === "connecting") {
    return (
      <PageShell width="narrow" className="py-32">
        <div className="flex flex-col items-center gap-6 text-center">
          <span className="relative grid h-16 w-16 place-items-center" aria-hidden="true">
            <span className="a-halo absolute inset-0 rounded-pill bg-blush-mid/60" />
            <span
              className="a-halo absolute inset-0 rounded-pill bg-sky-mid/50"
              style={{ animationDelay: "0.9s" }}
            />
            <span className="relative grid h-16 w-16 place-items-center rounded-pill bg-surface shadow-sm ring-1 ring-inset ring-line">
              <span className="h-3 w-3 rounded-full bg-ink" />
            </span>
          </span>
          <p className="t-serif text-[22px] text-ink">finding the room…</p>
        </div>
      </PageShell>
    );
  }

  if (status === "not-found" || status === "error") {
    return (
      <PageShell width="narrow" className="py-24 sm:py-32">
        <div className="rounded-[36px] bg-surface p-10 text-center shadow-sm ring-1 ring-inset ring-line sm:p-14">
          <span
            className="mx-auto mb-7 grid h-16 w-16 place-items-center rounded-pill bg-butter-tint text-[26px]"
            aria-hidden="true"
          >
            ⌛
          </span>
          <h1 className="t-h2 text-ink">
            {status === "not-found" ? "That room isn't there" : "Something went wrong"}
          </h1>
          <p className="t-body mx-auto mt-4 max-w-[40ch] text-[15px]">
            {error ??
              "The room may have been closed, or the code was mistyped. Rooms live on the device that created them until a backend is configured."}
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/" size="lg">
              Browse experiences
            </ButtonLink>
            <Button size="lg" variant="secondary" onClick={() => window.location.reload()}>
              Try again
            </Button>
          </div>
        </div>
      </PageShell>
    );
  }

  if (!state) return null;

  if (state.status === "lobby") return <RoomLobby />;

  const experience = getExperience(state.experienceId);
  const Component = EXPERIENCE_COMPONENTS[state.experienceId];

  if (!Component || !experience) {
    return (
      <PageShell width="narrow" className="py-32">
        <div className="rounded-[36px] bg-surface p-10 text-center shadow-sm ring-1 ring-inset ring-line">
          <h1 className="t-h2 text-ink">Unknown experience</h1>
          <p className="t-body mt-4">
            This room points at &ldquo;{state.experienceId}&rdquo;, which isn&rsquo;t installed.
          </p>
          <ButtonLink href="/" size="lg" className="mt-8">
            Back to experiences
          </ButtonLink>
        </div>
      </PageShell>
    );
  }

  return <Component />;
}
