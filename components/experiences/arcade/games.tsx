"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { recordScore } from "./scores";
import { cn, shuffle } from "@/lib/utils";

interface GameProps {
  onScore: (value: number) => void;
}

function Frame({
  children,
  className,
  flash,
}: {
  children: React.ReactNode;
  className?: string;
  /** Tints the whole board for a beat so a right or wrong answer is felt, not read. */
  flash?: Hit;
}) {
  return (
    <div
      className={cn(
        "grid min-h-[320px] place-items-center rounded-4xl ring-1 ring-inset ring-line bg-surface p-8 text-center shadow-sm transition-colors duration-150 sm:min-h-[380px]",
        flash === "hit" && "bg-mint-tint ring-mint-mid",
        flash === "miss" && "bg-blush-tint ring-blush-mid",
        className,
      )}
    >
      {children}
    </div>
  );
}

type Hit = "hit" | "miss" | null;

/**
 * A right/wrong pulse that clears itself. Every timed game uses the same one so
 * the whole arcade answers you in the same voice.
 */
function useHitFlash(ms = 280) {
  const [flash, setFlash] = useState<Hit>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return [
    flash,
    useCallback(
      (hit: boolean) => {
        if (timer.current) clearTimeout(timer.current);
        setFlash(hit ? "hit" : "miss");
        timer.current = setTimeout(() => setFlash(null), ms);
      },
      [ms],
    ),
  ] as const;
}

