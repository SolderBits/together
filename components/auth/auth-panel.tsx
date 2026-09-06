"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/badge";
import { Label, TextField } from "@/components/ui/field";
import {
  authAvailable,
  getSession,
  onAuthChange,
  signInWithEmail,
  signInWithGoogle,
  signOut,
} from "@/lib/supabase/auth";

/**
 * Sign-in is entirely optional — nothing in the product requires it, and rooms
 * work for people who never see this panel. It exists so that saved memories
 * can follow you between devices once a backend is configured.
 */
export function AuthPanel() {
  const available = authAvailable();
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!available) return;
    void getSession().then((session) => setUser(session?.user ?? null));
    return onAuthChange(setUser);
  }, [available]);

  if (!available) {
    return (
      <div className="rounded-4xl ring-1 ring-inset ring-line bg-surface p-6 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <p className="t-eyebrow">
            Account
          </p>
          <Pill>Guest mode</Pill>
        </div>
        <p className="t-body-sm">
          You&rsquo;re playing as a guest, which is the intended way to use this. Everything you save
          stays on this device and nothing needs an account — including joining a room.
        </p>
        <p className="t-caption mt-4 leading-relaxed">
          Email and Google sign-in switch on automatically once{" "}
          <code className="font-mono text-[12px]">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code className="font-mono text-[12px]">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> are set. See{" "}
          <code className="font-mono text-[12px]">.env.example</code>.
        </p>
      </div>
    );
  }

  if (user) {
    return (
      <div className="rounded-4xl ring-1 ring-inset ring-line bg-surface p-6 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <p className="t-eyebrow">
            Account
          </p>
          <Pill tone="good">Signed in</Pill>
        </div>
        <p className="text-[16px] font-bold tracking-[-0.02em] text-ink">{user.email ?? "Signed in"}</p>
        <p className="t-body-sm mt-1.5">
          Saved memories can sync to this account.
        </p>
        <Button variant="secondary" className="mt-5" onClick={() => void signOut()}>
          Sign out
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-4xl ring-1 ring-inset ring-line bg-surface p-6 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <p className="t-eyebrow">Account</p>
        <Pill>Optional</Pill>
      </div>
      <p className="t-body-sm mb-6">
        Sign in to keep memories across devices. Rooms and games work without it.
      </p>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const error = await signInWithEmail(email);
          setBusy(false);
          setMessage(error ?? "Check your email for the sign-in link.");
        }}
        className="space-y-3"
      >
        <div>
          <Label htmlFor="email">Email</Label>
          <TextField
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>
        <Button block type="submit" disabled={busy || !email}>
          {busy ? "Sending…" : "Email me a link"}
        </Button>
      </form>

      <Button
        block
        variant="secondary"
        className="mt-2.5"
        onClick={async () => {
          const error = await signInWithGoogle();
          if (error) setMessage(error);
        }}
      >
        Continue with Google
      </Button>

      {message && <p className="t-body-sm mt-4">{message}</p>}
    </div>
  );
}
