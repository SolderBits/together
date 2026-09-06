"use client";

import { cn } from "@/lib/utils";

/**
 * The question is the page. Big editorial type on a clean surface, with the
 * answers reading as a considered list rather than a form.
 */
export function QuestionCard({
  eyebrow,
  question,
  children,
  className,
}: {
  eyebrow?: string;
  question: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "a-rise rounded-[36px] bg-surface p-8 shadow-sm ring-1 ring-inset ring-line sm:p-12",
        className,
      )}
    >
      {eyebrow && <p className="t-eyebrow mb-5">{eyebrow}</p>}
      <h3 className="t-h2 text-balance text-ink">{question}</h3>
      {children && <div className="mt-9">{children}</div>}
    </div>
  );
}

export function AnswerOption({
  label,
  index,
  selected,
  state = "idle",
  disabled,
  onClick,
  note,
}: {
  label: string;
  index?: number;
  selected?: boolean;
  /** `correct` / `wrong` only appear after a reveal. */
  state?: "idle" | "correct" | "wrong" | "dimmed";
  disabled?: boolean;
  onClick?: () => void;
  note?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "group/opt flex w-full items-center gap-4 rounded-[20px] px-5 py-4 text-left",
        "transition-[transform,background-color,box-shadow,color] duration-[260ms] ease-out",
        "disabled:cursor-default",
        state === "idle" &&
          (selected
            ? "bg-ink text-ink-inverse shadow-sm"
            : "bg-surface text-ink ring-1 ring-inset ring-line hover:-translate-y-[2px] hover:shadow-sm hover:ring-line-strong"),
        state === "correct" && "bg-mint-tint text-mint-deep ring-1 ring-inset ring-mint-mid",
        state === "wrong" && "bg-blush-tint text-blush-deep ring-1 ring-inset ring-blush-mid",
        state === "dimmed" && "bg-surface text-ink-faint ring-1 ring-inset ring-line",
      )}
    >
      {index !== undefined && (
        <span
          className={cn(
            "grid h-8 w-8 shrink-0 place-items-center rounded-pill text-[12.5px] font-extrabold transition-colors duration-[260ms]",
            state === "idle" && selected
              ? "bg-white/20 text-ink-inverse"
              : state === "correct"
                ? "bg-white/70 text-mint-deep"
                : state === "wrong"
                  ? "bg-white/70 text-blush-deep"
                  : "bg-surface-sunken text-ink-muted",
          )}
        >
          {String.fromCharCode(65 + index)}
        </span>
      )}
      <span className="flex-1 text-[15.5px] font-semibold leading-[1.42] tracking-[-0.015em]">
        {label}
      </span>
      {note}
    </button>
  );
}
