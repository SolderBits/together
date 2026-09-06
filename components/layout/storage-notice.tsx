"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { pruneStaleLocalRooms } from "@/lib/realtime/local-transport";

/**
 * The store already tells us when a write failed — nothing was listening.
 *
 * Browser storage fills up quickly once photos are involved, and until now a
 * failed write was swallowed: the UI said "Saved", the file was gone on
 * refresh. This is the other half of that contract. It only ever appears when a
 * write has actually failed.
 */
export function StorageNotice() {
  const [message, setMessage] = useState<string | null>(null);

  // Reclaim space before anything asks for it. Cheap, and it keeps day-old
  // rooms from competing with the photo features for the same quota.
  useEffect(() => {
    pruneStaleLocalRooms();
  }, []);

  useEffect(() => {
    const onError = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      setMessage(typeof detail === "string" ? detail : "Storage is full.");
    };
    window.addEventListener("together:store-error", onError);
    return () => window.removeEventListener("together:store-error", onError);
  }, []);

  if (!message) return null;

  return (
    <div
      role="alert"
      className="fixed inset-x-4 bottom-5 z-[80] mx-auto max-w-[420px] rounded-[22px] bg-surface p-5 shadow-pop ring-1 ring-inset ring-line-strong"
    >
      <p className="text-[14.5px] font-bold tracking-[-0.02em] text-ink">
        That didn&rsquo;t save
      </p>
      <p className="t-body-sm mt-2">
        This browser has run out of room, so the last thing you kept wasn&rsquo;t stored.
        Clearing a few old strips or photos in your{" "}
        <Link href="/profile" className="font-semibold text-ink underline underline-offset-2">
          profile
        </Link>{" "}
        will make space.
      </p>
      <button
        type="button"
        onClick={() => setMessage(null)}
        className="mt-4 rounded-pill bg-surface-sunken px-4 py-2 text-[13px] font-bold text-ink transition-colors hover:bg-line"
      >
        Got it
      </button>
    </div>
  );
}
