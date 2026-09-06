"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GameShell, WaitingForPartner } from "@/components/games/game-shell";
import { VerdictPanel } from "@/components/games/verdict-panel";
import { Button } from "@/components/ui/button";
import { MemoryMoment } from "@/components/games/memory-moment";
import { Pill } from "@/components/ui/badge";
import { Label, TextArea } from "@/components/ui/field";
import { useRoom, useSharedState } from "@/components/room/room-provider";
import { uniqueNames } from "@/lib/rooms/api";
import { requestVerdict } from "@/lib/ai/client";
import type { Verdict } from "@/lib/ai/types";
import {
  DEBATE_CATEGORIES,
  DEBATE_TOPICS,
  topicsForRound,
  topicsIn,
  type DebateCategory,
} from "@/lib/games/content/debate";
import { pickSeeded } from "@/lib/games/content/pick";
import { recordCompletion, saveMemory } from "@/lib/store";

type Phase = "brief" | "writing" | "judging" | "verdict";

interface DebateData {
  phase: Phase;
  round: number;
  /** Empty means "anything goes". */
  categories: DebateCategory[];
  topicId: string | null;
  arguments: Record<string, string>;
  verdict: Verdict | null;
}

const DEFAULTS: DebateData = {
  phase: "brief",
  round: 0,
  categories: [],
  topicId: null,
  arguments: {},
  verdict: null,
};

