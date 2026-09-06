"use client";

import Link from "next/link";
import { useState } from "react";
import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { RoomCode } from "@/components/room/room-code";
import { ShareDialog } from "@/components/room/share-dialog";
import { useRoom } from "@/components/room/room-provider";
import { useConnectionState } from "@/lib/realtime/use-connection";
import { inviteLink } from "@/lib/rooms/api";
import { getExperience, paletteVars } from "@/lib/experiences";
import { cn } from "@/lib/utils";

/**
 * Chrome shared by every in-room experience: title, live seats, room code,
 * progress and a way out. Each game tints it with its own pastel, so the
 * product feels continuous while each screen still has a personality.
 */
export function GameShell({
  title,
  step,
  totalSteps,
  hint,
  actions,
  children,
  width = "shell",
}: {
  title: string;
  step?: number;
  totalSteps?: number;
  hint?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  width?: "shell" | "narrow" | "wide" | "reading";
}) {
  const { state, players, partner, leave, isHost } = useRoom();
  const [shareOpen, setShareOpen] = useState(false);

  const experience = state ? getExperience(state.experienceId) : undefined;
  const palette = experience?.palette ?? "blush";
  const p = paletteVars(palette);
  const progress =
    step !== undefined && totalSteps ? Math.min(100, (step / totalSteps) * 100) : null;

  return (
    <>
      {/* the game's own colour, once, at the very top of the page */}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[360px]"
        style={{ background: `linear-gradient(180deg, ${p.tint} -30%, transparent 78%)` }}
        aria-hidden="true"
      />

      <div className="sticky top-[76px] z-40 border-b border-line bg-canvas/80 backdrop-blur-xl">
        <PageShell width={width} className="flex h-[58px] items-center gap-3">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: p.mid }}
            aria-hidden="true"
          />
          <h2 className="truncate text-[15px] font-extrabold tracking-[-0.028em] text-ink">
            {title}
          </h2>

          {step !== undefined && totalSteps ? (
            <span className="t-num shrink-0 rounded-pill bg-surface px-2.5 py-1 text-[11.5px] font-bold text-ink-muted ring-1 ring-inset ring-line">
              {Math.min(step, totalSteps)}/{totalSteps}
            </span>
          ) : null}

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden items-center sm:flex" title="Who's here">
              {players.map((player, i) => (
                <span
                  key={player.id}
                  className={cn(
                    "grid h-8 w-8 place-items-center rounded-pill bg-surface text-[14px] ring-1 ring-inset ring-line",
                    i > 0 && "-ml-2",
                  )}
                  title={player.name}
                >
                  {player.emoji}
                </span>
              ))}
              {!partner && (
                <span className="-ml-2 grid h-8 w-8 place-items-center rounded-pill bg-canvas text-[11px] text-ink-faint ring-[1.5px] ring-inset ring-line-strong">
                  ?
                </span>
              )}
            </span>

            {state && <RoomCode code={state.code} size="sm" className="hidden md:inline-flex" />}

            {!partner && (
              <Button size="sm" variant="secondary" onClick={() => setShareOpen(true)}>
                Invite
              </Button>
            )}

            {actions}

            <button
              type="button"
              onClick={async () => {
                await leave(isHost);
                window.location.href = "/";
              }}
              className="rounded-pill px-3 py-2 text-[13px] font-semibold text-ink-muted transition-colors hover:text-ink"
            >
              Leave
            </button>
          </div>
        </PageShell>

        <div className="h-[2px] w-full bg-line/60">
          {progress !== null && (
            <div
              className="h-full rounded-r-pill transition-[width] duration-700 ease-out"
              style={{
                width: `${progress}%`,
                backgroundImage: `linear-gradient(90deg, ${p.mid}, ${p.deep})`,
              }}
            />
          )}
        </div>
      </div>

      <PageShell width={width} className="pb-28 pt-10 sm:pt-14">
        {hint && (
          <p className="a-fade mx-auto mb-9 max-w-[52ch] text-center text-[14px] leading-relaxed text-ink-faint">
            {hint}
          </p>
        )}
        {children}
      </PageShell>

      {state && (
        <ShareDialog
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          code={state.code}
          link={inviteLink(state.code)}
        />
      )}
    </>
  );
}

export function GameFooterNav() {
  return (
    <div className="mt-14 text-center">
      <Link
        href="/"
        className="text-[13.5px] font-semibold text-ink-faint underline-offset-4 transition-colors hover:text-ink hover:underline"
      >
        Back to all experiences
      </Link>
    </div>
  );
}

/**
 * The moment where one person is done and the other isn't. Deliberately calm —
 * a slow breathing ring rather than a spinner.
 */
export function WaitingForPartner({
  label = "waiting for them…",
  detail,
  className,
}: {
  label?: string;
  detail?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-4 py-12 text-center", className)}>
      <span className="relative grid h-14 w-14 place-items-center" aria-hidden="true">
        <span className="a-halo absolute inset-0 rounded-pill bg-blush-mid/70" />
        <span
          className="a-halo absolute inset-0 rounded-pill bg-blush-mid/50"
          style={{ animationDelay: "0.95s" }}
        />
        <span className="relative grid h-14 w-14 place-items-center rounded-pill bg-surface shadow-sm ring-1 ring-inset ring-line">
          <span className="h-2.5 w-2.5 rounded-full bg-ink" />
        </span>
      </span>
      <p className="t-serif text-[20px] text-ink">{label}</p>
      {detail && <p className="t-body-sm max-w-[38ch]">{detail}</p>}
    </div>
  );
}
