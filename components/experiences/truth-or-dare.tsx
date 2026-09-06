"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GameShell, WaitingForPartner } from "@/components/games/game-shell";
import { ScoreBoard } from "@/components/games/scoreboard";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/badge";
import { useRoom, useSharedState } from "@/components/room/room-provider";
import {
  DARES,
  PROMPT_INTENSITIES,
  TRUTHS,
  promptsFor,
  type Prompt,
  type PromptIntensity,
} from "@/lib/games/content/truth-or-dare";
import { recordCompletion } from "@/lib/store";
import { cn, hashString, mulberry32 } from "@/lib/utils";

type Phase = "reflex" | "choose" | "card" | "recap";
type Kind = "truth" | "dare";

interface Outcome {
  round: number;
  loserId: string;
  kind: Kind;
  promptId: string;
  result: "done" | "skip";
}

interface TodData {
  /** Shared so both players see the same deck. */
  intensities: PromptIntensity[];
  round: number;
  phase: Phase;
  goAt: number | null;
  /** Tap time in ms since the go signal; -1 means a false start. */
  taps: Record<string, number>;
  loserId: string | null;
  kind: Kind | null;
  outcomes: Outcome[];
}

const DEFAULTS: TodData = {
  intensities: ["chill", "bold"],
  round: 0,
  phase: "reflex",
  goAt: null,
  taps: {},
  loserId: null,
  kind: null,
  outcomes: [],
};

function drawPrompt(pool: Prompt[], seed: string) {
  const rand = mulberry32(hashString(seed));
  return pool[Math.floor(rand() * pool.length)];
}

