"use client";

import { useEffect, useRef, useState } from "react";

/**
 * One screen-reader channel for the whole app.
 *
 * Most of what changes on screen in this product is caused by the *other*
 * person — they joined, they answered, they pressed play. Sighted users see it;
 * without this, nobody else is told. A single mounted live region avoids the
 * usual failure of per-component regions, which are inconsistently announced
 * when they mount and unmount alongside the content they describe.
 *
 * Nothing here is visible. Call `announce()` from anywhere.
 */
const EVENT = "together:announce";

export type Urgency = "polite" | "assertive";

export function announce(message: string, urgency: Urgency = "polite") {
  if (typeof window === "undefined" || !message) return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { message, urgency } }));
}

export function Announcer() {
  const [polite, setPolite] = useState("");
  const [assertive, setAssertive] = useState("");
  const last = useRef<{ message: string; at: number }>({ message: "", at: 0 });

  useEffect(() => {
    const onAnnounce = (e: Event) => {
      const { message, urgency } = (e as CustomEvent<{ message: string; urgency: Urgency }>).detail;
      const now = Date.now();

      // Room state re-renders on every heartbeat, so the same sentence can
      // arrive several times for one real change. Collapse the repeats.
      if (message === last.current.message && now - last.current.at < 4000) return;
      last.current = { message, at: now };

      const set = urgency === "assertive" ? setAssertive : setPolite;
      // Clearing first guarantees the region is seen to change even when the
      // new text matches what it held a moment ago.
      set("");
      window.setTimeout(() => set(message), 60);
    };

    window.addEventListener(EVENT, onAnnounce);
    return () => window.removeEventListener(EVENT, onAnnounce);
  }, []);

  return (
    <>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {polite}
      </div>
      <div className="sr-only" role="alert" aria-live="assertive" aria-atomic="true">
        {assertive}
      </div>
    </>
  );
}

/**
 * Announces `message` whenever it changes to a new non-empty value.
 *
 * Experiences derive a sentence from their own state and hand it over; this
 * takes care of firing exactly once per change.
 */
export function useAnnounce(message: string | null | undefined, urgency: Urgency = "polite") {
  const previous = useRef<string | null>(null);
  useEffect(() => {
    if (!message || message === previous.current) return;
    previous.current = message;
    announce(message, urgency);
  }, [message, urgency]);
}
