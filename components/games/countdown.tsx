"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useAnnounce } from "@/components/a11y/announcer";

/** Counts down to an absolute timestamp so both clients stay in step. */
export function useCountdown(endsAt: number | null, onDone?: () => void) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!endsAt) return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [endsAt]);

  const remaining = endsAt ? Math.max(0, endsAt - now) : 0;
  const done = Boolean(endsAt) && remaining <= 0;

  useEffect(() => {
    if (done) onDone?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  return { remaining, seconds: Math.ceil(remaining / 1000), done };
}

export function CountdownRing({
  endsAt,
  totalMs,
  size = 64,
  onDone,
  label,
}: {
  endsAt: number | null;
  totalMs: number;
  size?: number;
  onDone?: () => void;
  label?: string;
}) {
  const { remaining, seconds } = useCountdown(endsAt, onDone);
  const pct = totalMs > 0 ? remaining / totalMs : 0;
  const r = size / 2 - 4;
  const circumference = 2 * Math.PI * r;
  const urgent = seconds <= 5;

  return (
    <div className="inline-flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--border-strong)"
            strokeWidth="3"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={urgent ? "var(--blush-deep)" : "var(--text)"}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - pct)}
            style={{ transition: "stroke-dashoffset 120ms linear" }}
          />
        </svg>
        <span
          className={cn(
            "t-num absolute inset-0 grid place-items-center text-[15px] font-extrabold",
            urgent ? "text-blush-deep" : "text-ink",
          )}
        >
          {seconds}
        </span>
      </div>
      {label && <span className="t-eyebrow">{label}</span>}
    </div>
  );
}

/** Big 3-2-1 overlay used before synchronised starts. */
export function CountdownOverlay({
  startAt,
  from = 3,
  onDone,
  caption,
}: {
  startAt: number | null;
  from?: number;
  onDone?: () => void;
  caption?: string;
}) {
  const endsAt = useMemo(() => (startAt ? startAt : null), [startAt]);
  const { remaining } = useCountdown(endsAt, onDone);
  const value = startAt && remaining > 0 ? Math.min(from, Math.ceil(remaining / 1000)) : 0;

  // Hooks must run on every render, so the announcement is set up before the
  // early return rather than after it.
  useAnnounce(value > 0 ? `${caption ? `${caption}. ` : ""}${value}` : null);

  if (!startAt || remaining <= 0) return null;

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-canvas/94 backdrop-blur-md"
      role="timer"
      aria-live="off"
    >
      <div className="px-8 text-center">
        {caption && (
          <p className="t-serif mb-6 text-[22px] text-ink-muted sm:mb-8 sm:text-[26px]">
            {caption}
          </p>
        )}
        <div
          key={value}
          className="a-pop t-num text-[140px] font-extrabold leading-[0.85] tracking-[-0.06em] text-ink sm:text-[200px]"
        >
          {value}
        </div>
        <div className="mx-auto mt-8 flex justify-center gap-2" aria-hidden="true">
          {[3, 2, 1].map((n) => (
            <span
              key={n}
              className={cn(
                "h-1.5 rounded-pill transition-all duration-300",
                n >= value ? "w-8 bg-ink" : "w-4 bg-line-strong",
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