export function TruthOrDare() {
  const { state, identity, players, roster, isHost, update } = useRoom();
  const [data, setData] = useSharedState<TodData>("tod", DEFAULTS);
  const [now, setNow] = useState(() => Date.now());

  const order = useMemo(() => Object.keys(state?.players ?? {}).sort(), [state?.players]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60);
    return () => clearInterval(t);
  }, []);

  // Host schedules the go signal at a random moment so neither side can time it.
  useEffect(() => {
    if (data.phase !== "reflex" || data.goAt !== null || !isHost) return;
    const rand = mulberry32(hashString(`${state?.seed}:${data.round}`));
    const delay = 1800 + Math.floor(rand() * 3800);
    void setData((c) => ({ ...c, goAt: Date.now() + delay, taps: {} }));
  }, [data.phase, data.goAt, data.round, isHost, setData, state?.seed]);

  // Resolve the duel once everyone present has tapped.
  useEffect(() => {
    if (data.phase !== "reflex" || !isHost) return;
    const ids = players.map((p) => p.id);
    if (ids.length < 2) return;
    if (!ids.every((id) => data.taps[id] !== undefined)) return;

    const falseStarters = ids.filter((id) => data.taps[id] === -1);
    let loser: string;
    if (falseStarters.length === 1) loser = falseStarters[0];
    else if (falseStarters.length === ids.length) loser = ids[0];
    else {
      loser = ids.reduce((worst, id) => (data.taps[id] > data.taps[worst] ? id : worst), ids[0]);
    }
    void setData((c) => ({ ...c, phase: "choose", loserId: loser }));
  }, [data.phase, data.taps, players, isHost, setData]);

  const goLive = data.goAt !== null && now >= data.goAt;
  const myTap = data.taps[identity.id];

  const tap = useCallback(() => {
    if (data.phase !== "reflex" || myTap !== undefined || data.goAt === null) return;
    const value = now < data.goAt ? -1 : now - data.goAt;
    void setData((c) => ({ ...c, taps: { ...c.taps, [identity.id]: value } }));
  }, [data.phase, data.goAt, myTap, now, identity.id, setData]);

  const prompt = useMemo(() => {
    if (!data.kind) return null;
    const pool = promptsFor(data.kind === "truth" ? TRUTHS : DARES, data.intensities);
    return drawPrompt(pool.length ? pool : data.kind === "truth" ? TRUTHS : DARES, `${state?.seed}:${data.round}:${data.kind}`);
  }, [data.kind, data.round, data.intensities, state?.seed]);

  const tallies = useMemo(() => {
    const done: Record<string, number> = {};
    const skipped: Record<string, number> = {};
    order.forEach((id) => {
      done[id] = 0;
      skipped[id] = 0;
    });
    data.outcomes.forEach((o) => {
      if (o.result === "done") done[o.loserId] = (done[o.loserId] ?? 0) + 1;
      else skipped[o.loserId] = (skipped[o.loserId] ?? 0) + 1;
    });
    return { done, skipped };
  }, [data.outcomes, order]);

  function resolve(result: "done" | "skip") {
    if (!prompt || !data.loserId || !data.kind) return;
    void setData((c) => ({
      ...c,
      phase: "recap",
      outcomes: [
        ...c.outcomes,
        {
          round: c.round,
          loserId: c.loserId!,
          kind: c.kind!,
          promptId: prompt.id,
          result,
        },
      ],
    }));
    recordCompletion("truth-or-dare");
  }

  function nextRound() {
    void setData((c) => ({
      ...c,
      round: c.round + 1,
      phase: "reflex",
      goAt: null,
      taps: {},
      loserId: null,
      kind: null,
    }));
  }

  const iAmLoser = data.loserId === identity.id;
  const loserName =
    data.loserId === identity.id ? "You" : state?.players[data.loserId ?? ""]?.name ?? "They";

  // --- reflex duel ---------------------------------------------------------

  if (data.phase === "reflex") {
    const waitingOnPartner = myTap !== undefined && players.length >= 2;
    return (
      <GameShell
        title="Truth or Dare"
        step={data.round + 1}
        hint="Wait for green, then tap. Slowest one picks their fate."
      >
        <div className="mx-auto max-w-lg">
          <button
            type="button"
            onClick={tap}
            disabled={myTap !== undefined || players.length < 2}
            className={cn(
              "grid h-80 w-full place-items-center rounded-[36px] px-8 text-center",
              "transition-[background-color,box-shadow,transform] duration-200 ease-out sm:h-[26rem]",
              myTap !== undefined
                ? "bg-surface shadow-sm ring-1 ring-inset ring-line"
                : goLive
                  ? "bg-mint-tint shadow-card ring-1 ring-inset ring-mint-mid"
                  : "bg-surface-muted ring-1 ring-inset ring-line active:scale-[0.995]",
              players.length < 2 && "opacity-70",
            )}
          >
            {players.length < 2 ? (
              <span>
                <span className="t-h2 block text-ink">Waiting for them</span>
                <span className="t-body-sm mx-auto mt-4 block max-w-[32ch]">
                  This one needs two pairs of hands. Send the invite and it starts itself.
                </span>
              </span>
            ) : myTap !== undefined ? (
              <span>
                <span className="t-num block text-[64px] font-extrabold tracking-[-0.05em] text-ink sm:text-[76px]">
                  {myTap === -1 ? "Too early" : `${myTap}`}
                  {myTap !== -1 && (
                    <span className="ml-1 text-[26px] font-bold text-ink-faint">ms</span>
                  )}
                </span>
                <span className="t-serif mt-4 block text-[19px] text-ink-muted">
                  {waitingOnPartner ? "waiting for them…" : "locked in"}
                </span>
              </span>
            ) : goLive ? (
              <span className="t-num block text-[76px] font-extrabold tracking-[-0.06em] text-mint-deep sm:text-[104px]">
                TAP
              </span>
            ) : (
              <span>
                <span className="t-serif block text-[26px] text-ink sm:text-[32px]">
                  wait for green…
                </span>
                <span className="t-body-sm mx-auto mt-4 block max-w-[30ch]">
                  Tap too early and you lose the round automatically.
                </span>
              </span>
            )}
          </button>

          {/* the deck the host is dealing from */}
          <div className="mt-8 flex flex-col items-center gap-3">
            <p className="t-eyebrow">How brave is this deck?</p>
            <div className="flex rounded-pill bg-surface-sunken p-1.5">
              {PROMPT_INTENSITIES.map((level) => {
                const on = data.intensities.includes(level.id);
                return (
                  <button
                    key={level.id}
                    type="button"
                    disabled={!isHost}
                    title={level.blurb}
                    onClick={() =>
                      void setData((c) => {
                        const next = c.intensities.includes(level.id)
                          ? c.intensities.filter((i) => i !== level.id)
                          : [...c.intensities, level.id];
                        return { ...c, intensities: next.length ? next : [level.id] };
                      })
                    }
                    className={cn(
                      "rounded-pill px-4 py-2 text-[12.5px] font-bold tracking-[-0.01em] transition-all duration-300 ease-out",
                      on ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink",
                      !isHost && "cursor-default",
                    )}
                  >
                    {level.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-7 flex flex-wrap justify-center gap-2">
            {players.map((p) => (
              <Pill key={p.id} tone={data.taps[p.id] !== undefined ? "good" : "neutral"}>
                {p.emoji} {p.id === identity.id ? "You" : p.name}
                {data.taps[p.id] !== undefined &&
                  ` · ${data.taps[p.id] === -1 ? "false start" : `${data.taps[p.id]}ms`}`}
              </Pill>
            ))}
          </div>
        </div>
      </GameShell>
    );
  }

  // --- pick truth or dare --------------------------------------------------

  if (data.phase === "choose") {
    return (
      <GameShell title="Truth or Dare" step={data.round + 1}>
        <div className="mx-auto max-w-lg text-center">
          <p className="t-eyebrow">
            Round {data.round + 1}
          </p>
          <h2 className="t-h1 mt-3 text-ink">
            {iAmLoser ? "You were slower" : `${loserName} was slower`}
          </h2>
          <p className="mt-3 text-[15px] text-ink-muted">
            {iAmLoser ? "Your call. Choose carefully." : `${loserName} picks.`}
          </p>

          {iAmLoser ? (
            <div className="mt-9 grid gap-3 sm:grid-cols-2">
              {(["truth", "dare"] as Kind[]).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => void setData((c) => ({ ...c, kind, phase: "card" }))}
                  className="group rounded-4xl ring-1 ring-inset ring-line bg-surface p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-card-hover"
                >
                  <span className="block text-[26px] capitalize text-ink">{kind}</span>
                  <span className="mt-2 block text-[13.5px] text-ink-muted">
                    {kind === "truth" ? "answer honestly" : "do the thing"}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <WaitingForPartner label={`${loserName} is deciding…`} />
          )}
        </div>
      </GameShell>
    );
  }

  // --- the card ------------------------------------------------------------

  if (data.phase === "card" && prompt) {
    return (
      <GameShell title="Truth or Dare" step={data.round + 1}>
        <div className="mx-auto max-w-lg">
          <div
            className="animate-scale-in rounded-4xl ring-1 ring-inset ring-line p-8 text-center shadow-sm sm:p-12"
            style={{
              backgroundImage:
                data.kind === "truth"
                  ? "linear-gradient(140deg,#e2effd,#ffffff)"
                  : "linear-gradient(140deg,#ffe6ef,#ffffff)",
            }}
          >
            <p className="t-eyebrow">
              {data.kind} · for {loserName.toLowerCase()}
            </p>
            <p className="t-h2 mt-5 text-ink">
              {prompt.text}
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-2">
              <Pill tone="neutral">{prompt.category}</Pill>
              <Pill tone="neutral">
                {PROMPT_INTENSITIES.find((i) => i.id === prompt.intensity)?.label}
              </Pill>
            </div>
          </div>

          {iAmLoser ? (
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button block size="lg" onClick={() => resolve("done")}>
                Did it
              </Button>
              <Button block size="lg" variant="secondary" onClick={() => resolve("skip")}>
                Skip (take the penalty)
              </Button>
            </div>
          ) : (
            <div className="mt-7">
              <WaitingForPartner
                label={`${loserName} is on the spot`}
                detail="No pressure. Some pressure."
              />
            </div>
          )}
        </div>
      </GameShell>
    );
  }

  // --- recap ---------------------------------------------------------------

  const last = data.outcomes[data.outcomes.length - 1];
  return (
    <GameShell title="Truth or Dare" step={data.round + 1}>
      <div className="mx-auto max-w-lg space-y-6">
        {last && (
          <div className="animate-fade-up rounded-4xl ring-1 ring-inset ring-line bg-surface p-7 text-center shadow-sm">
            <p className="t-eyebrow">
              Round {last.round + 1}
            </p>
            <h2 className="t-h2 mt-3 text-ink">
              {last.result === "done" ? "Completed" : "Skipped"}
            </h2>
            <p className="mt-2 text-[14px] text-ink-muted">
              {(last.loserId === identity.id ? "You" : state?.players[last.loserId]?.name ?? "They") +
                (last.result === "done" ? " went through with it." : " took the penalty.")}
            </p>
          </div>
        )}

        <ScoreBoard
          title="Completed / skipped"
          rows={roster.map((p) => ({
            id: p.id,
            name: p.id === identity.id ? "You" : p.name,
            emoji: p.emoji,
            score: tallies.done[p.id] ?? 0,
            detail: `${tallies.skipped[p.id] ?? 0} skipped`,
          }))}
        />

        <Button block size="lg" onClick={nextRound}>
          Next round
        </Button>
        <Button
          block
          size="lg"
          variant="ghost"
          onClick={() => {
            void setData({ ...DEFAULTS });
            void update({ status: "active" });
          }}
        >
          Reset the game
        </Button>
      </div>
    </GameShell>
  );
}
