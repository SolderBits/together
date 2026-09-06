import { cn } from "@/lib/utils";

/**
 * The surface primitive. `lift` is the standard hover for anything clickable —
 * a small rise plus a softer, wider shadow. Nothing else in the app invents its
 * own hover.
 */
export function Card({
  className,
  lift,
  tone = "surface",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  lift?: boolean;
  tone?: "surface" | "sunken" | "bare";
}) {
  return (
    <div
      className={cn(
        "rounded-4xl",
        tone === "surface" && "bg-surface ring-1 ring-inset ring-line shadow-sm",
        tone === "sunken" && "bg-surface-muted",
        lift &&
          "transition-[transform,box-shadow] duration-[320ms] ease-out hover:-translate-y-1.5 hover:shadow-card-hover",
        className,
      )}
      {...props}
    />
  );
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-7 sm:p-9", className)} {...props} />;
}

export function Eyebrow({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("t-eyebrow", className)} {...props} />;
}

/** Kept for existing call sites; renders the same eyebrow treatment. */
export function SectionLabel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("t-eyebrow", className)} {...props} />;
}

/** Section header with an eyebrow, a heading and an optional trailing slot. */
export function SectionHead({
  eyebrow,
  title,
  aside,
  className,
}: {
  eyebrow?: string;
  title?: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-8 flex items-end justify-between gap-6 sm:mb-10", className)}>
      <div>
        {eyebrow && <p className="t-eyebrow mb-3">{eyebrow}</p>}
        {title && <h2 className="t-h2 text-ink">{title}</h2>}
      </div>
      {aside && <div className="shrink-0 pb-1">{aside}</div>}
    </div>
  );
}

/** A hairline rule that fades at both ends. */
export function Rule({ className }: { className?: string }) {
  return (
    <div
      className={cn("h-px w-full", className)}
      style={{
        background:
          "linear-gradient(90deg, transparent, var(--border-strong) 18%, var(--border-strong) 82%, transparent)",
      }}
      aria-hidden="true"
    />
  );
}
