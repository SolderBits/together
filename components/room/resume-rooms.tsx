"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { forgetRoom, recentRooms, type RecentRoom } from "@/lib/rooms/api";
import { getExperience, paletteVars } from "@/lib/experiences";
import { cn } from "@/lib/utils";

/** Lets someone hop straight back into a room after a refresh or a tab close. */
export function ResumeRooms() {
  const [rooms, setRooms] = useState<RecentRoom[]>([]);

  useEffect(() => setRooms(recentRooms().slice(0, 4)), []);

  if (!rooms.length) return null;

  return (
    <div className="a-rise">
      <p className="t-eyebrow mb-4">Still open</p>
      <div className="flex flex-wrap gap-3">
        {rooms.map((room) => {
          const experience = getExperience(room.experienceId);
          const p = experience ? paletteVars(experience.palette) : null;
          return (
            <div
              key={room.code}
              className={cn(
                "group/chip flex items-center gap-1 rounded-pill bg-surface pl-2 pr-1.5",
                "ring-1 ring-inset ring-line shadow-xs transition-all duration-300 ease-out",
                "hover:-translate-y-[2px] hover:shadow-sm hover:ring-line-strong",
              )}
            >
              <Link href={`/room/${room.code}`} className="flex items-center gap-2.5 py-2 pl-1.5 pr-1">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: p?.mid ?? "var(--border-strong)" }}
                  aria-hidden="true"
                />
                <span className="font-mono text-[12.5px] font-bold tracking-[0.12em] text-ink">
                  {room.code}
                </span>
                <span className="text-[13.5px] font-medium text-ink-muted">
                  {experience?.title ?? "Room"}
                </span>
              </Link>
              <button
                type="button"
                aria-label={`Forget room ${room.code}`}
                onClick={() => {
                  forgetRoom(room.code);
                  setRooms(recentRooms().slice(0, 4));
                }}
                className="grid h-8 w-8 place-items-center rounded-pill text-ink-faint transition-colors hover:bg-surface-sunken hover:text-ink"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                  <path d="m6 6 12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
