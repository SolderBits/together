"use client";

import { RoomProvider } from "@/components/room/room-provider";
import { RoomStage } from "@/components/room/room-stage";
import { RoomAnnouncer } from "@/components/room/room-announcer";

export function RoomClient({
  code,
  experienceId,
  asHost,
}: {
  code: string;
  experienceId: string;
  asHost: boolean;
}) {
  return (
    <RoomProvider code={code} experienceId={experienceId} asHost={asHost}>
      <RoomAnnouncer />
      <RoomStage />
    </RoomProvider>
  );
}