/** 1 — Reaction test. Lower is better. */
export function ReactionGame({ onScore }: GameProps) {
  const [stage, setStage] = useState<"idle" | "waiting" | "go" | "result" | "early">("idle");
  const [result, setResult] = useState(0);
  const goAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = useCallback(() => {
    setStage("waiting");
    const delay = 1400 + Math.random() * 3200;
    timer.current = setTimeout(() => {
      goAt.current = performance.now();
      setStage("go");
    }, delay);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function press() {
    if (stage === "idle" || stage === "result" || stage === "early") return start();
    if (stage === "waiting") {
      if (timer.current) clearTimeout(timer.current);
      setStage("early");
      return;
    }
    const ms = Math.round(performance.now() - goAt.current);
    setResult(ms);
    setStage("result");
    recordScore("reaction", ms);
    onScore(ms);
  }

  return (
    <button type="button" onClick={press} className="block w-full">
      <Frame
        className={cn(
          "cursor-pointer transition-colors",
          stage === "go" && "bg-mint-tint ring-mint-mid",
          stage === "early" && "bg-blush-tint ring-blush-mid",
        )}
      >
        <div>
          {stage === "idle" && (
            <>
              <p className="t-h2 text-ink">Reaction test</p>
              <p className="t-body-sm mx-auto mt-4 max-w-[30ch]">
                Tap to start. Then tap the instant it turns green.
              </p>
            </>
          )}
          {stage === "waiting" && <p className="t-h2 text-ink">Wait…</p>}
          {stage === "go" && <p className="t-h1">TAP</p>}
          {stage === "early" && (
            <>
              <p className="t-h2">Too early</p>
              <p className="t-body-sm mx-auto mt-4 max-w-[30ch]">Tap to try again.</p>
            </>
          )}
          {stage === "result" && (
            <>
              <p className="t-num text-[56px] font-extrabold tracking-[-0.05em] text-ink">{result}ms</p>
              <p className="t-body-sm mx-auto mt-4 max-w-[30ch]">
                {result < 200 ? "Genuinely quick." : result < 300 ? "Solid." : "Room to improve."}{" "}
                Tap to go again.
              </p>
            </>
          )}
        </div>
      </Frame>
    </button>
  );
}

/** 2 — Memory match. Higher is better. */
const MEMORY_FACES = ["🌸", "🫧", "🍓", "🦋", "🌙", "🧁"];

export function MemoryGame({ onScore }: GameProps) {
  const [cards, setCards] = useState<string[]>([]);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [done, setDone] = useState(false);

  const deal = useCallback(() => {
    setCards(shuffle([...MEMORY_FACES, ...MEMORY_FACES]));
    setFlipped([]);
    setMatched([]);
    setMoves(0);
    setDone(false);
  }, []);

  useEffect(deal, [deal]);

  useEffect(() => {
    if (flipped.length !== 2) return;
    const [a, b] = flipped;
    setMoves((m) => m + 1);
    if (cards[a] === cards[b]) {
      setMatched((m) => [...m, a, b]);
      setFlipped([]);
    } else {
      const t = setTimeout(() => setFlipped([]), 700);
      return () => clearTimeout(t);
    }
  }, [flipped, cards]);

  useEffect(() => {
    if (cards.length && matched.length === cards.length && !done) {
      setDone(true);
      const score = Math.max(10, 200 - moves * 8);
      recordScore("memory", score);
      onScore(score);
    }
  }, [matched, cards, moves, done, onScore]);

  return (
    <Frame>
      <div className="w-full max-w-sm">
        <div className="grid grid-cols-4 gap-2.5">
          {cards.map((face, i) => {
            const open = flipped.includes(i) || matched.includes(i);
            return (
              <button
                key={i}
                type="button"
                disabled={open || flipped.length === 2}
                onClick={() => setFlipped((f) => (f.length < 2 ? [...f, i] : f))}
                className={cn(
                  "grid aspect-square place-items-center rounded-2xl border text-[26px] transition-all duration-200",
                  open
                    ? "border-line bg-surface-muted"
                    : "border-line bg-ink text-transparent hover:opacity-90",
                  matched.includes(i) && "ring-mint-mid bg-mint-tint",
                )}
              >
                {open ? face : "?"}
              </button>
            );
          })}
        </div>
        <p className="t-body-sm mt-6">
          {done ? `Cleared in ${moves} moves.` : `${moves} moves`}
        </p>
        <Button
          className="mt-4"
          size={done ? "md" : "sm"}
          variant={done ? "primary" : "ghost"}
          onClick={deal}
        >
          Deal again
        </Button>
      </div>
    </Frame>
  );
}

/** 3 — Quick tap. Higher is better. */
export function QuickTapGame({ onScore }: GameProps) {
  const DURATION = 10_000;
  const [taps, setTaps] = useState(0);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const scored = useRef(false);

  useEffect(() => {
    if (!endsAt) return;
    const t = setInterval(() => setNow(Date.now()), 60);
    return () => clearInterval(t);
  }, [endsAt]);

  const running = endsAt !== null && now < endsAt;
  const finished = endsAt !== null && now >= endsAt;

  useEffect(() => {
    if (finished && !scored.current) {
      scored.current = true;
      recordScore("quick-tap", taps);
      onScore(taps);
    }
  }, [finished, taps, onScore]);

  return (
    <Frame>
      <div className="w-full">
        {!endsAt && (
          <>
            <p className="t-h2 text-ink">Quick tap</p>
            <p className="t-body-sm mx-auto mt-4 max-w-[30ch]">
              As many taps as you can in ten seconds.
            </p>
            <Button
              size="lg"
              className="mt-6"
              onClick={() => {
                scored.current = false;
                setTaps(0);
                setNow(Date.now());
                setEndsAt(Date.now() + DURATION);
              }}
            >
              Start
            </Button>
          </>
        )}

        {running && (
          <>
            <p className="t-num text-[72px] font-extrabold leading-none tracking-[-0.055em] text-ink">{taps}</p>
            <p className="t-num mt-3 text-[15px] font-bold text-ink-muted">
              {((endsAt - now) / 1000).toFixed(1)}s
            </p>
            <button
              type="button"
              onPointerDown={() => setTaps((t) => t + 1)}
              className="mt-6 h-32 w-full rounded-4xl bg-ink text-[20px] font-bold text-white transition-transform active:scale-[0.98]"
            >
              TAP
            </button>
          </>
        )}

        {finished && (
          <>
            <p className="t-num text-[62px] font-extrabold tracking-[-0.05em] text-ink">{taps}</p>
            <p className="t-body-sm mt-3">taps in ten seconds</p>
            <Button className="mt-6" onClick={() => setEndsAt(null)}>
              Go again
            </Button>
          </>
        )}
      </div>
    </Frame>
  );
}

/** 4 — Colour match (Stroop). Higher is better. */
const COLOR_WORDS = [
  { name: "RED", hex: "#e5484d" },
  { name: "BLUE", hex: "#4a91e4" },
  { name: "GREEN", hex: "#4fbd8f" },
  { name: "PINK", hex: "#f95f9b" },
  { name: "PURPLE", hex: "#8f7ae6" },
];

export function ColorMatchGame({ onScore }: GameProps) {
  const DURATION = 30_000;
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(0);
  const [flash, hit] = useHitFlash();
  const scored = useRef(false);

  const challenge = useMemo(() => {
    const word = COLOR_WORDS[Math.floor(Math.random() * COLOR_WORDS.length)];
    const same = Math.random() > 0.5;
    const ink = same
      ? word
      : COLOR_WORDS.filter((c) => c.name !== word.name)[
          Math.floor(Math.random() * (COLOR_WORDS.length - 1))
        ];
    return { word, ink, same: word.name === ink.name };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  useEffect(() => {
    if (!endsAt) return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [endsAt]);

  const running = endsAt !== null && now < endsAt;
  const finished = endsAt !== null && now >= endsAt;

  useEffect(() => {
    if (finished && !scored.current) {
      scored.current = true;
      recordScore("color-match", score);
      onScore(score);
    }
  }, [finished, score, onScore]);

  function answer(saidMatch: boolean) {
    const right = saidMatch === challenge.same;
    hit(right);
    setScore((s) => (right ? s + 1 : Math.max(0, s - 1)));
    setRound((r) => r + 1);
  }

  return (
    <Frame flash={running ? flash : null}>
      <div className="w-full">
        {!endsAt && (
          <>
            <p className="t-h2 text-ink">Colour match</p>
            <p className="t-body-sm mx-auto mt-4 max-w-[32ch]">
              Does the <em>word</em> match the <em>colour it&rsquo;s printed in</em>? Thirty seconds.
            </p>
            <Button
              size="lg"
              className="mt-6"
              onClick={() => {
                scored.current = false;
                setScore(0);
                setRound(0);
                setNow(Date.now());
                setEndsAt(Date.now() + DURATION);
              }}
            >
              Start
            </Button>
          </>
        )}

        {running && (
          <>
            <div className="flex items-baseline justify-between text-[13px] font-bold text-ink-muted">
              <span>Score {score}</span>
              <span className="t-num">{((endsAt - now) / 1000).toFixed(0)}s</span>
            </div>
            <p
              className="my-12 text-[58px] font-extrabold tracking-[-0.045em] sm:text-[74px]"
              style={{ color: challenge.ink.hex }}
            >
              {challenge.word.name}
            </p>
            <div className="flex gap-3">
              <Button block size="lg" variant="secondary" onClick={() => answer(false)}>
                No match
              </Button>
              <Button block size="lg" onClick={() => answer(true)}>
                Match
              </Button>
            </div>
          </>
        )}

        {finished && (
          <>
            <p className="t-num text-[62px] font-extrabold tracking-[-0.05em] text-ink">{score}</p>
            <p className="t-body-sm mt-3">correct in thirty seconds</p>
            <Button className="mt-6" onClick={() => setEndsAt(null)}>
              Go again
            </Button>
          </>
        )}
      </div>
    </Frame>
  );
}

/** 5 — Number challenge. Higher is better. */
export function NumberGame({ onScore }: GameProps) {
  const DURATION = 30_000;
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(0);
  const [flash, hit] = useHitFlash();
  const scored = useRef(false);

  const problem = useMemo(() => {
    const ops = ["+", "−", "×"] as const;
    const op = ops[Math.floor(Math.random() * ops.length)];
    const a = op === "×" ? 2 + Math.floor(Math.random() * 11) : 8 + Math.floor(Math.random() * 80);
    const b = op === "×" ? 2 + Math.floor(Math.random() * 11) : 3 + Math.floor(Math.random() * 40);
    const answer = op === "+" ? a + b : op === "−" ? a - b : a * b;
    const options = shuffle([
      answer,
      answer + (1 + Math.floor(Math.random() * 6)),
      answer - (1 + Math.floor(Math.random() * 6)),
      answer + (7 + Math.floor(Math.random() * 12)),
    ]);
    return { text: `${a} ${op} ${b}`, answer, options };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  useEffect(() => {
    if (!endsAt) return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [endsAt]);

  const running = endsAt !== null && now < endsAt;
  const finished = endsAt !== null && now >= endsAt;

  useEffect(() => {
    if (finished && !scored.current) {
      scored.current = true;
      recordScore("number", score);
      onScore(score);
    }
  }, [finished, score, onScore]);

  return (
    <Frame flash={running ? flash : null}>
      <div className="w-full">
        {!endsAt && (
          <>
            <p className="t-h2 text-ink">Number challenge</p>
            <p className="t-body-sm mx-auto mt-4 max-w-[30ch]">
              Mental arithmetic, thirty seconds, no paper.
            </p>
            <Button
              size="lg"
              className="mt-6"
              onClick={() => {
                scored.current = false;
                setScore(0);
                setRound(0);
                setNow(Date.now());
                setEndsAt(Date.now() + DURATION);
              }}
            >
              Start
            </Button>
          </>
        )}

        {running && (
          <>
            <div className="flex items-baseline justify-between text-[13px] font-bold text-ink-muted">
              <span>Score {score}</span>
              <span className="t-num">{((endsAt - now) / 1000).toFixed(0)}s</span>
            </div>
            <p className="t-num my-10 text-[50px] font-extrabold tracking-[-0.045em] text-ink sm:text-[62px]">{problem.text}</p>
            <div className="grid grid-cols-2 gap-2.5">
              {problem.options.map((option) => (
                <Button
                  key={option}
                  size="lg"
                  variant="secondary"
                  onClick={() => {
                    const right = option === problem.answer;
                    hit(right);
                    setScore((s) => (right ? s + 1 : Math.max(0, s - 1)));
                    setRound((r) => r + 1);
                  }}
                >
                  {option}
                </Button>
              ))}
            </div>
          </>
        )}

        {finished && (
          <>
            <p className="t-num text-[62px] font-extrabold tracking-[-0.05em] text-ink">{score}</p>
            <p className="t-body-sm mt-3">right in thirty seconds</p>
            <Button className="mt-6" onClick={() => setEndsAt(null)}>
              Go again
            </Button>
          </>
        )}
      </div>
    </Frame>
  );
}

/** 6 — Don't Blink. Higher is better. */
const BLINK_SYMBOLS = ["◆", "●", "▲", "■", "★", "✦"];

export function DontBlinkGame({ onScore }: GameProps) {
  const [stage, setStage] = useState<"idle" | "flash" | "ask" | "over">("idle");
  const [sequence, setSequence] = useState<string[]>([]);
  const [level, setLevel] = useState(1);
  const [showFor, setShowFor] = useState(1100);
  const [flash, hit] = useHitFlash();
  const scored = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const start = useCallback(() => {
    scored.current = false;
    setLevel(1);
    setShowFor(1100);
    nextRound(1, 1100);
  }, []);

  function nextRound(atLevel: number, ms: number) {
    const next = Array.from(
      { length: Math.min(6, 2 + Math.floor(atLevel / 2)) },
      () => BLINK_SYMBOLS[Math.floor(Math.random() * BLINK_SYMBOLS.length)],
    );
    setSequence(next);
    setStage("flash");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setStage("ask"), ms);
  }

  function answer(count: number) {
    const target = sequence.filter((s) => s === sequence[0]).length;
    hit(count === target);
    if (count === target) {
      const nextLevel = level + 1;
      const nextMs = Math.max(280, showFor - 90);
      setLevel(nextLevel);
      setShowFor(nextMs);
      nextRound(nextLevel, nextMs);
    } else {
      setStage("over");
      if (!scored.current) {
        scored.current = true;
        recordScore("dont-blink", level - 1);
        onScore(level - 1);
      }
    }
  }

  return (
    <Frame flash={flash}>
      <div className="w-full">
        {stage === "idle" && (
          <>
            <p className="t-h2 text-ink">Don&rsquo;t blink</p>
            <p className="t-body-sm mx-auto mt-4 max-w-[32ch]">
              Symbols flash for a moment. Count how many match the first one. It gets faster.
            </p>
            <Button size="lg" className="mt-7" onClick={start}>
              Start
            </Button>
          </>
        )}

        {stage === "flash" && (
          <div className="flex flex-wrap items-center justify-center gap-5">
            {sequence.map((symbol, i) => (
              <span key={i} className="text-[44px] leading-none text-ink sm:text-[56px]">
                {symbol}
              </span>
            ))}
          </div>
        )}

        {stage === "ask" && (
          <>
            <p className="t-body-sm">
              How many matched <span className="text-[20px] font-bold text-ink">{sequence[0]}</span>?
            </p>
            <div className="mx-auto mt-6 grid max-w-xs grid-cols-3 gap-2.5">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <Button key={n} size="lg" variant="secondary" onClick={() => answer(n)}>
                  {n}
                </Button>
              ))}
            </div>
            <p className="t-caption mt-5">Level {level}</p>
          </>
        )}

        {stage === "over" && (
          <>
            <p className="t-num text-[62px] font-extrabold tracking-[-0.05em] text-ink">
              {level - 1}
            </p>
            <p className="t-body-sm mt-3">levels cleared</p>
            <Button className="mt-6" onClick={start}>
              Go again
            </Button>
          </>
        )}
      </div>
    </Frame>
  );
}

/** 7 — Higher or Lower. Higher is better. */
export function HigherLowerGame({ onScore }: GameProps) {
  const [current, setCurrent] = useState(() => 1 + Math.floor(Math.random() * 98));
  const [next, setNext] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);
  const [stage, setStage] = useState<"idle" | "play" | "reveal" | "over">("idle");
  const [flash, hit] = useHitFlash(900);
  const scored = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function begin() {
    scored.current = false;
    setCurrent(1 + Math.floor(Math.random() * 98));
    setNext(null);
    setStreak(0);
    setStage("play");
  }

  function guess(direction: "higher" | "lower") {
    let candidate = 1 + Math.floor(Math.random() * 99);
    while (candidate === current) candidate = 1 + Math.floor(Math.random() * 99);
    setNext(candidate);
    setStage("reveal");

    const correct = direction === "higher" ? candidate > current : candidate < current;
    hit(correct);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (correct) {
        setStreak((s) => s + 1);
        setCurrent(candidate);
        setNext(null);
        setStage("play");
      } else {
        setStage("over");
        if (!scored.current) {
          scored.current = true;
          recordScore("higher-lower", streak);
          onScore(streak);
        }
      }
    }, 900);
  }

  return (
    <Frame flash={flash}>
      <div className="w-full">
        {stage === "idle" && (
          <>
            <p className="t-h2 text-ink">Higher or lower</p>
            <p className="t-body-sm mx-auto mt-4 max-w-[32ch]">
              Numbers from 1 to 99. Guess whether the next one is higher or lower. Keep the streak.
            </p>
            <Button size="lg" className="mt-7" onClick={begin}>
              Start
            </Button>
          </>
        )}

        {(stage === "play" || stage === "reveal") && (
          <>
            <p className="t-caption">Streak {streak}</p>
            <div className="my-8 flex items-center justify-center gap-8">
              <span className="t-num text-[64px] font-extrabold tracking-[-0.05em] text-ink sm:text-[76px]">
                {current}
              </span>
              {stage === "reveal" && next !== null && (
                <span className="a-pop t-num text-[64px] font-extrabold tracking-[-0.05em] text-ink-faint sm:text-[76px]">
                  {next}
                </span>
              )}
            </div>
            <div className="flex justify-center gap-3">
              <Button size="lg" disabled={stage === "reveal"} onClick={() => guess("higher")}>
                Higher
              </Button>
              <Button
                size="lg"
                variant="secondary"
                disabled={stage === "reveal"}
                onClick={() => guess("lower")}
              >
                Lower
              </Button>
            </div>
          </>
        )}

        {stage === "over" && (
          <>
            <p className="t-num text-[62px] font-extrabold tracking-[-0.05em] text-ink">{streak}</p>
            <p className="t-body-sm mt-3">in a row</p>
            <Button className="mt-6" onClick={begin}>
              Go again
            </Button>
          </>
        )}
      </div>
    </Frame>
  );
}

/** 8 — Memory Sequence. Higher is better. */
const PADS = [
  { id: 0, tint: "var(--blush-tint)", live: "var(--blush-mid)" },
  { id: 1, tint: "var(--sky-tint)", live: "var(--sky-mid)" },
  { id: 2, tint: "var(--mint-tint)", live: "var(--mint-mid)" },
  { id: 3, tint: "var(--butter-tint)", live: "var(--butter-mid)" },
];

export function SequenceGame({ onScore }: GameProps) {
  const [sequence, setSequence] = useState<number[]>([]);
  const [step, setStep] = useState(0);
  const [lit, setLit] = useState<number | null>(null);
  const [stage, setStage] = useState<"idle" | "showing" | "input" | "over">("idle");
  const scored = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
    },
    [],
  );

  const playBack = useCallback((seq: number[]) => {
    setStage("showing");
    timers.current.forEach(clearTimeout);
    timers.current = [];
    seq.forEach((pad, i) => {
      timers.current.push(setTimeout(() => setLit(pad), i * 620 + 120));
      timers.current.push(setTimeout(() => setLit(null), i * 620 + 440));
    });
    timers.current.push(
      setTimeout(() => {
        setStep(0);
        setStage("input");
      }, seq.length * 620 + 220),
    );
  }, []);

  function begin() {
    scored.current = false;
    const first = [Math.floor(Math.random() * 4)];
    setSequence(first);
    playBack(first);
  }

  function press(pad: number) {
    if (stage !== "input") return;
    if (sequence[step] !== pad) {
      setStage("over");
      if (!scored.current) {
        scored.current = true;
        recordScore("sequence", sequence.length - 1);
        onScore(sequence.length - 1);
      }
      return;
    }
    setLit(pad);
    timers.current.push(setTimeout(() => setLit(null), 160));

    if (step + 1 === sequence.length) {
      // Lock input straight away — otherwise a fast tap lands in the gap
      // between finishing the pattern and the next play-back starting.
      setStage("showing");
      const next = [...sequence, Math.floor(Math.random() * 4)];
      setSequence(next);
      timers.current.push(setTimeout(() => playBack(next), 520));
    } else {
      setStep((s) => s + 1);
    }
  }

  return (
    <Frame>
      <div className="w-full">
        {stage === "idle" ? (
          <>
            <p className="t-h2 text-ink">Memory sequence</p>
            <p className="t-body-sm mx-auto mt-4 max-w-[32ch]">
              Watch the pattern, then repeat it. One more pad every round.
            </p>
            <Button size="lg" className="mt-7" onClick={begin}>
              Start
            </Button>
          </>
        ) : (
          <>
            <p className="t-caption mb-5">
              {stage === "showing"
                ? "Watch…"
                : stage === "input"
                  ? `Your turn — ${sequence.length} in the pattern`
                  : "Wrong pad"}
            </p>
            <div className="mx-auto grid max-w-[300px] grid-cols-2 gap-3">
              {PADS.map((pad) => (
                <button
                  key={pad.id}
                  type="button"
                  disabled={stage !== "input"}
                  onClick={() => press(pad.id)}
                  className={cn(
                    "aspect-square rounded-[22px] transition-all duration-150",
                    stage === "input" && "hover:-translate-y-[2px]",
                  )}
                  style={{ background: lit === pad.id ? pad.live : pad.tint }}
                  aria-label={`Pad ${pad.id + 1}`}
                />
              ))}
            </div>
            {stage === "over" && (
              <>
                <p className="t-num mt-7 text-[52px] font-extrabold tracking-[-0.05em] text-ink">
                  {sequence.length - 1}
                </p>
                <p className="t-body-sm mt-2">steps remembered</p>
                <Button className="mt-6" onClick={begin}>
                  Go again
                </Button>
              </>
            )}
          </>
        )}
      </div>
    </Frame>
  );
}
