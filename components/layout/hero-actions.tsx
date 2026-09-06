"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { JoinRoomDialog } from "@/components/room/join-room-dialog";
import { MAIN_EXPERIENCES, experienceHref } from "@/lib/experiences";

export function HeroActions() {
  const router = useRouter();
  const [joinOpen, setJoinOpen] = useState(false);

  function surpriseMe() {
    const pick = MAIN_EXPERIENCES[Math.floor(Math.random() * MAIN_EXPERIENCES.length)];
    router.push(experienceHref(pick));
  }

  return (
    <>
      <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button size="xl" className="w-full sm:w-auto" onClick={surpriseMe}>
          Surprise us
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="transition-transform duration-300 ease-out group-hover/btn:translate-x-0.5">
            <path d="M5 12h13M12.5 6l6 6-6 6" />
          </svg>
        </Button>
        <Button
          size="xl"
          variant="secondary"
          className="w-full sm:w-auto"
          onClick={() => setJoinOpen(true)}
        >
          I have a code
        </Button>
      </div>
      <JoinRoomDialog open={joinOpen} onClose={() => setJoinOpen(false)} />
    </>
  );
}
