"use client";

import Link from "next/link";
import { useState } from "react";
import { SCENES } from "@/components/art/scenes";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/layout/page-shell";
import { PlayerStatus } from "./player-status";
import { RoomCode } from "./room-code";
import { ShareDialog } from "./share-dialog";
import { useRoom } from "./room-provider";
import { inviteLink } from "@/lib/rooms/api";
import { getExperience, paletteVars } from "@/lib/experiences";
import { cn } from "@/lib/utils";

/**
 * The waiting room. It has one job — make thirty seconds of waiting feel warm
 * instead of technical — so it leads with the experience's own illustration and
 * two seats, and keeps the plumbing (code, invite, ready) underneath.
 */
export function RoomLobby({ children }: { children?: React.ReactNode }) {
  const { state, me, partner, isHost, isSolo, start, setReady, leave } = useRoom();
  const [shareOpen, setShareOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  if (!state) return null;

  const experience = getExperience(state.experienceId);
  const palette = experience?.palette ?? "blush";
  const p = paletteVars(palette);
  const Art = experience ? SCENES[experience.scene] : null;
  const canStart = isHost && (!isSolo ? Boolean(partner) : experience?.soloFriendly !== false);

  return (
    <PageShell width="narrow" className="pb-24 pt-8 sm:pt-14">
      {/* ---------- masthead ---------- */}
      <div className="relative text-center">
        <span
          className="pointer-events-none absolute left-1/2 top-[-70px] -z-10 h-[280px] w-[560px] -translate-x-1/2 rounded-[50%] blur-3xl"
          style={{ background: `radial-gradient(circle, ${p.tint}, transparent 68%)` }}
          aria-hidden="true"
        />

        {Art && (
          <div className="a-rise mx-auto mb-6 w-[168px] sm:w-[196px]">
            <Art tint={p.tint} mid={p.mid} deep={p.deep} className="a-drift h-auto w-full" />
          </div>
        )}

        <h1 className="t-h1 a-rise d-1 text-ink">{experience?.title ?? "Room"}</h1>
        <p className="a-rise d-2 mt-4 text-[15.5px] font-medium text-ink-muted">
          {partner ? (
            <span className="inline-flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-mint-deep" />
              they&rsquo;re here — start whenever you like
            </span>
          ) : (
            <span className="t-serif text-[19px] text-ink-soft">
              waiting for your person…
            </span>
          )}
        </p>
      </div>

      {/* ---------- the two seats ---------- */}
      <div className="a-rise d-3 relative mt-10 grid grid-cols-2 gap-3 sm:mt-12 sm:gap-4">
        <PlayerStatus player={me} label="You" accent={palette} />
        <PlayerStatus player={partner} label="Them" accent={palette} />

        <span
          className="pointer-events-none absolute left-1/2 top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-pill bg-canvas shadow-xs ring-1 ring-inset ring-line-strong"
          aria-hidden="true"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.6" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
      </div>

      {/* ---------- share ---------- */}
      <div className="a-rise d-4 mt-8 rounded-4xl bg-surface p-7 text-center shadow-sm ring-1 ring-inset ring-line sm:mt-10 sm:p-9">
        <p className="t-eyebrow">Share this room</p>
        <div className="mt-5">
          <RoomCode code={state.code} size="lg" />
        </div>
        <div className="mt-7">
          <Button size="lg" variant="secondary" onClick={() => setShareOpen(true)}>
            Copy invite
          </Button>
          {!partner && (
            <p className="t-caption mt-4">They don&rsquo;t need an account, an app, or anything else.</p>
          )}
        </div>
      </div>

      {children}

      {/* ---------- controls ---------- */}
      <div className="mt-8 flex flex-col gap-3 sm:mt-10">
        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            size="xl"
            block
            variant={me?.ready ? "soft" : "secondary"}
            onClick={() => setReady(!me?.ready)}
          >
            {me?.ready ? "I'm not ready" : "I'm ready"}
          </Button>

          {isHost ? (
            <Button size="xl" block disabled={!canStart} onClick={start}>
              {isSolo && experience?.soloFriendly ? "Start solo" : "Start"}
            </Button>
          ) : (
            <div className="grid h-[60px] place-items-center rounded-pill bg-surface-sunken px-6 text-[14px] font-semibold text-ink-muted">
              They&rsquo;ll start it
            </div>
          )}
        </div>

        {isHost && isSolo && experience?.soloFriendly === false && (
          <p className="text-center text-[13px] text-ink-faint">
            This one needs two people — Start unlocks the moment they join.
          </p>
        )}

        <div className="mt-4 flex items-center justify-center gap-5 text-[13.5px]">
          <button
            type="button"
            disabled={leaving}
            onClick={async () => {
              setLeaving(true);
              await leave(isHost);
              window.location.href = "/";
            }}
            className={cn(
              "font-semibold text-ink-muted underline-offset-4 transition-colors hover:text-ink hover:underline",
              leaving && "opacity-50",
            )}
          >
            Leave room
          </button>
          <span className="h-3 w-px bg-line-strong" aria-hidden="true" />
          <Link
            href="/"
            className="font-semibold text-ink-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
          >
            All experiences
          </Link>
        </div>
      </div>

      <ShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        code={state.code}
        link={inviteLink(state.code)}
      />
    </PageShell>
  );
}
