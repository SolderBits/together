"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SCENES } from "@/components/art/scenes";
import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { Pill } from "@/components/ui/badge";
import { roomExists } from "@/lib/rooms/api";
import { getExperience, paletteVars } from "@/lib/experiences";
import { generateRoomCode, normalizeCode } from "@/lib/utils";

/**
 * The front door for a room-based experience. One decision — host or join —
 * presented as an editorial page rather than a form.
 */
export function ExperienceLauncher({ experienceId }: { experienceId: string }) {
  const router = useRouter();
  const experience = getExperience(experienceId)!;
  const Art = SCENES[experience.scene];
  const p = paletteVars(experience.palette);

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"host" | "join" | null>(null);

  function host() {
    setBusy("host");
    router.push(`/room/${generateRoomCode()}?exp=${experience.id}&host=1`);
  }

  async function join(e: React.FormEvent) {
    e.preventDefault();
    const clean = normalizeCode(code);
    if (clean.length < 4) {
      setError("Room codes are six characters.");
      return;
    }
    setBusy("join");
    setError(null);
    const state = await roomExists(clean);
    if (!state) {
      setBusy(null);
      setError(`No room called ${clean}.`);
      return;
    }
    router.push(`/room/${clean}`);
  }

  return (
    <PageShell width="reading" className="pb-24 pt-8 sm:pt-14">
      {/* ---------- masthead ---------- */}
      <div className="relative text-center">
        <span
          className="pointer-events-none absolute left-1/2 top-[-80px] -z-10 h-[300px] w-[620px] -translate-x-1/2 rounded-[50%] blur-3xl"
          style={{ background: `radial-gradient(circle, ${p.tint}, transparent 66%)` }}
          aria-hidden="true"
        />

        <div className="a-rise mx-auto mb-7 w-[200px] sm:w-[236px]">
          <Art tint={p.tint} mid={p.mid} deep={p.deep} className="a-drift h-auto w-full" />
        </div>

        <h1 className="t-h1 a-rise d-1 text-ink">{experience.title}</h1>
        <p className="t-body a-rise d-2 mx-auto mt-5 max-w-[46ch] text-[16.5px]">
          {experience.blurb}
        </p>

        <div className="a-rise d-3 mt-7 flex flex-wrap justify-center gap-2">
          <Pill tone="accent" accent={experience.palette}>{experience.players}</Pill>
          <Pill tone="neutral">{experience.minutes}</Pill>
          {experience.soloFriendly && <Pill tone="neutral">works solo</Pill>}
        </div>
      </div>

      {/* ---------- host ---------- */}
      <div className="a-rise d-4 mt-12 overflow-hidden rounded-4xl bg-surface shadow-sm ring-1 ring-inset ring-line sm:mt-14">
        <div
          className="relative p-8 text-center sm:p-11"
          style={{ background: `linear-gradient(170deg, ${p.tint} -10%, var(--surface) 52%)` }}
        >
          <h2 className="t-h3 text-ink">Start a room</h2>
          <p className="t-body-sm mx-auto mt-3 max-w-[40ch]">
            You get a six-character code and an invite link. They don&rsquo;t need an account, an
            app, or anything else.
          </p>
          <Button size="xl" className="mt-7" onClick={host} disabled={busy !== null}>
            {busy === "host" ? "Opening…" : "Create room"}
          </Button>
        </div>

        {/* ---------- join ---------- */}
        <form onSubmit={join} className="border-t border-line p-8 sm:p-11">
          <div className="text-center">
            <h2 className="t-h4 text-ink">Or join theirs</h2>
            <p className="t-body-sm mt-2">Already have a code?</p>
          </div>

          <div className="mx-auto mt-6 flex max-w-[420px] flex-col gap-3 sm:flex-row">
            <TextField
              value={code}
              onChange={(e) => {
                setCode(normalizeCode(e.target.value));
                setError(null);
              }}
              placeholder="ABC123"
              aria-label="Room code"
              autoComplete="off"
              spellCheck={false}
              className="text-center font-mono text-[19px] font-bold uppercase tracking-[0.26em] sm:flex-1"
            />
            <Button type="submit" size="lg" variant="secondary" disabled={busy !== null}>
              {busy === "join" ? "Joining…" : "Join"}
            </Button>
          </div>
          {error && (
            <p className="mt-4 text-center text-[13.5px] font-semibold text-[#a5322a]">{error}</p>
          )}
        </form>
      </div>
    </PageShell>
  );
}
