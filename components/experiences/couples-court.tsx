"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GameShell, WaitingForPartner } from "@/components/games/game-shell";
import { VerdictPanel } from "@/components/games/verdict-panel";
import { Button } from "@/components/ui/button";
import { MemoryMoment } from "@/components/games/memory-moment";
import { Pill } from "@/components/ui/badge";
import { Label, TextArea, TextField } from "@/components/ui/field";
import { useRoom, useSharedState } from "@/components/room/room-provider";
import { uniqueNames } from "@/lib/rooms/api";
import { requestVerdict } from "@/lib/ai/client";
import type { Verdict } from "@/lib/ai/types";
import { COURT_CASES, EVIDENCE_PROMPTS } from "@/lib/games/content/court";
import { pickFresh } from "@/lib/games/content/pick";
import { shuffle } from "@/lib/utils";
import { recordCompletion, saveMemory } from "@/lib/store";

type Phase = "filing" | "defence" | "judging" | "verdict";

interface Filing {
  argument: string;
  evidence: string;
}

interface CourtData {
  phase: Phase;
  plaintiffId: string | null;
  complaint: string;
  filings: Record<string, Filing>;
  verdict: Verdict | null;
}

const DEFAULTS: CourtData = {
  phase: "filing",
  plaintiffId: null,
  complaint: "",
  filings: {},
  verdict: null,
};