export function Debate() {
  const { state, identity, players, roster, partner, isHost, update } = useRoom();
  const [data, setData] = useSharedState<DebateData>("debate", DEFAULTS);
  const [draft, setDraft] = useState("");

  const order = useMemo(() => Object.keys(state?.players ?? {}).sort(), [state?.players]);
  const names = useMemo(() => uniqueNames(roster), [roster]);

  const topic = useMemo(() => {
    if (data.topicId) return DEBATE_TOPICS.find((t) => t.id === data.topicId) ?? DEBATE_TOPICS[0];
    // Round one stays light; by the fourth motion the hot ones are in play.
    const pool = topicsForRound(topicsIn(data.categories), data.round);
    return pickSeeded(pool.length ? pool : DEBATE_TOPICS, 1, `${state?.seed}:${data.round}`)[0];
  }, [data.topicId, data.round, data.categories, state?.seed]);

  const myIndex = order.indexOf(identity.id);
  const mySide = myIndex === 0 ? topic.sideA : topic.sideB;
  const submitted = Boolean(data.arguments[identity.id]);
  const everyoneIn = players.length >= 2 && players.every((p) => data.arguments[p.id]);

  // One client drives the judging call so the room gets a single verdict.
  /**
   * One request per motion. `roster` and `names` change identity on every
   * presence heartbeat, so without this ref a slow judge call is re-fired every
   * three seconds until it returns.
   */
  const judging = useRef<number | null>(null);

  useEffect(() => {
    if (data.phase !== "judging" || !isHost || data.verdict) return;
    if (judging.current === data.round) return;
    judging.current = data.round;
    let cancelled = false;
    void requestVerdict({
      kind: "debate",
      topic: topic.motion,
      submissions: roster.map((p) => ({
        playerId: p.id,
        name: names[p.id] ?? p.name,
        side: order.indexOf(p.id) === 0 ? topic.sideA : topic.sideB,
        argument: data.arguments[p.id] ?? "",
      })),
    })
      .then((verdict) => {
        if (cancelled) return;
        void setData((c) => ({ ...c, phase: "verdict", verdict }));
        recordCompletion("debate");
      })
      .catch(() => {
        judging.current = null;
      });
    return () => {
      cancelled = true;
    };
  }, [data.phase, data.verdict, isHost, roster, order, topic, data.arguments, names, setData]);

  useEffect(() => {
    if (everyoneIn && data.phase === "writing" && isHost) {
      void setData((c) => ({ ...c, phase: "judging" }));
    }
  }, [everyoneIn, data.phase, isHost, setData]);

  function submit() {
    if (!draft.trim()) return;
    void setData((c) => ({
      ...c,
      arguments: { ...c.arguments, [identity.id]: draft.trim() },
    }));
  }

  function newRound() {
    judging.current = null;
    setDraft("");
    void setData({ ...DEFAULTS, round: data.round + 1 });
    void update({ status: "active" });
  }

  if (data.phase === "brief") {
    return (
      <GameShell title="Debate" hint="You don't get to pick your side. That's the point.">
        <div className="mx-auto max-w-xl">
          <div className="animate-fade-up rounded-4xl ring-1 ring-inset ring-line bg-surface p-8 text-center shadow-sm sm:p-10">
            <p className="t-eyebrow">
              The motion
            </p>
            <h2 className="t-h2 mt-4 text-ink">
              {topic.motion}
            </h2>

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {order.slice(0, 2).map((id, i) => (
                <div
                  key={id}
                  className={`rounded-2xl border p-4 ${
                    id === identity.id ? "border-ink bg-surface-muted" : "border-line"
                  }`}
                >
                  <p className="t-eyebrow">
                    {i === 0 ? topic.sideA : topic.sideB}
                  </p>
                  <p className="mt-1.5 text-[15px] font-bold text-ink">
                    {id === identity.id ? "You" : state?.players[id]?.name ?? "Them"}
                  </p>
                </div>
              ))}
              {order.length < 2 && (
                <div className="rounded-[20px] border-[1.5px] border-dashed border-line-strong p-4 text-[13.5px] text-ink-muted">
                  Waiting for an opponent
                </div>
              )}
            </div>
          </div>

          <div className="mt-7">
            <p className="t-eyebrow mb-3 text-center">Topic pool</p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {DEBATE_CATEGORIES.map((category) => {
                const on = data.categories.includes(category.id);
                return (
                  <button
                    key={category.id}
                    type="button"
                    disabled={!isHost}
                    onClick={() =>
                      void setData((c) => ({
                        ...c,
                        categories: c.categories.includes(category.id)
                          ? c.categories.filter((x) => x !== category.id)
                          : [...c.categories, category.id],
                        topicId: null,
                      }))
                    }
                    className={`rounded-pill px-3.5 py-2 text-[12.5px] font-bold transition-all duration-200 ease-out ${
                      on
                        ? "bg-ink text-ink-inverse shadow-sm"
                        : "bg-surface-muted text-ink-muted hover:text-ink"
                    } ${!isHost ? "cursor-default" : ""}`}
                  >
                    {category.label}
                  </button>
                );
              })}
            </div>
          </div>

          {isHost ? (
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button
                block
                size="lg"
                disabled={players.length < 2}
                onClick={() =>
                  void setData((c) => ({ ...c, phase: "writing", topicId: topic.id }))
                }
              >
                {players.length < 2 ? "Needs two people" : "Start writing"}
              </Button>
              <Button
                block
                size="lg"
                variant="secondary"
                onClick={() => void setData((c) => ({ ...c, round: c.round + 1, topicId: null }))}
              >
                Different topic
              </Button>
            </div>
          ) : (
            <WaitingForPartner label="they're picking the motion…" />
          )}
        </div>
      </GameShell>
    );
  }

  if (data.phase === "writing") {
    return (
      <GameShell title="Debate" hint="They can't see a word until you've both submitted.">
        <div className="mx-auto max-w-xl">
          <div className="mb-6 rounded-3xl ring-1 ring-inset ring-line bg-surface p-6 text-center shadow-sm">
            <h2 className="t-h3 text-ink">
              {topic.motion}
            </h2>
            <div className="mt-3 flex justify-center">
              <Pill tone="info">You&rsquo;re arguing: {mySide}</Pill>
            </div>
          </div>

          {submitted ? (
            <WaitingForPartner
              label="case submitted"
              detail={`Waiting for ${partner?.name ?? "them"} to finish theirs.`}
            />
          ) : (
            <div className="rounded-3xl ring-1 ring-inset ring-line bg-surface p-6 shadow-sm">
              <Label htmlFor="argument">Your case</Label>
              <TextArea
                id="argument"
                rows={9}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Make your strongest case. Concrete examples score higher than adjectives."
              />
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[12.5px] text-ink-faint">
                  {draft.trim().split(/\s+/).filter(Boolean).length} words
                </span>
                <Button size="lg" onClick={submit} disabled={!draft.trim()}>
                  Rest my case
                </Button>
              </div>
            </div>
          )}
        </div>
      </GameShell>
    );
  }

  if (data.phase === "judging" || !data.verdict) {
    return (
      <GameShell title="Debate">
        <div className="mx-auto max-w-md">
          <WaitingForPartner
            label="the judge is reading…"
            detail="Scoring argument, evidence, creativity and persuasiveness."
          />
        </div>
      </GameShell>
    );
  }

  return (
    <GameShell title="Debate">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="text-center">
          <p className="t-eyebrow">
            The motion was
          </p>
          <h2 className="t-h2 mt-2 text-ink">{topic.motion}</h2>
        </div>

        <VerdictPanel verdict={data.verdict} meId={identity.id} />

        <div className="grid gap-4 sm:grid-cols-2">
          {roster.map((p) => (
            <div key={p.id} className="rounded-3xl ring-1 ring-inset ring-line bg-surface p-5 shadow-sm">
              <p className="mb-2 t-eyebrow">
                {p.id === identity.id ? "Your case" : `${p.name}'s case`}
              </p>
              <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink-soft">
                {data.arguments[p.id]}
              </p>
            </div>
          ))}
        </div>

        <MemoryMoment
          onSave={() =>
            saveMemory({
              experienceId: "debate",
              title: topic.motion,
              detail: data.verdict!.headline,
            })
          }
          saveLabel="Keep the verdict"
          onAgain={newRound}
          againLabel="Next motion"
        />
      </div>
    </GameShell>
  );
}
