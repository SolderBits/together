import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { normalizeCode } from "@/lib/utils";
import { RoomClient } from "./room-client";

export const metadata: Metadata = {
  title: "Room",
  description: "Join a live room and play together.",
  robots: { index: false, follow: false },
};

export default async function RoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ roomCode: string }>;
  searchParams: Promise<{ exp?: string; host?: string }>;
}) {
  const { roomCode } = await params;
  const { exp, host } = await searchParams;

  // Anything that is not a room code never reaches the transport. Unvalidated,
  // it would become a storage key locally and — once Supabase is on — be
  // interpolated into a realtime filter expression.
  const code = normalizeCode(roomCode);
  if (code.length !== 6) notFound();

  return <RoomClient code={code} experienceId={exp ?? ""} asHost={host === "1"} />;
}
