"use client";

import { useEffect, useRef } from "react";
import { announce } from "@/components/a11y/announcer";
import { useRoom } from "./room-provider";

/**
 * Narrates the room itself — everything that happens because of the other
 * person, or because the connection changed, rather than because of anything
 * you did.
 *
 * Mounted once per room. Experiences announce their own gameplay (a new
 * question, a reveal, a score) through `useAnnounce`; this covers the plumbing
 * underneath them.
 */
export function RoomAnnouncer() {
  const { state, status, identity, partner, players } = useRoom();

  const seen = useRef({
    partnerId: null as string | null,
    partnerName: "",
    hostId: null as string | null,
    hostSince: 0,
    readyIds: "" as string,
    status: "" as string,
    roomStatus: "" as string,
    mounted: false,
  });

  // --- connection ----------------------------------------------------------
  useEffect(() => {
    const s = seen.current;
    if (s.status === status) return;
    const previous = s.status;
    s.status = status;
    if (!previous) return; // first render is not a change
    if (status === "connected") announce("Reconnected to the room.");
    if (status === "connecting") announce("Reconnecting…");
    if (status === "error") announce("Lost the connection to this room.", "assertive");
    if (status === "not-found") announce("This room could not be found.", "assertive");
  }, [status]);

  // --- who is here ---------------------------------------------------------
  useEffect(() => {
    const s = seen.current;
    const id = partner?.id ?? null;
    if (id === s.partnerId) return;

    if (id && partner) {
      announce(`${partner.name} joined.`);
      s.partnerName = partner.name;
    } else if (s.partnerId) {
      announce(`${s.partnerName || "Your partner"} left the room.`);
    }
    s.partnerId = id;
  }, [partner]);

  // --- host migration ------------------------------------------------------
  useEffect(() => {
    if (!state) return;
    const s = seen.current;
    const { hostId, hostSince } = state;

    // Remember the opening position silently; only handovers are worth saying.
    if (!s.hostId) {
      s.hostId = hostId;
      s.hostSince = hostSince ?? 0;
      return;
    }
    if (hostId === s.hostId) return;

    s.hostId = hostId;
    s.hostSince = hostSince ?? 0;
    announce(
      hostId === identity.id
        ? "You're running the room now — the previous host dropped out."
        : `${state.players[hostId]?.name ?? "Someone else"} is running the room now.`,
      "assertive",
    );
  }, [state, identity.id]);

  // --- ready / start -------------------------------------------------------
  useEffect(() => {
    if (!state) return;
    const s = seen.current;

    const readyIds = players
      .filter((p) => p.ready)
      .map((p) => p.id)
      .sort()
      .join(",");
    if (readyIds !== s.readyIds) {
      const newly = players.find(
        (p) => p.ready && p.id !== identity.id && !s.readyIds.includes(p.id),
      );
      if (newly) announce(`${newly.name} is ready.`);
      s.readyIds = readyIds;
    }

    if (state.status !== s.roomStatus) {
      const previous = s.roomStatus;
      s.roomStatus = state.status;
      if (previous && state.status === "active") announce("Starting now.");
      if (previous && state.status === "finished") announce("That's the end of the round.");
    }
  }, [state, players, identity.id]);

  return null;
}
