"use client";

import type { RoomPlayer } from "@/lib/rooms/types";
import { cn } from "@/lib/utils";

/**
 * A seat at the table. Present players get a solid card with their badge;
 * an empty seat stays a dashed outline with a quiet pulse, so the lobby always
 * reads as "one of you is missing" rather than "an error occurred".
 */
export function PlayerStatus({
  player,
  label,
  waitingLabel = "not here yet",
  showReady = true,
  accent = "blush",
}: {
  player: RoomPlayer | null;
  label: string;
  waitingLabel?: string;
  showReady?: boolean;
  accent?: string;
}) {
  const present = Boolean(player);
  const ready = player?.ready ?? false;

  return (
    <div
      className={cn(
        "relative flex flex-col items-center gap-4 rounded-4xl px-6 py-8 text-center transition-all duration-500 ease-out",
        present
          ? "bg-surface shadow-sm ring-1 ring-inset ring-line"
          : "border-[1.5px] border-dashed border-line-strong",
      )}
      style={
        present
          ? { background: `linear-gradient(180deg, var(--${accent}-tint) -40%, var(--surface) 46%)` }
          : undefined
      }
    >
      <p className="t-eyebrow">{label}</p>

      <span
        className={cn(
          "grid h-[68px] w-[68px] place-items-center rounded-pill text-[30px] transition-transform duration-500 ease-spring",
          present
            ? "bg-surface shadow-sm ring-1 ring-inset ring-line"
            : "border-[1.5px] border-dashed border-line-strong",
        )}
      >
        {present ? (
          <span className="a-pop">{player!.emoji}</span>
        ) : (
          <span className="relative grid h-3 w-3 place-items-center" aria-hidden="true">
            <span className="a-halo absolute inset-0 rounded-full bg-ink-faint" />
            <span className="h-2 w-2 rounded-full bg-ink-faint/60" />
          </span>
        )}
      </span>

      <div className="min-w-0">
        <p className="truncate text-[16px] font-bold tracking-[-0.02em] text-ink">
          {present ? player!.name : "Waiting"}
        </p>
        {showReady && (
          <p className="mt-1.5 flex items-center justify-center gap-1.5 text-[13px] font-medium text-ink-muted">
            {present ? (
              <>
                <span
                  className={cn(
                    "inline-block h-[7px] w-[7px] rounded-full",
                    ready ? "bg-mint-deep" : "bg-butter-mid",
                  )}
                />
                {ready ? "Ready" : "Getting comfortable"}
              </>
            ) : (
              waitingLabel
            )}
          </p>
        )}
      </div>
    </div>
  );
}