export function CouplesCourt() {
  const { state, identity, players, roster, partner, isHost, update } = useRoom();
  const [data, setData] = useSharedState<CourtData>("court", DEFAULTS);
  const [complaint, setComplaint] = useState("");
  const [argument, setArgument] = useState("");
  const [evidence, setEvidence] = useState("");

  // Whoever opens the room first files the complaint unless it's already set.
  const plaintiffId = data.plaintiffId ?? (isHost ? identity.id : null);
  const iAmPlaintiff = plaintiffId === identity.id;
  const defendantId = players.find((p) => p.id !== plaintiffId)?.id ?? null;

  const roleLabel = iAmPlaintiff ? "Plaintiff" : "Defendant";
  const names = useMemo(() => uniqueNames(roster), [roster]);

  const everyoneFiled =
    Boolean(data.filings[plaintiffId ?? ""]) && Boolean(data.filings[defendantId ?? ""]);

  /**
   * One request per case, not one per render.
   *
   * This effect depends on `roster` and `names`, which are derived from the room
   * document — and the presence heartbeat replaces that document every three
   * seconds. Guarding on `data.verdict` alone only stops re-entry *after* a
   * verdict lands, so a slow judge call was being fired again on every beat.
   */
  const judging = useRef<string | null>(null);

  useEffect(() => {
    if (data.phase !== "judging" || !isHost || data.verdict) return;
    if (judging.current === data.complaint) return;
    judging.current = data.complaint;
    let cancelled = false;
    void requestVerdict({
      kind: "court",
      topic: data.complaint,
      submissions: roster.map((p) => ({
        playerId: p.id,
        name: names[p.id] ?? p.name,
        side: p.id === plaintiffId ? "Plaintiff" : "Defendant",
        argument: data.filings[p.id]?.argument ?? "",
        evidence: data.filings[p.id]?.evidence ?? "",
      })),
    })
      .then((verdict) => {
        if (cancelled) return;
        void setData((c) => ({ ...c, phase: "verdict", verdict }));
        recordCompletion("couples-court");
      })
      .catch(() => {
        // Let the next beat retry rather than stranding the room on "deliberating".
        judging.current = null;
      });
    return () => {
      cancelled = true;
    };
  }, [
    data.phase,
    data.verdict,
    data.complaint,
    data.filings,
    isHost,
    roster,
    names,
    plaintiffId,
    setData,
  ]);

  useEffect(() => {
    if (data.phase === "defence" && everyoneFiled && isHost) {
      void setData((c) => ({ ...c, phase: "judging" }));
    }
  }, [data.phase, everyoneFiled, isHost, setData]);

  function file() {
    if (!complaint.trim() || !argument.trim()) return;
    void setData((c) => ({
      ...c,
      phase: "defence",
      plaintiffId: identity.id,
      complaint: complaint.trim(),
      filings: {
        ...c.filings,
        [identity.id]: { argument: argument.trim(), evidence: evidence.trim() },
      },
    }));
    setArgument("");
    setEvidence("");
  }

  function respond() {
    if (!argument.trim()) return;
    void setData((c) => ({
      ...c,
      filings: {
        ...c.filings,
        [identity.id]: { argument: argument.trim(), evidence: evidence.trim() },
      },
    }));
  }

  function newCase() {
    judging.current = null;
    setComplaint("");
    setArgument("");
    setEvidence("");
    void setData({ ...DEFAULTS });
    void update({ status: "active" });
  }

  // --- filing --------------------------------------------------------------

  if (data.phase === "filing") {
    if (!iAmPlaintiff) {
      return (
        <GameShell title="Couples Court">
          <div className="mx-auto max-w-md">
            <WaitingForPartner
              label="they're filing the complaint"
              detail="You'll get to respond in full. Everything is on the record."
            />
          </div>
        </GameShell>
      );
    }

    return (
      <GameShell title="Couples Court" hint="Keep it petty. That's what the court is for.">
        <div className="mx-auto max-w-xl space-y-5">
          <div className="rounded-3xl ring-1 ring-inset ring-line bg-surface p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <Label className="mb-0">The complaint</Label>
              <Pill tone="warn">You&rsquo;re the plaintiff</Pill>
            </div>
            <TextField
              value={complaint}
              onChange={(e) => setComplaint(e.target.value)}
              placeholder="e.g. Repeatedly saying 'five minutes'"
              aria-label="Complaint title"
            />
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  const c = pickFresh(COURT_CASES, "court");
                  if (!c) return;
                  setComplaint(c.title);
                  setArgument(c.summary);
                }}
                className="rounded-pill bg-ink px-3.5 py-2 text-[12.5px] font-bold text-ink-inverse shadow-sm transition-transform duration-200 hover:-translate-y-[1px]"
              >
                Surprise me
              </button>
              {COURT_CASES.slice(0, 12).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setComplaint(c.title);
                    if (!argument.trim()) setArgument(c.summary);
                  }}
                  className="rounded-full ring-1 ring-inset ring-line bg-surface px-3 py-1.5 text-[12.5px] font-semibold text-ink-muted transition-colors hover:ring-line-strong hover:text-ink"
                >
                  {c.title}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-3xl ring-1 ring-inset ring-line bg-surface p-6 shadow-sm">
            <Label htmlFor="case">Your case</Label>
            <TextArea
              id="case"
              rows={6}
              value={argument}
              onChange={(e) => setArgument(e.target.value)}
              placeholder="What happened, and why it was outrageous."
            />
            <div className="mt-4">
              <div className="mb-2.5 flex items-end justify-between gap-3">
                <Label className="mb-0">Evidence (optional)</Label>
                <button
                  type="button"
                  onClick={() => setEvidence(shuffle(EVIDENCE_PROMPTS)[0])}
                  className="text-[12.5px] font-bold text-ink-muted transition-colors hover:text-ink"
                >
                  Give me one
                </button>
              </div>
              <TextArea
                id="evidence"
                rows={3}
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                placeholder="Dates, times, quotes, witnesses, receipts."
              />
            </div>
            <Button
              block
              size="lg"
              className="mt-5"
              onClick={file}
              disabled={!complaint.trim() || !argument.trim()}
            >
              File the case
            </Button>
          </div>
        </div>
      </GameShell>
    );
  }

  // --- defence -------------------------------------------------------------

  if (data.phase === "defence") {
    const iFiled = Boolean(data.filings[identity.id]);
    return (
      <GameShell title="Couples Court">
        <div className="mx-auto max-w-xl space-y-5">
          <div className="rounded-3xl ring-1 ring-inset ring-line bg-surface p-6 shadow-sm">
            <p className="t-eyebrow">
              Case before the court
            </p>
            <h2 className="t-h2 mt-2.5 text-ink">{data.complaint}</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              <Pill tone={iAmPlaintiff ? "warn" : "info"}>You are the {roleLabel.toLowerCase()}</Pill>
              {defendantId && (
                <Pill>
                  {state?.players[defendantId]?.emoji} defending
                </Pill>
              )}
            </div>
          </div>

          {iAmPlaintiff ? (
            <>
              <div className="rounded-3xl ring-1 ring-inset ring-line bg-surface p-6 shadow-sm">
                <p className="mb-2 t-eyebrow">
                  Your filing
                </p>
                <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-ink-soft">
                  {data.filings[identity.id]?.argument}
                </p>
              </div>
              <WaitingForPartner
                label="the defence is preparing"
                detail={
                  partner
                    ? `${partner.name} gets to answer before any ruling.`
                    : "They get to answer before any ruling."
                }
              />
            </>
          ) : iFiled ? (
            <WaitingForPartner label="defence filed" detail="The bench is about to rule." />
          ) : (
            <div className="rounded-3xl ring-1 ring-inset ring-line bg-surface p-6 shadow-sm">
              <p className="mb-4 rounded-2xl bg-surface-muted p-4 text-[13.5px] leading-relaxed text-ink-soft">
                <span className="mb-1 block t-eyebrow">
                  Their claim
                </span>
                {data.filings[plaintiffId ?? ""]?.argument}
                {data.filings[plaintiffId ?? ""]?.evidence && (
                  <span className="mt-2 block text-[12.5px] italic text-ink-muted">
                    Evidence: {data.filings[plaintiffId ?? ""]?.evidence}
                  </span>
                )}
              </p>

              <Label htmlFor="defence">Your defence</Label>
              <TextArea
                id="defence"
                rows={6}
                value={argument}
                onChange={(e) => setArgument(e.target.value)}
                placeholder="Your side of it. Context is a legitimate defence."
              />
              <div className="mt-4">
                <div className="mb-2.5 flex items-end justify-between gap-3">
                  <Label className="mb-0">Evidence (optional)</Label>
                  <button
                    type="button"
                    onClick={() => setEvidence(shuffle(EVIDENCE_PROMPTS)[0])}
                    className="text-[12.5px] font-bold text-ink-muted transition-colors hover:text-ink"
                  >
                    Give me one
                  </button>
                </div>
                <TextArea
                  id="devidence"
                  rows={3}
                  value={evidence}
                  onChange={(e) => setEvidence(e.target.value)}
                  placeholder="Counter-receipts."
                />
              </div>
              <Button block size="lg" className="mt-5" onClick={respond} disabled={!argument.trim()}>
                File the defence
              </Button>
            </div>
          )}
        </div>
      </GameShell>
    );
  }

  if (data.phase === "judging" || !data.verdict) {
    return (
      <GameShell title="Couples Court">
        <div className="mx-auto max-w-md">
          <WaitingForPartner label="the bench is deliberating…" detail="All rise, etc." />
        </div>
      </GameShell>
    );
  }

  // --- verdict -------------------------------------------------------------

  return (
    <GameShell title="Couples Court">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="text-center">
          <p className="t-eyebrow">
            In the matter of
          </p>
          <h2 className="t-h2 mt-2 text-ink">{data.complaint}</h2>
        </div>

        <VerdictPanel verdict={data.verdict} meId={identity.id} />

        <MemoryMoment
          onSave={() =>
            saveMemory({
              experienceId: "couples-court",
              title: data.complaint,
              detail: `${data.verdict!.headline}${data.verdict!.sentence ? ` — ${data.verdict!.sentence}` : ""}`,
            })
          }
          saveLabel="Keep the ruling"
          onAgain={newCase}
          againLabel="Next case"
        />
      </div>
    </GameShell>
  );
}
