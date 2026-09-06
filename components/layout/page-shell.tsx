import { cn } from "@/lib/utils";

/** Page gutters and max widths, in one place. */
export function PageShell({
  className,
  children,
  width = "shell",
}: {
  className?: string;
  children: React.ReactNode;
  width?: "shell" | "narrow" | "wide" | "reading";
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-gutter",
        width === "narrow" && "max-w-[660px]",
        width === "reading" && "max-w-[760px]",
        width === "shell" && "max-w-shell",
        width === "wide" && "max-w-wide",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** The standard page opener: eyebrow, editorial heading, one line of support. */
export function PageHeading({
  eyebrow,
  title,
  subtitle,
  actions,
  align = "left",
}: {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  align?: "left" | "center";
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-7",
        align === "left" && "sm:flex-row sm:items-end sm:justify-between",
        align === "center" && "items-center text-center",
      )}
    >
      <div className={cn("a-rise", align === "center" && "max-w-[620px]")}>
        {eyebrow && <p className="t-eyebrow mb-4">{eyebrow}</p>}
        <h1 className="t-h1 text-ink">{title}</h1>
        {subtitle && (
          <p className={cn("t-body mt-4 max-w-prose", align === "center" && "mx-auto")}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="a-rise d-2 flex shrink-0 flex-wrap gap-2.5">{actions}</div>
      )}
    </div>
  );
}
