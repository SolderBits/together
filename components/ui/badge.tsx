import { cn } from "@/lib/utils";

/** The "new" marker on the experience grid. Small, gradient, never shouty. */
export function NewBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-[19px] items-center rounded-pill px-2 text-[9.5px] font-extrabold uppercase tracking-[0.13em] text-ink-inverse",
        className,
      )}
      style={{
        backgroundImage:
          "linear-gradient(102deg, var(--blush-deep), var(--lilac-deep) 58%, var(--sky-deep))",
      }}
    >
      New
    </span>
  );
}

type Tone = "neutral" | "good" | "warn" | "info" | "accent";

export function Pill({
  className,
  tone = "neutral",
  accent,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone; accent?: string }) {
  const tones: Record<Tone, string> = {
    neutral: "bg-surface-sunken text-ink-muted",
    good: "bg-mint-tint text-mint-deep",
    warn: "bg-butter-tint text-butter-deep",
    info: "bg-sky-tint text-sky-deep",
    accent: "",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill px-3 py-[5px] text-[12px] font-semibold tracking-[-0.005em]",
        tones[tone],
        className,
      )}
      style={
        tone === "accent" && accent
          ? { backgroundColor: `var(--${accent}-tint)`, color: `var(--${accent}-deep)` }
          : undefined
      }
      {...props}
    />
  );
}

/** A small dot + label, used where a full pill would be too heavy. */
export function StatusDot({
  tone = "idle",
  className,
}: {
  tone?: "live" | "idle" | "waiting";
  className?: string;
}) {
  return (
    <span className={cn("relative inline-flex h-2 w-2", className)} aria-hidden="true">
      {tone === "waiting" && (
        <span className="a-halo absolute inset-0 rounded-full bg-ink-faint" />
      )}
      <span
        className={cn(
          "relative inline-block h-2 w-2 rounded-full",
          tone === "live" && "bg-mint-deep",
          tone === "idle" && "bg-butter-mid",
          tone === "waiting" && "border border-ink-faint",
        )}
      />
    </span>
  );
}
