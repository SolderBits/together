"use client";

import { Pill } from "@/components/ui/badge";

/**
 * How you're identified here.
 *
 * There is nothing to sign into and nothing to sign out of. Every visitor gets
 * an anonymous session — a signed, HttpOnly cookie the page itself cannot read
 * — issued on first visit and never mentioned again. It exists so the server
 * can tell one guest from another when deciding who may read a room; it is not
 * an account and there is nothing to remember.
 *
 * This panel used to offer an email link and a Google button. Both were
 * Supabase-only, and both were decorative: nothing read the resulting session
 * and no data was ever scoped to a signed-in user. They are gone rather than
 * left as controls that appear to do something.
 */
export function AuthPanel() {
  return (
    <div className="rounded-4xl ring-1 ring-inset ring-line bg-surface p-6 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <p className="t-eyebrow">Account</p>
        <Pill>Guest mode</Pill>
      </div>
      <p className="t-body-sm">
        You&rsquo;re playing as a guest, which is the intended way to use this. Everything you save
        stays on this device and nothing needs an account — including joining a room.
      </p>
    </div>
  );
}
